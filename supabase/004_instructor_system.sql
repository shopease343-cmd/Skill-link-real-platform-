-- SkillLink Phase 6: Instructor system
-- Run after 001_initial_schema.sql, 002_partner_system.sql and 003_student_system.sql.

alter table courses
  add column if not exists submitted_at timestamptz;

alter table courses
  add column if not exists reviewed_at timestamptz;

alter table courses
  add column if not exists reviewed_by uuid references users(id) on delete set null;

alter table courses
  add column if not exists review_note text;

alter table masterclasses
  add column if not exists submitted_at timestamptz;

alter table masterclasses
  add column if not exists reviewed_at timestamptz;

alter table masterclasses
  add column if not exists reviewed_by uuid references users(id) on delete set null;

alter table masterclasses
  add column if not exists review_note text;

alter table workshops
  add column if not exists submitted_at timestamptz;

alter table workshops
  add column if not exists reviewed_at timestamptz;

alter table workshops
  add column if not exists reviewed_by uuid references users(id) on delete set null;

alter table workshops
  add column if not exists review_note text;

create index if not exists idx_courses_instructor on courses(instructor_id);
create index if not exists idx_masterclasses_instructor on masterclasses(instructor_id);
create index if not exists idx_workshops_instructor on workshops(instructor_id);
create index if not exists idx_courses_review on courses(status,submitted_at);

-- Instructor can never directly change status to published through the
-- instructor API. Publication remains a review/approval operation.
