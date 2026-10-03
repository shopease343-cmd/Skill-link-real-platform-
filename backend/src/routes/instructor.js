import { Router } from 'express';
import { z } from 'zod';
import { query } from '../lib/db.js';

const router=Router();
const instructorOnly=async(req,res,next)=>{
  const {requireAuth,requireRole}=await import('../middleware/auth.js');
  return requireAuth(req,res,()=>requireRole('instructor')(req,res,next));
};

const courseSchema=z.object({
  title:z.string().min(3).max(180),
  slug:z.string().min(3).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description:z.string().max(10000).nullable().optional(),
  pricePaise:z.number().int().min(0)
});

router.get('/dashboard',instructorOnly,async(req,res,next)=>{
  try{
    const [courses,masterclasses,workshops,students,sales]=await Promise.all([
      query(`select id,title,slug,status,price_paise,submitted_at,review_note,created_at
             from courses where instructor_id=$1 order by created_at desc`,[req.user.id]),
      query(`select id,title,price_paise,starts_at,status,submitted_at,review_note
             from masterclasses where instructor_id=$1 order by starts_at nulls last`,[req.user.id]),
      query(`select id,title,price_paise,starts_at,status,submitted_at,review_note
             from workshops where instructor_id=$1 order by starts_at nulls last`,[req.user.id]),
      query(`select count(distinct e.user_id)::int as count
             from enrollments e join courses c on c.id=e.course_id
             where c.instructor_id=$1`,[req.user.id]),
      query(`select count(*)::int as count,coalesce(sum(o.amount_paise),0)::bigint as amount
             from orders o join courses c on c.id=o.course_id
             where c.instructor_id=$1 and o.status='paid'`,[req.user.id])
    ]);
    res.json({
      courses:courses.rows,masterclasses:masterclasses.rows,workshops:workshops.rows,
      students:students.rows[0].count,sales:sales.rows[0]
    });
  }catch(err){next(err)}
});

router.post('/courses',instructorOnly,async(req,res,next)=>{
  try{
    const input=courseSchema.parse(req.body);
    const exists=await query('select id from courses where slug=$1',[input.slug]);
    if(exists.rows[0])return res.status(409).json({error:'Course slug already exists'});
    const result=await query(
      `insert into courses(instructor_id,title,slug,description,price_paise,status)
       values($1,$2,$3,$4,$5,'draft')
       returning id,title,slug,description,price_paise,status,created_at`,
      [req.user.id,input.title,input.slug,input.description||null,input.pricePaise]
    );
    await query(
      `insert into audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
       values($1,'INSTRUCTOR_COURSE_CREATED','course',$2,$3)`,
      [req.user.id,result.rows[0].id,JSON.stringify({title:input.title})]
    );
    res.status(201).json({course:result.rows[0]});
  }catch(err){
    if(err.name==='ZodError')return res.status(400).json({error:'Invalid course data'});
    next(err);
  }
});

router.patch('/courses/:id',instructorOnly,async(req,res,next)=>{
  try{
    const input=courseSchema.partial().parse(req.body);
    const current=await query(
      `select * from courses where id=$1 and instructor_id=$2`,[req.params.id,req.user.id]
    );
    if(!current.rows[0])return res.status(404).json({error:'Course not found'});
    const c=current.rows[0];

    if(c.status==='published')return res.status(400).json({error:'Published course must be managed through the approval process'});

    const result=await query(
      `update courses set title=$1,slug=$2,description=$3,price_paise=$4,updated_at=now()
       where id=$5 and instructor_id=$6
       returning id,title,slug,description,price_paise,status,updated_at`,
      [input.title??c.title,input.slug??c.slug,
       input.description===undefined?c.description:input.description,
       input.pricePaise??c.price_paise,req.params.id,req.user.id]
    );
    res.json({course:result.rows[0]});
  }catch(err){
    if(err.name==='ZodError')return res.status(400).json({error:'Invalid course data'});
    next(err);
  }
});

router.post('/courses/:id/lessons',instructorOnly,async(req,res,next)=>{
  try{
    const input=z.object({
      title:z.string().min(2).max(180),
      content:z.string().max(50000).optional(),
      sortOrder:z.number().int().min(0).default(0)
    }).parse(req.body);
    const owner=await query('select id,status from courses where id=$1 and instructor_id=$2',[req.params.id,req.user.id]);
    if(!owner.rows[0])return res.status(404).json({error:'Course not found'});
    if(owner.rows[0].status==='published')return res.status(400).json({error:'Published course cannot be edited here'});
    const result=await query(
      `insert into lessons(course_id,title,content,sort_order,is_published)
       values($1,$2,$3,$4,false)
       returning id,title,sort_order,is_published,created_at`,
      [req.params.id,input.title,input.content||null,input.sortOrder]
    );
    res.status(201).json({lesson:result.rows[0]});
  }catch(err){
    if(err.name==='ZodError')return res.status(400).json({error:'Invalid lesson data'});
    next(err);
  }
});

router.post('/courses/:id/submit',instructorOnly,async(req,res,next)=>{
  try{
    const owner=await query(
      `select id,status from courses where id=$1 and instructor_id=$2`,[req.params.id,req.user.id]
    );
    if(!owner.rows[0])return res.status(404).json({error:'Course not found'});
    if(!['draft','pending_approval'].includes(owner.rows[0].status))
      return res.status(400).json({error:'Course cannot be submitted in its current state'});

    const lessons=await query(
      `select count(*)::int as total from lessons where course_id=$1`,[req.params.id]
    );
    if(lessons.rows[0].total<1)return res.status(400).json({error:'Add at least one lesson before submitting'});

    const result=await query(
      `update courses set status='pending_approval',submitted_at=now(),review_note=null,updated_at=now()
       where id=$1 and instructor_id=$2
       returning id,status,submitted_at`,[req.params.id,req.user.id]
    );
    await query(
      `insert into audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
       values($1,'COURSE_SUBMITTED_FOR_APPROVAL','course',$2,'{}')`,
      [req.user.id,req.params.id]
    );
    res.json({course:result.rows[0]});
  }catch(err){next(err)}
});

router.post('/masterclasses',instructorOnly,async(req,res,next)=>{
  try{
    const input=z.object({
      title:z.string().min(3).max(180),description:z.string().max(10000).nullable().optional(),
      pricePaise:z.number().int().min(0),mode:z.enum(['live','recorded']).default('live'),
      startsAt:z.string().datetime().nullable().optional(),seats:z.number().int().positive().nullable().optional()
    }).parse(req.body);
    const result=await query(
      `insert into masterclasses(instructor_id,title,description,price_paise,mode,starts_at,seats,status)
       values($1,$2,$3,$4,$5,$6,$7,'draft')
       returning id,title,price_paise,mode,starts_at,seats,status`,
      [req.user.id,input.title,input.description||null,input.pricePaise,input.mode,input.startsAt||null,input.seats||null]
    );
    res.status(201).json({masterclass:result.rows[0]});
  }catch(err){
    if(err.name==='ZodError')return res.status(400).json({error:'Invalid masterclass data'});
    next(err);
  }
});

router.post('/workshops',instructorOnly,async(req,res,next)=>{
  try{
    const input=z.object({
      title:z.string().min(3).max(180),description:z.string().max(10000).nullable().optional(),
      pricePaise:z.number().int().min(0),startsAt:z.string().datetime().nullable().optional(),
      seats:z.number().int().positive().nullable().optional()
    }).parse(req.body);
    const result=await query(
      `insert into workshops(instructor_id,title,description,price_paise,starts_at,seats,status)
       values($1,$2,$3,$4,$5,$6,'draft')
       returning id,title,price_paise,starts_at,seats,status`,
      [req.user.id,input.title,input.description||null,input.pricePaise,input.startsAt||null,input.seats||null]
    );
    res.status(201).json({workshop:result.rows[0]});
  }catch(err){
    if(err.name==='ZodError')return res.status(400).json({error:'Invalid workshop data'});
    next(err);
  }
});

router.get('/students',instructorOnly,async(req,res,next)=>{
  try{
    const result=await query(`
      select distinct u.id,u.full_name,u.email,
        count(distinct e.id)::int as enrollments
      from users u
      join enrollments e on e.user_id=u.id
      join courses c on c.id=e.course_id
      where c.instructor_id=$1
      group by u.id
      order by u.full_name`,[req.user.id]);
    res.json({students:result.rows});
  }catch(err){next(err)}
});

export default router;
