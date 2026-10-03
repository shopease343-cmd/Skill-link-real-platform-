import { Router } from 'express';
import { z } from 'zod';
import { pool,query } from '../lib/db.js';
import { hashPassword,verifyPassword,createSession } from '../lib/auth.js';
import { requireAuth } from '../middleware/auth.js';
const router=Router();
const signupSchema=z.object({email:z.email().max(255),password:z.string().min(10).max(72),fullName:z.string().trim().min(2).max(120)}).strict();
const loginSchema=z.object({email:z.email().max(255),password:z.string().min(1)});
function safeUser(u){return {id:u.id,email:u.email,fullName:u.full_name,role:u.role_code};}
router.post('/signup',async(req,res,next)=>{
 let client;
 try {
  const input=signupSchema.parse(req.body);client=await pool.connect();
  const passwordHash=await hashPassword(input.password);
  await client.query('BEGIN');
  const result=await client.query(`insert into users(email,full_name,password_hash)
   values($1,$2,$3) returning id,email,full_name`,[input.email.trim().toLowerCase(),input.fullName,passwordHash]);
  const u=result.rows[0];
  const assigned=await client.query(`insert into user_roles(user_id,role_id)
   select $1,id from roles where code='student' returning user_id`,[u.id]);
  if(assigned.rowCount!==1) throw new Error('Student role not configured');
  const token=await createSession(client,u);
  await client.query('COMMIT');
  res.status(201).json({user:{...safeUser({...u,role_code:'student'})},accessToken:token});
 } catch(e) {
  if(client) await client.query('ROLLBACK').catch(()=>{});
  if(e.code==='23505') return res.status(409).json({error:'Account already exists'});
  if(e instanceof z.ZodError) return res.status(400).json({error:'Invalid signup data',details:e.issues.map(x=>({field:x.path.join('.'),message:x.message}))});
  next(e);
 } finally {if(client) client.release();}
});
router.post('/login',async(req,res,next)=>{
 let client;
 try {
  const input=loginSchema.parse(req.body);
  const result=await query(`select u.id,u.email,u.full_name,u.password_hash,u.status,r.code as role_code
   from users u join user_roles ur on ur.user_id=u.id join roles r on r.id=ur.role_id
   where u.email=$1`,[input.email.trim().toLowerCase()]);
  const u=result.rows[0];
  if(!u || u.status!=='active' || !await verifyPassword(input.password,u.password_hash))
   return res.status(401).json({error:'Invalid credentials'});
  client=await pool.connect();
  const token=await createSession(client,u);
  res.json({user:safeUser(u),accessToken:token});
 } catch(e){if(e instanceof z.ZodError) return res.status(400).json({error:'Invalid login data'});next(e);}
 finally {if(client)client.release();}
});
router.post('/logout',requireAuth,async(req,res,next)=>{
 try {await query('update auth_sessions set revoked_at=now() where id=$1 and user_id=$2',[req.user.session_id,req.user.id]);res.json({ok:true});}
 catch(e){next(e);}
});
export default router;
