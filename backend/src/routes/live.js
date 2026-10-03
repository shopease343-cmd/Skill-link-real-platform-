import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { query, pool } from '../lib/db.js';

const router=Router();

router.get('/catalog',async(req,res,next)=>{
  try{
    const [masterclasses,workshops]=await Promise.all([
      query(`select id,title,description,price_paise,mode,starts_at,seats,certificate_enabled,thumbnail_url
             from masterclasses where status='published' order by starts_at nulls last`),
      query(`select id,title,description,price_paise,starts_at,seats,certificate_enabled,thumbnail_url
             from workshops where status='published' order by starts_at nulls last`)
    ]);
    res.json({masterclasses:masterclasses.rows,workshops:workshops.rows});
  }catch(err){next(err)}
});

router.post('/masterclasses/:id/register',requireAuth,requireRole('student'),async(req,res,next)=>{
  const client=await pool.connect();
  try{
    await client.query('begin');
    const mc=await client.query(
      `select id,price_paise,seats,status from masterclasses where id=$1 for update`,[req.params.id]
    );
    if(!mc.rows[0]||mc.rows[0].status!=='published'){await client.query('rollback');return res.status(404).json({error:'Masterclass not found'})}
    const existing=await client.query(
      `select id,status from registrations where user_id=$1 and masterclass_id=$2`,[req.user.id,req.params.id]
    );
    if(existing.rows[0]){await client.query('rollback');return res.status(409).json({error:'Already registered'})}
    if(mc.rows[0].seats){
      const count=await client.query(`select count(*)::int as count from registrations where masterclass_id=$1 and status='registered'`,[req.params.id]);
      if(count.rows[0].count>=mc.rows[0].seats){await client.query('rollback');return res.status(409).json({error:'No seats available'})}
    }
    // Paid registrations create a pending order. They do not grant access until payment verification.
    if(Number(mc.rows[0].price_paise)>0){
      const order=await client.query(
        `insert into orders(user_id,amount_paise,status) values($1,$2,'pending') returning id`,
        [req.user.id,mc.rows[0].price_paise]
      );
      const reg=await client.query(
        `insert into registrations(user_id,masterclass_id,order_id,status) values($1,$2,$3,'pending_payment')
         returning id,status`,[req.user.id,req.params.id,order.rows[0].id]
      );
      await client.query('commit');
      return res.status(201).json({registration:reg.rows[0],orderId:order.rows[0].id,paymentRequired:true});
    }
    const reg=await client.query(
      `insert into registrations(user_id,masterclass_id,status) values($1,$2,'registered') returning id,status`,
      [req.user.id,req.params.id]
    );
    await client.query('commit');
    res.status(201).json({registration:reg.rows[0],paymentRequired:false});
  }catch(err){await client.query('rollback');next(err)}
  finally{client.release()}
});

router.post('/workshops/:id/register',requireAuth,requireRole('student'),async(req,res,next)=>{
  const client=await pool.connect();
  try{
    await client.query('begin');
    const w=await client.query(`select id,price_paise,seats,status from workshops where id=$1 for update`,[req.params.id]);
    if(!w.rows[0]||w.rows[0].status!=='published'){await client.query('rollback');return res.status(404).json({error:'Workshop not found'})}
    const existing=await client.query(`select id from registrations where user_id=$1 and workshop_id=$2`,[req.user.id,req.params.id]);
    if(existing.rows[0]){await client.query('rollback');return res.status(409).json({error:'Already registered'})}
    if(w.rows[0].seats){
      const count=await client.query(`select count(*)::int as count from registrations where workshop_id=$1 and status='registered'`,[req.params.id]);
      if(count.rows[0].count>=w.rows[0].seats){await client.query('rollback');return res.status(409).json({error:'No seats available'})}
    }
    if(Number(w.rows[0].price_paise)>0){
      const order=await client.query(`insert into orders(user_id,amount_paise,status) values($1,$2,'pending') returning id`,[req.user.id,w.rows[0].price_paise]);
      const reg=await client.query(
        `insert into registrations(user_id,workshop_id,order_id,status) values($1,$2,$3,'pending_payment') returning id,status`,
        [req.user.id,req.params.id,order.rows[0].id]
      );
      await client.query('commit');
      return res.status(201).json({registration:reg.rows[0],orderId:order.rows[0].id,paymentRequired:true});
    }
    const reg=await client.query(`insert into registrations(user_id,workshop_id,status) values($1,$2,'registered') returning id,status`,[req.user.id,req.params.id]);
    await client.query('commit');
    res.status(201).json({registration:reg.rows[0],paymentRequired:false});
  }catch(err){await client.query('rollback');next(err)}
  finally{client.release()}
});

router.post('/registration/:id/attendance',requireAuth,requireRole('ceo','admin','instructor'),async(req,res,next)=>{
  try{
    const input=z.object({status:z.enum(['present','absent','late'])}).parse(req.body);
    const r=await query(`select id,masterclass_id,workshop_id from registrations where id=$1`,[req.params.id]);
    if(!r.rows[0])return res.status(404).json({error:'Registration not found'});
    // Instructor ownership check
    if(req.user.role_code==='instructor'){
      const owner=await query(`
        select 1 from registrations r
        left join masterclasses m on m.id=r.masterclass_id
        left join workshops w on w.id=r.workshop_id
        where r.id=$1 and (m.instructor_id=$2 or w.instructor_id=$2)`,[req.params.id,req.user.id]);
      if(!owner.rows[0])return res.status(403).json({error:'Not your event'});
    }
    const updated=await query(`update registrations set attendance_status=$1 where id=$2 returning id,attendance_status`,[input.status,req.params.id]);
    res.json({registration:updated.rows[0]});
  }catch(err){
    if(err.name==='ZodError')return res.status(400).json({error:'Invalid attendance status'});
    next(err)
  }
});

router.get('/mine',requireAuth,requireRole('student'),async(req,res,next)=>{
  try{
    const result=await query(`
      select r.id,r.status,r.attendance_status,r.created_at,
        m.title as masterclass_title,m.starts_at as masterclass_starts_at,
        w.title as workshop_title,w.starts_at as workshop_starts_at
      from registrations r
      left join masterclasses m on m.id=r.masterclass_id
      left join workshops w on w.id=r.workshop_id
      where r.user_id=$1 order by r.created_at desc`,[req.user.id]);
    res.json({registrations:result.rows});
  }catch(err){next(err)}
});

router.post('/feedback',requireAuth,requireRole('student'),async(req,res,next)=>{
  try{
    const input=z.object({
      masterclassId:z.string().uuid().nullable().optional(),
      workshopId:z.string().uuid().nullable().optional(),
      rating:z.number().int().min(1).max(5),
      body:z.string().max(3000).optional()
    }).parse(req.body);
    if(Boolean(input.masterclassId)===Boolean(input.workshopId))return res.status(400).json({error:'Choose exactly one event'});
    const column=input.masterclassId?'masterclass_id':'workshop_id';
    const id=input.masterclassId||input.workshopId;
    const owns=await query(
      `select id from registrations where user_id=$1 and ${column}=$2 and status='registered'`,[req.user.id,id]
    );
    if(!owns.rows[0])return res.status(403).json({error:'Registration required'});
    const result=await query(
      `insert into live_feedback(user_id,${column},rating,body) values($1,$2,$3,$4) returning *`,
      [req.user.id,id,input.rating,input.body||null]
    );
    res.status(201).json({feedback:result.rows[0]});
  }catch(err){
    if(err.name==='ZodError')return res.status(400).json({error:'Invalid feedback'});
    next(err)
  }
});

export default router;
