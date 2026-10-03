-- SkillLink production foundation
-- Run this entire file in Supabase SQL Editor.
-- No real credentials are stored here.

create extension if not exists pgcrypto;

create type user_status as enum ('pending','active','suspended','disabled');
create type order_status as enum ('pending','paid','cancelled','refunded');
create type withdrawal_status as enum ('pending','approved','rejected','paid');

create table roles (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null
);

insert into roles(code,name) values
('ceo','CEO'),
('admin','Admin'),
('partner','Partner'),
('instructor','Instructor'),
('student','Student')
on conflict (code) do nothing;

create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text not null,
  password_hash text not null,
  status user_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table user_roles (
  user_id uuid not null references users(id) on delete cascade,
  role_id uuid not null references roles(id) on delete restrict,
  primary key(user_id, role_id)
);

create table permissions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  description text
);

create table role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key(role_id, permission_id)
);

create table packages (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text unique not null,
  subtitle text not null,
  description text,
  price_paise bigint not null check(price_paise >= 0),
  access_days integer,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into packages(code,name,subtitle,price_paise,display_order) values
('AARAMBH','Aarambh','Digital Foundation',49900,1),
('UDAAN','Udaan','Creative + Content Skills',99900,2),
('PRAGATI','Pragati','Marketing + Client Skills',199900,3),
('BRAHMASTRA','Brahmastra','Advanced Digital Skills',399900,4),
('SHIKHAR','Shikhar','Leadership + Business',699900,5)
on conflict (code) do nothing;

create table courses (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid references users(id) on delete set null,
  title text not null,
  slug text unique not null,
  description text,
  status text not null default 'draft' check(status in ('draft','pending_approval','published','archived')),
  price_paise bigint not null default 0 check(price_paise >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  title text not null,
  content text,
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  course_id uuid references courses(id) on delete cascade,
  package_id uuid references packages(id) on delete restrict,
  status text not null default 'active',
  enrolled_at timestamptz not null default now(),
  unique(user_id, course_id, package_id),
  check ((course_id is not null) or (package_id is not null))
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete restrict,
  package_id uuid references packages(id) on delete restrict,
  course_id uuid references courses(id) on delete restrict,
  amount_paise bigint not null check(amount_paise >= 0),
  status order_status not null default 'pending',
  referral_code text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  check ((package_id is not null) or (course_id is not null))
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid unique not null references orders(id) on delete restrict,
  provider text,
  provider_payment_id text unique,
  amount_paise bigint not null check(amount_paise >= 0),
  status text not null default 'created',
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table partners (
  user_id uuid primary key references users(id) on delete cascade,
  referral_code text unique not null,
  created_at timestamptz not null default now()
);

create table referrals (
  id uuid primary key default gen_random_uuid(),
  partner_user_id uuid not null references users(id) on delete restrict,
  referred_user_id uuid not null references users(id) on delete restrict,
  source text not null default 'link',
  created_at timestamptz not null default now(),
  unique(partner_user_id, referred_user_id)
);

create table commissions (
  id uuid primary key default gen_random_uuid(),
  partner_user_id uuid not null references users(id) on delete restrict,
  order_id uuid not null references orders(id) on delete restrict,
  amount_paise bigint not null check(amount_paise >= 0),
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique(partner_user_id, order_id)
);

create table earnings_ledger (
  id uuid primary key default gen_random_uuid(),
  partner_user_id uuid not null references users(id) on delete restrict,
  commission_id uuid references commissions(id) on delete restrict,
  entry_type text not null,
  amount_paise bigint not null,
  balance_after_paise bigint not null,
  created_at timestamptz not null default now()
);

create table withdrawals (
  id uuid primary key default gen_random_uuid(),
  partner_user_id uuid not null references users(id) on delete restrict,
  amount_paise bigint not null check(amount_paise > 0),
  status withdrawal_status not null default 'pending',
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references users(id) on delete set null,
  rejection_reason text
);

create table masterclasses (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid references users(id) on delete set null,
  title text not null,
  description text,
  price_paise bigint not null default 0 check(price_paise >= 0),
  mode text not null default 'live' check(mode in ('live','recorded')),
  starts_at timestamptz,
  seats integer check(seats is null or seats > 0),
  status text not null default 'draft'
);

create table workshops (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid references users(id) on delete set null,
  title text not null,
  description text,
  price_paise bigint not null default 0 check(price_paise >= 0),
  starts_at timestamptz,
  seats integer check(seats is null or seats > 0),
  status text not null default 'draft'
);

create table registrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  masterclass_id uuid references masterclasses(id) on delete cascade,
  workshop_id uuid references workshops(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  status text not null default 'registered',
  attendance_status text,
  created_at timestamptz not null default now(),
  check ((masterclass_id is not null) <> (workshop_id is not null))
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  course_id uuid references courses(id) on delete cascade,
  masterclass_id uuid references masterclasses(id) on delete cascade,
  workshop_id uuid references workshops(id) on delete cascade,
  rating integer not null check(rating between 1 and 5),
  body text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  course_id uuid references courses(id) on delete set null,
  issued_at timestamptz not null default now(),
  certificate_number text unique not null
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  subject text not null,
  message text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table levels (
  level_no integer primary key check(level_no between 1 and 9),
  points_required integer not null
);

insert into levels(level_no,points_required) values
(1,100),(2,250),(3,400),(4,500),(5,650),(6,800),(7,1000),(8,1500),(9,2000)
on conflict (level_no) do nothing;

create table user_progress (
  user_id uuid primary key references users(id) on delete cascade,
  points integer not null default 0 check(points >= 0),
  valid_referrals integer not null default 0 check(valid_referrals >= 0),
  current_level integer not null default 1 references levels(level_no),
  updated_at timestamptz not null default now()
);

create table rewards (
  id uuid primary key default gen_random_uuid(),
  level_no integer not null references levels(level_no),
  name text not null,
  description text,
  is_active boolean not null default true
);

create table reward_claims (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references rewards(id) on delete restrict,
  user_id uuid not null references users(id) on delete restrict,
  status text not null default 'eligible' check(status in ('eligible','pending','approved','rejected','fulfilled')),
  created_at timestamptz not null default now(),
  unique(reward_id,user_id)
);

create index idx_user_roles_user on user_roles(user_id);
create index idx_orders_user on orders(user_id);
create index idx_orders_status on orders(status);
create index idx_commissions_partner on commissions(partner_user_id);
create index idx_withdrawals_partner on withdrawals(partner_user_id);
create index idx_withdrawals_status on withdrawals(status);
create index idx_audit_logs_actor on audit_logs(actor_user_id);
create index idx_notifications_user on notifications(user_id);
create index idx_courses_status on courses(status);

-- Basic RLS posture. The application server uses the database connection
-- for controlled operations. Client-side Supabase access should not be used
-- for privileged operations.
alter table users enable row level security;
alter table user_roles enable row level security;
alter table roles enable row level security;
alter table orders enable row level security;
alter table payments enable row level security;
alter table commissions enable row level security;
alter table earnings_ledger enable row level security;
alter table withdrawals enable row level security;
alter table audit_logs enable row level security;

-- No permissive client policies are created here intentionally.
-- Privileged business operations remain server-side.

-- NOTE: A secure production deployment should also configure Supabase
-- Auth/RLS policies if direct client access is introduced later.
