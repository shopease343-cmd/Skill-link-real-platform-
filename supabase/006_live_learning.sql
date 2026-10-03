-- SkillLink Phase 8: Masterclasses + Workshops
-- Run after 001-005 migrations.

alter table masterclasses add column if not exists thumbnail_url text;
alter table masterclasses add column if not exists live_url text;
alter table masterclasses add column if not exists recording_url text;
alter table masterclasses add column if not exists certificate_enabled boolean not null default false;
alter table masterclasses add column if not exists reviewed_at timestamptz;
alter table masterclasses add column if not exists reviewed_by uuid references users(id) on delete set null;
alter table masterclasses add column if not exists review_note text;

alter table workshops add column if not exists thumbnail_url text;
alter table workshops add column if not exists live_url text;
alter table workshops add column if not exists recording_url text;
alter table workshops add column if not exists certificate_enabled boolean not null default false;
alter table workshops add column if not exists reviewed_at timestamptz;
alter table workshops add column if not exists reviewed_by uuid references users(id) on delete set null;
alter table workshops add column if not exists review_note text;

create table if not exists live_resources (
  id uuid primary key default gen_random_uuid(),
  masterclass_id uuid references masterclasses(id) on delete cascade,
  workshop_id uuid references workshops(id) on delete cascade,
  title text not null,
  resource_url text not null,
  resource_type text not null default 'link',
  created_at timestamptz not null default now(),
  check ((masterclass_id is not null) <> (workshop_id is not null))
);

create table if not exists live_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  masterclass_id uuid references masterclasses(id) on delete cascade,
  workshop_id uuid references workshops(id) on delete cascade,
  rating integer not null check(rating between 1 and 5),
  body text,
  created_at timestamptz not null default now(),
  check ((masterclass_id is not null) <> (workshop_id is not null))
);

create index if not exists idx_registrations_masterclass on registrations(masterclass_id);
create index if not exists idx_registrations_workshop on registrations(workshop_id);
create index if not exists idx_live_resources_masterclass on live_resources(masterclass_id);
create index if not exists idx_live_resources_workshop on live_resources(workshop_id);
