-- SkillLink Phase 5: Student / Client system
-- Run after 001_initial_schema.sql and 002_partner_system.sql.

alter table enrollments
  add column if not exists progress_percent numeric(5,2) not null default 0
  check(progress_percent between 0 and 100);

alter table enrollments
  add column if not exists completed_at timestamptz;

alter table enrollments
  add column if not exists expires_at timestamptz;

create table if not exists lesson_progress (
  user_id uuid not null references users(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  completed_at timestamptz,
  primary key(user_id, lesson_id)
);

create table if not exists quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  score numeric(6,2) not null check(score between 0 and 100),
  passed boolean not null default false,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_enrollments_user on enrollments(user_id);
create index if not exists idx_lesson_progress_user on lesson_progress(user_id);
create index if not exists idx_quiz_attempts_user on quiz_attempts(user_id);

-- A safe student-facing view. It exposes only published course/package data.
create or replace view student_course_catalog as
select
  c.id, c.title, c.slug, c.description, c.price_paise,
  c.instructor_id, c.status
from courses c
where c.status='published';

create or replace view student_package_catalog as
select
  id, code, name, subtitle, description, price_paise,
  access_days, is_active, is_featured, display_order
from packages
where is_active=true;
