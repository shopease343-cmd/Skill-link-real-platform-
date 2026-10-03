-- SkillLink Phase 9: Commerce + verified payment + referral + commission + levels
-- Run after 001-006 migrations.

alter table orders add column if not exists course_id uuid references courses(id) on delete set null;
alter table orders add column if not exists package_id uuid references packages(id) on delete set null;
alter table orders add column if not exists referral_partner_id uuid references users(id) on delete set null;
alter table orders add column if not exists payment_reference text;
alter table orders add column if not exists verified_at timestamptz;
alter table orders add column if not exists refunded_at timestamptz;

alter table payments add column if not exists provider text;
alter table payments add column if not exists provider_payment_id text;
alter table payments add column if not exists verified_at timestamptz;

alter table referrals add column if not exists source_qr_id uuid references qr_codes(id) on delete set null;
alter table referrals add column if not exists order_id uuid references orders(id) on delete set null;
alter table referrals add column if not exists status text not null default 'attributed';

create table if not exists user_points (
  user_id uuid primary key references users(id) on delete cascade,
  points integer not null default 0 check(points >= 0),
  valid_referrals integer not null default 0 check(valid_referrals >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists levels (
  id uuid primary key default gen_random_uuid(),
  level_code text unique not null,
  points_required integer not null,
  referral_required integer not null default 0,
  skill_mastery_required integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists level_progress (
  user_id uuid primary key references users(id) on delete cascade,
  current_level text not null default 'L1',
  points integer not null default 0,
  valid_referrals integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into levels(level_code,points_required) values
('L1',100),('L2',250),('L3',400),('L4',500),('L5',650),
('L6',800),('L7',1000),('L8',1500),('L9',2000)
on conflict(level_code) do nothing;

create unique index if not exists idx_payments_provider_ref on payments(provider,provider_payment_id)
where provider_payment_id is not null;
create index if not exists idx_orders_referral_partner on orders(referral_partner_id);
create index if not exists idx_orders_payment_status on orders(status,verified_at);
create index if not exists idx_referrals_order on referrals(order_id);
