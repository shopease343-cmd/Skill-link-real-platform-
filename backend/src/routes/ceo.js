import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { query, pool } from '../lib/db.js';

const router = Router();
const ceoOnly = [requireAuth, requireRole('ceo')];

router.get('/overview', ...ceoOnly, async (req, res, next) => {
  try {
    const [users, orders, withdrawals, courses, packages] = await Promise.all([
      query('select count(*)::int as count from users'),
      query(`select count(*)::int as count from orders where status <> 'cancelled'`),
      query(`select count(*)::int as count from withdrawals where status = 'pending'`),
      query(`select count(*)::int as count from courses where status = 'published'`),
      query(`select count(*)::int as count from packages where is_active = true`)
    ]);
    res.json({
      users: users.rows[0].count,
      orders: orders.rows[0].count,
      pendingWithdrawals: withdrawals.rows[0].count,
      publishedCourses: courses.rows[0].count,
      activePackages: packages.rows[0].count
    });
  } catch (err) { next(err); }
});

router.get('/users', ...ceoOnly, async (req, res, next) => {
  try {
    const result = await query(`
      select u.id, u.email, u.full_name, u.status, u.created_at,
             coalesce(array_agg(r.code order by r.code) filter (where r.code is not null), '{}') as roles
      from users u
      left join user_roles ur on ur.user_id = u.id
      left join roles r on r.id = ur.role_id
      group by u.id
      order by u.created_at desc
      limit 200
    `);
    res.json({ users: result.rows });
  } catch (err) { next(err); }
});

router.patch('/users/:id/status', ...ceoOnly, async (req, res, next) => {
  try {
    const schema = z.object({ status: z.enum(['pending','active','suspended','disabled']) });
    const { status } = schema.parse(req.body);
    if (req.params.id === req.user.id && status !== 'active') {
      return res.status(400).json({ error: 'CEO cannot deactivate the current session account' });
    }

    const result = await query(
      `update users set status=$1, updated_at=now() where id=$2
       returning id, email, full_name, status`,
      [status, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });

    await query(
      `insert into audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
       values($1,'USER_STATUS_CHANGED','user',$2,$3)`,
      [req.user.id, req.params.id, JSON.stringify({ status })]
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Invalid status' });
    next(err);
  }
});

router.get('/packages', ...ceoOnly, async (req, res, next) => {
  try {
    const result = await query(
      `select * from packages order by display_order asc`
    );
    res.json({ packages: result.rows });
  } catch (err) { next(err); }
});

router.patch('/packages/:id', ...ceoOnly, async (req, res, next) => {
  try {
    const schema = z.object({
      subtitle: z.string().min(2).max(200).optional(),
      description: z.string().max(5000).nullable().optional(),
      pricePaise: z.number().int().min(0).optional(),
      accessDays: z.number().int().positive().nullable().optional(),
      isActive: z.boolean().optional(),
      isFeatured: z.boolean().optional()
    });
    const input = schema.parse(req.body);

    const current = await query('select * from packages where id=$1', [req.params.id]);
    if (!current.rows[0]) return res.status(404).json({ error: 'Package not found' });

    const p = current.rows[0];
    const result = await query(
      `update packages set
        subtitle=$1, description=$2, price_paise=$3, access_days=$4,
        is_active=$5, is_featured=$6, updated_at=now()
       where id=$7
       returning *`,
      [
        input.subtitle ?? p.subtitle,
        input.description === undefined ? p.description : input.description,
        input.pricePaise ?? p.price_paise,
        input.accessDays === undefined ? p.access_days : input.accessDays,
        input.isActive ?? p.is_active,
        input.isFeatured ?? p.is_featured,
        req.params.id
      ]
    );

    await query(
      `insert into audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
       values($1,'PACKAGE_UPDATED','package',$2,$3)`,
      [req.user.id, req.params.id, JSON.stringify(input)]
    );
    res.json({ package: result.rows[0] });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Invalid package data' });
    next(err);
  }
});

router.get('/audit-logs', ...ceoOnly, async (req, res, next) => {
  try {
    const result = await query(`
      select a.id, a.action, a.entity_type, a.entity_id, a.metadata,
             a.created_at, u.email as actor_email
      from audit_logs a
      left join users u on u.id = a.actor_user_id
      order by a.created_at desc
      limit 200
    `);
    res.json({ logs: result.rows });
  } catch (err) { next(err); }
});


router.post('/commission-rules', ...ceoOnly, async (req,res,next)=>{
  try{
    const input=z.object({
      packageId:z.string().uuid(),
      commissionType:z.enum(['fixed','percent']),
      value:z.number().nonnegative()
    }).parse(req.body);
    if(input.commissionType==='percent' && input.value>100)
      return res.status(400).json({error:'Percent cannot exceed 100'});
    const result=await query(`
      insert into commission_rules(package_id,commission_type,value,is_active)
      values($1,$2,$3,true)
      returning id,package_id,commission_type,value,is_active,created_at`,
      [input.packageId,input.commissionType,input.value]
    );
    await query(`
      insert into audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
      values($1,'COMMISSION_RULE_CREATED','commission_rule',$2,$3)`,
      [req.user.id,result.rows[0].id,JSON.stringify(input)]
    );
    res.status(201).json({rule:result.rows[0]});
  }catch(err){
    if(err.name==='ZodError')return res.status(400).json({error:'Invalid commission rule'});
    next(err);
  }
});

router.get('/withdrawals', ...ceoOnly, async(req,res,next)=>{
  try{
    const r=await query(`
      select w.id,w.partner_user_id,w.amount_paise,w.status,w.requested_at,
             w.reviewed_at,w.rejection_reason,w.processed_at,
             u.email as username
      from withdrawals w join users u on u.id=w.partner_user_id
      order by w.created_at desc`);
    res.json({withdrawals:r.rows});
  }catch(err){next(err)}
});

router.post('/withdrawals/:id/review', ...ceoOnly, async(req,res,next)=>{
  const client=await pool.connect();
  try{
    const input=z.object({decision:z.enum(['approved','rejected']),reason:z.string().max(500).optional()}).parse(req.body);
    await client.query('begin');
    const w=await client.query(`select * from withdrawals where id=$1 for update`,[req.params.id]);
    if(!w.rows[0]){await client.query('rollback');return res.status(404).json({error:'Withdrawal not found'})}
    if(w.rows[0].status!=='pending'){await client.query('rollback');return res.status(409).json({error:'Withdrawal already reviewed'})}

    const status=input.decision;
    await client.query(`
      update withdrawals
      set status=$1,reviewed_at=now(),reviewed_by=$2,rejection_reason=$3,
          processed_at=case when $1='approved' then null else processed_at end
      where id=$4`,
      [status,req.user.id,input.reason||null,req.params.id]);

    await client.query(`
      insert into notifications(user_id,title,body)
      values($1,'withdrawal',$2,$3)`,
      [w.rows[0].partner_user_id,
       status==='approved'?'Withdrawal approved':'Withdrawal rejected',
       status==='approved'?'Your withdrawal was approved by the CEO.':`Your withdrawal was rejected.${input.reason?` Reason: ${input.reason}`:''}`]);

    await client.query(`
      insert into audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
      values($1,$2,'withdrawal',$3,$4)`,
      [req.user.id,status==='approved'?'WITHDRAWAL_APPROVED':'WITHDRAWAL_REJECTED',
       req.params.id,JSON.stringify({reason:input.reason||null})]);

    await client.query('commit');
    res.json({ok:true,status});
  }catch(err){
    try{await client.query('rollback')}catch{}
    if(err.name==='ZodError')return res.status(400).json({error:'Invalid review request'});
    next(err);
  }finally{client.release()}
});

router.get('/analytics', ...ceoOnly, async(req,res,next)=>{
  try{
    const [orders,revenue,users,withdrawals]=await Promise.all([
      query(`select count(*)::int as total, count(*) filter(where status='paid')::int as paid from orders`),
      query(`select coalesce(sum(amount_paise),0)::bigint as verified_revenue from orders where status='paid'`),
      query(`select count(*)::int as users from users`),
      query(`select coalesce(sum(amount_paise),0)::bigint as pending_withdrawals from withdrawals where status='pending'`)
    ]);
    res.json({
      orders:orders.rows[0],
      verifiedRevenuePaise:Number(revenue.rows[0].verified_revenue),
      users:users.rows[0].users,
      pendingWithdrawalsPaise:Number(withdrawals.rows[0].pending_withdrawals)
    });
  }catch(err){next(err)}
});

export default router;
