-- SkillLink Phase 10
-- Withdrawals + rewards + notifications + analytics foundations

alter table withdrawals add column if not exists reviewed_at timestamptz;
alter table withdrawals add column if not exists reviewed_by uuid references users(id);
alter table withdrawals add column if not exists rejection_reason text;
alter table withdrawals add column if not exists processed_at timestamptz;

alter table rewards add column if not exists level_code text;
alter table rewards add column if not exists description text;
alter table rewards add column if not exists active boolean not null default true;

alter table reward_claims add column if not exists reviewed_at timestamptz;
alter table reward_claims add column if not exists reviewed_by uuid references users(id);
alter table reward_claims add column if not exists rejection_reason text;
alter table reward_claims add column if not exists status text not null default 'pending';

create table if not exists notification_preferences (
  user_id uuid primary key references users(id) on delete cascade,
  email_enabled boolean not null default true,
  in_app_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_created
on notifications(user_id,created_at desc);

create index if not exists idx_withdrawals_status_created
on withdrawals(status,created_at desc);

create index if not exists idx_reward_claims_status_created
on reward_claims(status,created_at desc);

create or replace view partner_financial_summary as
select
  u.id as partner_user_id,
  coalesce(sum(case when c.status='pending' then c.amount_paise else 0 end),0) as pending_commission_paise,
  coalesce(sum(case when c.status in ('available','approved') then c.amount_paise else 0 end),0) as available_commission_paise,
  coalesce(sum(case when w.status in ('approved','processed') then w.amount_paise else 0 end),0) as withdrawn_paise
from users u
left join commissions c on c.partner_user_id=u.id
left join withdrawals w on w.partner_user_id=u.id
where u.role_code='partner'
group by u.id;
