import {Router} from 'express';
import {requireAuth,requireRole,requirePermission} from '../middleware/auth.js';
import {query} from '../lib/db.js';
const router=Router();
router.get('/users',requireAuth,requireRole('admin','ceo'),requirePermission('users.view'),async(req,res,next)=>{
 try {const result=await query('select id,full_name,email,status,created_at from users order by created_at desc limit 50');res.json({users:result.rows});}
 catch(e){next(e);}
});
export default router;
