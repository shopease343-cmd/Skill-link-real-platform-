-- SkillLink Phase 4: Partner system
-- Run after 001_initial_schema.sql.

create table if not exists qr_codes (
  id uuid primary key default gen_random_uuid(),
  partner_user_id uuid not null references partners(user_id) on delete cascade,
  code text unique not null,
  destination_path text not null default '/signup',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists referral_visits (
  id uuid primary key default gen_random_uuid(),
  qr_code_id uuid references qr_codes(id) on delete set null,
  partner_user_id uuid not null references partners(user_id) on delete cascade,
  visitor_token text,
  created_at timestamptz not null default now()
);

create table if not exists commission_rules (
  id uuid primary key default gen_random_uuid(),
  package_id uuid references packages(id) on delete cascade,
  commission_type text not null default 'fixed' check(commission_type in ('fixed','percent')),
  value numeric(12,2) not null check(value >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_qr_partner on qr_codes(partner_user_id);
create index if not exists idx_visits_partner on referral_visits(partner_user_id);
create index if not exists idx_ledger_partner on earnings_ledger(partner_user_id);

-- Helper view: financial balance is derived from ledger entries.
create or replace view partner_balances as
select
  p.user_id,
  coalesce(sum(case when e.amount_paise > 0 then e.amount_paise else 0 end),0)::bigint as gross_earned_paise,
  coalesce(sum(case when e.amount_paise > 0 and c.status = 'pending' then e.amount_paise else 0 end),0)::bigint as pending_paise,
  coalesce(sum(case when e.amount_paise > 0 and c.status = 'approved' then e.amount_paise else 0 end),0)::bigint as available_paise,
  coalesce(sum(case when e.entry_type = 'withdrawal' then abs(e.amount_paise) else 0 end),0)::bigint as withdrawn_paise
from partners p
left join earnings_ledger e on e.partner_user_id = p.user_id
left join commissions c on c.id = e.commission_id
group by p.user_id;

-- No commission rule is seeded here. CEO must explicitly configure rules.
