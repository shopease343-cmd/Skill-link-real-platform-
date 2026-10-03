import {Router} from 'express';
import {requireAuth} from '../middleware/auth.js';
import {query} from '../lib/db.js';
const router=Router();
router.get('/',requireAuth,async(req,res,next)=>{
 try {
  const result=await query(`select p.code from role_permissions rp join permissions p on p.id=rp.permission_id
   join user_roles ur on ur.role_id=rp.role_id where ur.user_id=$1 order by p.code`,[req.user.id]);
  res.json({user:{id:req.user.id,email:req.user.email,fullName:req.user.full_name,role:req.user.role_code,
   permissions:req.user.role_code==='ceo'?['*']:result.rows.map(r=>r.code)}});
 }catch(e){next(e);}
});
export default router;
