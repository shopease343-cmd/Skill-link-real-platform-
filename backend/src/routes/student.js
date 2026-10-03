import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { query } from '../lib/db.js';

const router=Router();
const studentOnly=[requireAuth,requireRole('student')];

router.get('/catalog',...studentOnly,async(req,res,next)=>{
  try{
    const [courses,packages]=await Promise.all([
      query(`select id,title,slug,description,price_paise,instructor_id
             from student_course_catalog order by title asc`),
      query(`select * from student_package_catalog order by display_order asc`)
    ]);
    res.json({courses:courses.rows,packages:packages.rows});
  }catch(err){next(err)}
});

router.get('/learning',...studentOnly,async(req,res,next)=>{
  try{
    const result=await query(`
      select e.id,e.status,e.progress_percent,e.enrolled_at,e.expires_at,e.completed_at,
             c.id as course_id,c.title,c.slug,c.description,
             p.id as package_id,p.name as package_name
      from enrollments e
      left join courses c on c.id=e.course_id
      left join packages p on p.id=e.package_id
      where e.user_id=$1
      order by e.enrolled_at desc
    `,[req.user.id]);
    res.json({enrollments:result.rows});
  }catch(err){next(err)}
});

router.get('/courses/:id',...studentOnly,async(req,res,next)=>{
  try{
    const course=await query(
      `select id,title,slug,description,price_paise,status,instructor_id
       from courses where id=$1 and status='published'`,[req.params.id]
    );
    if(!course.rows[0])return res.status(404).json({error:'Course not found'});
    const lessons=await query(
      `select id,title,sort_order from lessons
       where course_id=$1 and is_published=true order by sort_order asc`,[req.params.id]
    );
    const enrolled=await query(
      `select id,progress_percent from enrollments
       where user_id=$1 and course_id=$2 and status='active' limit 1`,
      [req.user.id,req.params.id]
    );
    res.json({course:course.rows[0],lessons:lessons.rows,enrollment:enrolled.rows[0]||null});
  }catch(err){next(err)}
});

router.post('/lessons/:lessonId/complete',...studentOnly,async(req,res,next)=>{
  try{
    const lesson=await query(
      `select id,course_id from lessons where id=$1 and is_published=true`,[req.params.lessonId]
    );
    if(!lesson.rows[0])return res.status(404).json({error:'Lesson not found'});

    const enrollment=await query(
      `select id from enrollments
       where user_id=$1 and course_id=$2 and status='active'
       limit 1`,[req.user.id,lesson.rows[0].course_id]
    );
    if(!enrollment.rows[0])return res.status(403).json({error:'Course is not enrolled'});

    await query(
      `insert into lesson_progress(user_id,lesson_id,completed_at)
       values($1,$2,now())
       on conflict(user_id,lesson_id)
       do update set completed_at=now()`,
      [req.user.id,req.params.lessonId]
    );

    const counts=await query(
      `select count(*)::int as total,
              count(lp.lesson_id)::int as completed
       from lessons l
       left join lesson_progress lp
         on lp.lesson_id=l.id and lp.user_id=$1
       where l.course_id=$2 and l.is_published=true`,
      [req.user.id,lesson.rows[0].course_id]
    );
    const total=counts.rows[0].total;
    const completed=counts.rows[0].completed;
    const progress=total?Math.round((completed/total)*10000)/100:0;

    await query(
      `update enrollments set progress_percent=$1,
         completed_at=case when $1>=100 then now() else null end
       where id=$2`,[progress,enrollment.rows[0].id]
    );

    res.json({progressPercent:progress});
  }catch(err){next(err)}
});

router.get('/orders',...studentOnly,async(req,res,next)=>{
  try{
    const result=await query(`
      select o.id,o.amount_paise,o.status,o.created_at,o.paid_at,
             p.name as package_name,c.title as course_title
      from orders o
      left join packages p on p.id=o.package_id
      left join courses c on c.id=o.course_id
      where o.user_id=$1 order by o.created_at desc limit 100
    `,[req.user.id]);
    res.json({orders:result.rows});
  }catch(err){next(err)}
});

router.get('/certificates',...studentOnly,async(req,res,next)=>{
  try{
    const result=await query(
      `select id,certificate_number,issued_at,course_id
       from certificates where user_id=$1 order by issued_at desc`,[req.user.id]
    );
    res.json({certificates:result.rows});
  }catch(err){next(err)}
});

router.get('/profile',...studentOnly,async(req,res)=>{
  res.json({user:{
    id:req.user.id,email:req.user.email,fullName:req.user.full_name,role:req.user.role_code
  }});
});

export default router;
