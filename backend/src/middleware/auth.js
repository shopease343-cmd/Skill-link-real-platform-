import { verifyAccessToken } from '../lib/auth.js';
import { query } from '../lib/db.js';
export async function requireAuth(req,res,next) {
 try {
  const header=req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return res.status(401).json({error:'Authentication required'});
  const payload=verifyAccessToken(header.slice(7));
  if (!payload.sid) return res.status(401).json({error:'Session is no longer valid'});
  const result=await query(`select u.id,u.email,u.full_name,r.code as role_code,s.id as session_id
   from auth_sessions s join users u on u.id=s.user_id
   join user_roles ur on ur.user_id=u.id join roles r on r.id=ur.role_id
   where s.id=$1 and u.id=$2 and s.revoked_at is null and s.expires_at>now() and u.status='active'`,[payload.sid,payload.sub]);
  if (!result.rows[0]) return res.status(401).json({error:'Session expired or revoked'});
  req.user=result.rows[0];next();
 } catch(e) { if (e.code) return next(e); return res.status(401).json({error:'Invalid or expired session'}); }
}
export function requireRole(...roles) {
 return (req,res,next)=>req.user && roles.includes(req.user.role_code)?next():res.status(403).json({error:'Forbidden'});
}
export function requirePermission(permission) {
 return async(req,res,next)=>{
  if (!req.user) return res.status(401).json({error:'Authentication required'});
  if(req.user.role_code==='ceo') return next();
  try {
   const found=await query(`select 1 from user_roles ur join role_permissions rp on rp.role_id=ur.role_id
     join permissions p on p.id=rp.permission_id where ur.user_id=$1 and p.code=$2 limit 1`,[req.user.id,permission]);
   if (!found.rowCount) return res.status(403).json({error:'Permission denied'});
   next();
  } catch(e){next(e);}
 };
}
