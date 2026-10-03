import {Router} from 'express';
import {z} from 'zod';
import {requireAuth,requireRole} from '../middleware/auth.js';
import {query} from '../lib/db.js';
const router=Router();

router.get('/mine',requireAuth,async(req,res,next)=>{
  try{
    const r=await query(`select id,title,body,read_at,created_at from notifications where user_id=$1 order by created_at desc limit 50`,[req.user.id]);
    res.json({notifications:r.rows});
  }catch(e){next(e)}
});
router.post('/:id/read',requireAuth,async(req,res,next)=>{
  try{
    const r=await query(`update notifications set read_at=now() where id=$1 and user_id=$2 returning id,read_at`,[req.params.id,req.user.id]);
    if(!r.rows[0])return res.status(404).json({error:'Notification not found'});
    res.json({notification:r.rows[0]});
  }catch(e){next(e)}
});
export default router;
