import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { query, pool } from '../lib/db.js';

const router=Router();

function amountIsValid(order, expected){
  return Number(order.amount_paise)===Number(expected);
}

async function calculateCommission(client, partnerId, packageId, courseId, orderAmount){
  if(!partnerId) return null;
  const rule=await client.query(`
    select id,commission_type,value
    from commission_rules
    where is_active=true and package_id=$1
    order by updated_at desc limit 1`,[packageId||null]);
  if(!rule.rows[0]) return null;
  const r=rule.rows[0];
  const commission=r.commission_type==='percent'
    ? Math.floor(orderAmount*Number(r.value)/100)
    : Math.floor(Number(r.value));
  if(commission<=0)return null;

  const c=await client.query(`
    insert into commissions(partner_user_id,order_id,amount_paise,status)
    values($1,$2,$3,'pending')
    returning id,amount_paise,status`,[partnerId,null,commission]);

  return {commissionId:c.rows[0].id,amountPaise:commission};
}

router.post('/orders',requireAuth,requireRole('student'),async(req,res,next)=>{
  try{
    const input=z.object({
      courseId:z.string().uuid().nullable().optional(),
      packageId:z.string().uuid().nullable().optional(),
      referralCode:z.string().max(100).nullable().optional()
    }).parse(req.body);

    if(Boolean(input.courseId)===Boolean(input.packageId))
      return res.status(400).json({error:'Choose exactly one course or package'});

    let item;
    if(input.courseId){
      const r=await query(`select id,price_paise,status from courses where id=$1 and status='published'`,[input.courseId]);
      if(!r.rows[0])return res.status(404).json({error:'Course not found'});
      item={courseId:r.rows[0].id,pricePaise:r.rows[0].price_paise};
    }else{
      const r=await query(`select id,price_paise,is_active from packages where id=$1`,[input.packageId]);
      if(!r.rows[0]||!r.rows[0].is_active)return res.status(404).json({error:'Package not found'});
      item={packageId:r.rows[0].id,pricePaise:r.rows[0].price_paise};
    }

    let partnerId=null,qrId=null;
    if(input.referralCode){
      const ref=await query(`select id,partner_user_id from qr_codes where code=$1 and is_active=true`,[input.referralCode]);
      if(ref.rows[0]&&ref.rows[0].partner_user_id!==req.user.id){
        partnerId=ref.rows[0].partner_user_id;qrId=ref.rows[0].id;
      }
    }

    const result=await query(`
      insert into orders(user_id,course_id,package_id,amount_paise,status,referral_partner_id)
      values($1,$2,$3,$4,'pending',$5)
      returning id,amount_paise,status,created_at`,
      [req.user.id,item.courseId||null,item.packageId||null,item.pricePaise,partnerId]
    );
    if(partnerId){
      await query(`
        insert into referrals(partner_user_id,referred_user_id,source_qr_id,order_id,status)
        values($1,$2,$3,$4,'attributed')`,
        [partnerId,req.user.id,qrId,result.rows[0].id]
      );
    }
    res.status(201).json({order:result.rows[0]});
  }catch(err){
    if(err.name==='ZodError')return res.status(400).json({error:'Invalid order request'});
    next(err);
  }
});

/* Server-side verification boundary. A real provider adapter must verify
   the provider signature/status before invoking this event logic. */
router.post('/payments/provider-webhook',async(req,res,next)=>{
  const client=await pool.connect();
  try{
    const schema=z.object({
      provider:z.string().min(2).max(50),
      providerPaymentId:z.string().min(2).max(200),
      orderId:z.string().uuid(),
      amountPaise:z.number().int().positive(),
      event:z.enum(['payment_verified','payment_refunded']),
      signatureVerified:z.boolean()
    });
    const input=schema.parse(req.body);
    if(!input.signatureVerified)
      return res.status(401).json({error:'Payment signature verification failed'});

    await client.query('begin');
    const order=await client.query(`select * from orders where id=$1 for update`,[input.orderId]);
    if(!order.rows[0]){await client.query('rollback');return res.status(404).json({error:'Order not found'})}
    if(!amountIsValid(order.rows[0],input.amountPaise)){
      await client.query('rollback');return res.status(400).json({error:'Payment amount mismatch'});
    }

    if(input.event==='payment_verified'){
      if(order.rows[0].status==='paid'){
        await client.query('commit');
        return res.json({ok:true,idempotent:true});
      }

      await client.query(`
        insert into payments(order_id,amount_paise,status,provider,provider_payment_id,verified_at)
        values($1,$2,'verified',$3,$4,now())
        on conflict(provider,provider_payment_id) do nothing`,
        [input.orderId,input.amountPaise,input.provider,input.providerPaymentId]
      );

      await client.query(`
        update orders set status='paid',payment_reference=$1,verified_at=now()
        where id=$2`,[input.providerPaymentId,input.orderId]);

      if(order.rows[0].course_id){
        await client.query(`
          insert into enrollments(user_id,course_id,status,enrolled_at)
          values($1,$2,'active',now())
          on conflict do nothing`,
          [order.rows[0].user_id,order.rows[0].course_id]
        );
      }else if(order.rows[0].package_id){
        const courses=await client.query(`
          select course_id from package_courses pc
          join courses c on c.id=pc.course_id
          where pc.package_id=$1 and c.status='published'`,[order.rows[0].package_id]);
        for(const c of courses.rows){
          await client.query(`
            insert into enrollments(user_id,course_id,package_id,status,enrolled_at)
            values($1,$2,$3,'active',now())
            on conflict do nothing`,
            [order.rows[0].user_id,c.course_id,order.rows[0].package_id]
          );
        }
      }

      const partnerId=order.rows[0].referral_partner_id;
      if(partnerId){
        const comm=await client.query(`
          select cr.id,cr.commission_type,cr.value
          from commission_rules cr
          where cr.is_active=true and cr.package_id=$1
          order by cr.updated_at desc limit 1`,[order.rows[0].package_id||null]);
        if(comm.rows[0]){
          const r=comm.rows[0];
          const amount=r.commission_type==='percent'
            ? Math.floor(Number(order.rows[0].amount_paise)*Number(r.value)/100)
            : Math.floor(Number(r.value));
          if(amount>0){
            const created=await client.query(`
              insert into commissions(partner_user_id,order_id,amount_paise,status)
              values($1,$2,$3,'pending')
              on conflict do nothing
              returning id,amount_paise`,[partnerId,input.orderId,amount]);
            if(created.rows[0]){
              const running=await client.query(`
                select coalesce(sum(amount_paise),0)::bigint as balance
                from earnings_ledger where partner_user_id=$1`,[partnerId]);
              const after=Number(running.rows[0].balance)+amount;
              await client.query(`
                insert into earnings_ledger(partner_user_id,commission_id,entry_type,amount_paise,balance_after_paise)
                values($1,$2,'commission',$3,$4)`,
                [partnerId,created.rows[0].id,amount,after]
              );
            }
          }
        }
        await client.query(`update referrals set status='qualified' where order_id=$1`,[input.orderId]);
      }

      await client.query(`
        insert into user_points(user_id,points)
        values($1,10)
        on conflict(user_id) do update set points=user_points.points+10,updated_at=now()`,
        [order.rows[0].user_id]
      );
    }else{
      await client.query(`update orders set status='refunded',refunded_at=now() where id=$1`,[input.orderId]);
      await client.query(`update commissions set status='reversed' where order_id=$1 and status<>'reversed'`,[input.orderId]);
      await client.query(`update referrals set status='reversed' where order_id=$1`,[input.orderId]);
    }

    await client.query(`
      insert into audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
      values($1,$2,'order',$3,$4)`,
      [order.rows[0].user_id,
       input.event==='payment_verified'?'PAYMENT_VERIFIED':'PAYMENT_REFUNDED',
       input.orderId,JSON.stringify({provider:input.provider,providerPaymentId:input.providerPaymentId})]
    );
    await client.query('commit');
    res.json({ok:true});
  }catch(err){
    try{await client.query('rollback')}catch{}
    if(err.name==='ZodError')return res.status(400).json({error:'Invalid provider event'});
    next(err);
  }finally{client.release()}
});

router.get('/orders/:id',requireAuth,async(req,res,next)=>{
  try{
    const r=await query(`select id,user_id,course_id,package_id,amount_paise,status,verified_at from orders where id=$1`,[req.params.id]);
    if(!r.rows[0])return res.status(404).json({error:'Order not found'});
    if(r.rows[0].user_id!==req.user.id && !['ceo','admin'].includes(req.user.role_code))
      return res.status(403).json({error:'Forbidden'});
    res.json({order:r.rows[0]});
  }catch(err){next(err)}
});

router.get('/levels/me',requireAuth,async(req,res,next)=>{
  try{
    const p=await query(`select * from user_points where user_id=$1`,[req.user.id]);
    const points=Number(p.rows[0]?.points||0), refs=Number(p.rows[0]?.valid_referrals||0);
    const level=await query(`
      select level_code,points_required,referral_required,skill_mastery_required
      from levels where active=true and points_required<=$1 and referral_required<=$2
      order by points_required desc limit 1`,[points,refs]);
    res.json({points,validReferrals:refs,currentLevel:level.rows[0]?.level_code||'L1',level:level.rows[0]||null});
  }catch(err){next(err)}
});

export default router;
