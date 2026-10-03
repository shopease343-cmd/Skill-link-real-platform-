-- Run after 001_initial_schema.sql. One primary role per user.
create unique index if not exists one_primary_role_per_user on user_roles(user_id);
create table if not exists auth_sessions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references users(id) on delete cascade,
 expires_at timestamptz not null,
 revoked_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists auth_sessions_user on auth_sessions(user_id);
create index if not exists auth_sessions_expiry on auth_sessions(expires_at);
alter table auth_sessions enable row level security;
insert into permissions(code,description) values
('users.view','View users'),('users.verify','Basic user verification'),
('content.review','Review submitted learning content'),
('content.moderate','Moderate content'),('support.manage','Handle support tickets'),
('reports.basic','View basic operational reports'),
('users.manage','Manage platform users'),('roles.manage','Manage roles and permissions'),
('finance.manage','Manage financial settings'),('withdrawals.approve','Approve withdrawals'),
('platform.manage','Change platform configuration')
on conflict(code) do nothing;
-- Admin permissions deliberately start empty. CEO is authorized explicitly by server role.
