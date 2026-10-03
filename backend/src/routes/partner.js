import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { query } from '../lib/db.js';

const router = Router();
const partnerOnly = [requireAuth, requireRole('partner')];

router.get('/dashboard', ...partnerOnly, async (req,res,next)=>{
  try{
    const partner=await query(
      `select p.user_id,p.referral_code,p.created_at
       from partners p where p.user_id=$1`,[req.user.id]
    );
    if(!partner.rows[0]) return res.status(404).json({error:'Partner profile not found'});

    const [balance,refs,commissions,withdrawals,qr] = await Promise.all([
      query(`select * from partner_balances where user_id=$1`,[req.user.id]),
      query(`select count(*)::int as count from referrals where partner_user_id=$1`,[req.user.id]),
      query(`select count(*)::int as count,coalesce(sum(amount_paise),0)::bigint as amount
             from commissions where partner_user_id=$1`,[req.user.id]),
      query(`select id,amount_paise,status,requested_at,reviewed_at,rejection_reason
             from withdrawals where partner_user_id=$1 order by requested_at desc limit 50`,[req.user.id]),
      query(`select id,code,is_active,created_at from qr_codes
             where partner_user_id=$1 order by created_at desc`,[req.user.id])
    ]);
    res.json({
      partner:partner.rows[0],
      balance:balance.rows[0]||{gross_earned_paise:0,pending_paise:0,available_paise:0,withdrawn_paise:0},
      referrals:refs.rows[0].count,
      commissions:commissions.rows[0],
      withdrawals:withdrawals.rows,
      qrCodes:qr.rows
    });
  }catch(err){next(err)}
});

router.post('/qr', ...partnerOnly, async(req,res,next)=>{
  try{
    const schema=z.object({destinationPath:z.string().regex(/^\/[A-Za-z0-9_\-/]*$/).default('/signup')});
    const input=schema.parse(req.body);
    const code='SL-'+crypto.randomBytes(8).toString('hex').toUpperCase();
    const result=await query(
      `insert into qr_codes(partner_user_id,code,destination_path)
       values($1,$2,$3) returning id,code,destination_path,is_active,created_at`,
      [req.user.id,code,input.destinationPath]
    );
    await query(
      `insert into audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
       values($1,'PARTNER_QR_CREATED','qr_code',$2,$3)`,
      [req.user.id,result.rows[0].id,JSON.stringify({code})]
    );
    res.status(201).json({qrCode:result.rows[0]});
  }catch(err){
    if(err.name==='ZodError')return res.status(400).json({error:'Invalid QR data'});
    next(err);
  }
});

router.post('/withdrawals',requireAuth,requireRole('partner'),async(req,res,next)=>{
  try{
    const input=z.object({
      amountPaise:z.number().int().min(10000),
      payoutMethod:z.string().max(100).optional(),
      payoutReference:z.string().max(200).optional()
    }).parse(req.body);

    const balance=await query(`
      select coalesce(sum(case when status in ('pending','approved') then amount_paise else 0 end),0) as earned
      from commissions where partner_user_id=$1`,[req.user.id]);

    const withdrawn=await query(`
      select coalesce(sum(amount_paise),0) as total
      from withdrawals where partner_user_id=$1 and status in ('approved','paid')`,[req.user.id]);

    const pending=await query(`
      select coalesce(sum(amount_paise),0) as total
      from withdrawals where partner_user_id=$1 and status='pending'`,[req.user.id]);

    const available=Number(balance.rows[0].earned)-Number(withdrawn.rows[0].total)-Number(pending.rows[0].total);
    if(input.amountPaise>available)
      return res.status(400).json({error:'Insufficient available balance'});

    const duplicate=await query(`
      select id from withdrawals
      where partner_user_id=$1 and status='pending' and amount_paise=$2
      limit 1`,[req.user.id,input.amountPaise]);
    if(duplicate.rows[0])return res.status(409).json({error:'Matching withdrawal already pending'});

    const result=await query(`
      insert into withdrawals(partner_user_id,amount_paise,status)
      values($1,$2,'pending')
      returning id,amount_paise,status,requested_at`,
      [req.user.id,input.amountPaise]);

    await query(`
      insert into notifications(user_id,title,body)
      values($1,'Withdrawal requested','Your withdrawal request is pending CEO review.')`,
      [req.user.id]);

    await query(`
      insert into audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
      values($1,'WITHDRAWAL_REQUESTED','withdrawal',$2,$3)`,
      [req.user.id,result.rows[0].id,JSON.stringify({amountPaise:input.amountPaise})]);

    res.status(201).json({withdrawal:result.rows[0]});
  }catch(err){
    if(err.name==='ZodError')return res.status(400).json({error:'Invalid withdrawal request'});
    next(err);
  }
});

router.post('/referral/visit', async(req,res,next)=>{
  try{
    const schema=z.object({code:z.string().min(4).max(100),visitorToken:z.string().max(200).optional()});
    const input=schema.parse(req.body);
    const result=await query(
      `select id,partner_user_id from qr_codes
       where code=$1 and is_active=true`,[input.code]
    );
    if(!result.rows[0])return res.status(404).json({error:'Referral code not found'});
    await query(
      `insert into referral_visits(qr_code_id,partner_user_id,visitor_token)
       values($1,$2,$3)`,
      [result.rows[0].id,result.rows[0].partner_user_id,input.visitorToken||null]
    );
    res.json({tracked:true,partnerId:result.rows[0].partner_user_id});
  }catch(err){
    if(err.name==='ZodError')return res.status(400).json({error:'Invalid referral code'});
    next(err);
  }
});

export default router;
