import {Router} from 'express';
import {requireAuth,requireRole,requirePermission} from '../middleware/auth.js';
const router=Router();
for(const role of ['ceo','admin','partner','instructor','student']){
 router.get('/'+role,requireAuth,requireRole(role),(req,res)=>res.json({role,userId:req.user.id,message:'Authenticated '+role+' dashboard foundation'}));
}
router.get('/admin/reports',requireAuth,requireRole('admin','ceo'),requirePermission('reports.view'),(req,res)=>res.json({message:'Authorized for reports; reports data not yet implemented'}));
export default router;
