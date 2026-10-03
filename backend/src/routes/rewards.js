import {Router} from 'express';
import {z} from 'zod';
import {requireAuth,requireRole} from '../middleware/auth.js';
import {query} from '../lib/db.js';
const router=Router();

router.get('/available',requireAuth,async(req,res,next)=>{
  try{
    const p=await query(`select points from user_points where user_id=$1`,[req.user.id]);
    const points=Number(p.rows[0]?.points||0);
    const levels=await query(`select level_code,points_required from levels where active=true and points_required<=$1 order by points_required`,[points]);
    const r=await query(`select id,level_no,name,description,is_active from rewards where is_active=true and level_no=any($1::int[])`,[levels.rows.map(x=>x.level_no)]);
    res.json({points,rewards:r.rows});
  }catch(e){next(e)}
});
router.post('/:rewardId/claim',requireAuth,async(req,res,next)=>{
  try{
    const r=await query(`select * from rewards where id=$1 and active=true`,[req.params.rewardId]);
    if(!r.rows[0])return res.status(404).json({error:'Reward not found'});
    const p=await query(`select points from user_points where user_id=$1`,[req.user.id]);
    const level=await query(`select 1 from levels where level_code=$1 and points_required <= $2`,[r.rows[0].level_no,Number(p.rows[0]?.points||0)]);
    if(!level.rows[0])return res.status(403).json({error:'Reward eligibility not met'});
    const exists=await query(`select id from reward_claims where user_id=$1 and reward_id=$2 and status in ('pending','approved','processed')`,[req.user.id,req.params.rewardId]);
    if(exists.rows[0])return res.status(409).json({error:'Reward already claimed'});
    const claim=await query(`insert into reward_claims(user_id,reward_id,status) values($1,$2,'pending') returning id,status,created_at`,[req.user.id,req.params.rewardId]);
    await query(`insert into notifications(user_id,title,body) values($1,'Reward claim submitted','Your reward claim is pending review.')`,[req.user.id]);
    res.status(201).json({claim:claim.rows[0]});
  }catch(e){next(e)}
});
export default router;
