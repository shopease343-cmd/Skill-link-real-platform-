-- SkillLink Phase 7: Course + Package system
-- Run after 001-004 migrations.

create table if not exists package_courses (
  package_id uuid not null references packages(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  sort_order integer not null default 0,
  primary key(package_id, course_id)
);

create table if not exists course_skills (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  skill_name text not null,
  created_at timestamptz not null default now(),
  unique(course_id, skill_name)
);

create table if not exists course_resources (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  title text not null,
  resource_url text not null,
  resource_type text not null default 'link',
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists course_quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  title text not null,
  passing_score integer not null default 70 check(passing_score between 0 and 100),
  is_published boolean not null default false
);

create table if not exists course_quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references course_quizzes(id) on delete cascade,
  question text not null,
  options jsonb not null,
  correct_option_index integer not null check(correct_option_index >= 0)
);

create index if not exists idx_package_courses_course on package_courses(course_id);
create index if not exists idx_course_skills_course on course_skills(course_id);
create index if not exists idx_course_resources_course on course_resources(course_id);

-- Prevent package access from depending on an unpublished course.
-- Enforcement is performed in backend enrollment logic.
