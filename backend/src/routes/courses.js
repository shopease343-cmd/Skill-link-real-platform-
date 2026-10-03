import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { query } from '../lib/db.js';

const router=Router();

router.get('/public',async(req,res,next)=>{
  try{
    const result=await query(`
      select c.id,c.title,c.slug,c.description,c.price_paise,c.instructor_id,
             coalesce(array_agg(pc.package_id) filter(where pc.package_id is not null),'{}') as package_ids
      from courses c
      left join package_courses pc on pc.course_id=c.id
      where c.status='published'
      group by c.id
      order by c.title`);
    res.json({courses:result.rows});
  }catch(err){next(err)}
});

router.get('/:id',async(req,res,next)=>{
  try{
    const course=await query(`
      select c.id,c.title,c.slug,c.description,c.price_paise,c.instructor_id,
             u.full_name as instructor_name
      from courses c
      left join users u on u.id=c.instructor_id
      where c.id=$1 and c.status='published'`,[req.params.id]);
    if(!course.rows[0])return res.status(404).json({error:'Course not found'});
    const [lessons,skills,resources,packages]=await Promise.all([
      query(`select id,title,sort_order from lessons where course_id=$1 and is_published=true order by sort_order`,[req.params.id]),
      query(`select skill_name from course_skills where course_id=$1 order by skill_name`,[req.params.id]),
      query(`select id,title,resource_type from course_resources where course_id=$1 and is_published=true`,[req.params.id]),
      query(`select p.id,p.name,p.price_paise from package_courses pc join packages p on p.id=pc.package_id where pc.course_id=$1 and p.is_active=true order by p.display_order`,[req.params.id])
    ]);
    res.json({course:course.rows[0],lessons:lessons.rows,skills:skills.rows,resources:resources.rows,packages:packages.rows});
  }catch(err){next(err)}
});

router.get('/packages/:packageId',async(req,res,next)=>{
  try{
    const pkg=await query(`select id,name,subtitle,description,price_paise,access_days,is_featured from packages where id=$1 and is_active=true`,[req.params.packageId]);
    if(!pkg.rows[0])return res.status(404).json({error:'Package not found'});
    const courses=await query(`
      select c.id,c.title,c.slug,c.description,c.price_paise,pc.sort_order
      from package_courses pc join courses c on c.id=pc.course_id
      where pc.package_id=$1 and c.status='published'
      order by pc.sort_order,c.title`,[req.params.packageId]);
    res.json({package:pkg.rows[0],courses:courses.rows});
  }catch(err){next(err)}
});

const ceo=[requireAuth,requireRole('ceo')];

router.put('/packages/:packageId/courses',...ceo,async(req,res,next)=>{
  const client=await (await import('../lib/db.js')).pool.connect();
  try{
    const schema=z.object({courseIds:z.array(z.string().uuid()).max(100)});
    const {courseIds}=schema.parse(req.body);
    await client.query('begin');
    const pkg=await client.query(`select id from packages where id=$1`,[req.params.packageId]);
    if(!pkg.rows[0]){await client.query('rollback');return res.status(404).json({error:'Package not found'})}

    const valid=await client.query(
      `select id from courses where id=any($1::uuid[]) and status='published'`,[courseIds]
    );
    const validIds=new Set(valid.rows.map(r=>r.id));
    if(valid.rows.length!==courseIds.length){
      await client.query('rollback');
      return res.status(400).json({error:'Only published courses can be included in a package'});
    }

    await client.query(`delete from package_courses where package_id=$1`,[req.params.packageId]);
    for(let i=0;i<courseIds.length;i++){
      await client.query(
        `insert into package_courses(package_id,course_id,sort_order) values($1,$2,$3)`,
        [req.params.packageId,courseIds[i],i]
      );
    }
    await client.query(
      `insert into audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
       values($1,'PACKAGE_COURSES_UPDATED','package',$2,$3)`,
      [req.user.id,req.params.packageId,JSON.stringify({courseIds})]
    );
    await client.query('commit');
    res.json({updated:true,count:courseIds.length});
  }catch(err){
    await client.query('rollback');
    if(err.name==='ZodError')return res.status(400).json({error:'Invalid course IDs'});
    next(err);
  }finally{client.release()}
});

router.post('/:courseId/skills',...ceo,async(req,res,next)=>{
  try{
    const input=z.object({skillName:z.string().min(2).max(120)}).parse(req.body);
    const result=await query(`insert into course_skills(course_id,skill_name) values($1,$2) on conflict do nothing returning *`,[req.params.courseId,input.skillName]);
    if(!result.rows[0])return res.status(409).json({error:'Skill already exists'});
    res.status(201).json({skill:result.rows[0]});
  }catch(err){
    if(err.name==='ZodError')return res.status(400).json({error:'Invalid skill'});
    next(err);
  }
});

export default router;
