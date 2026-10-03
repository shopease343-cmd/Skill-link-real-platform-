-- SkillLink Phase 11 reconciliation migration.
-- Makes the cumulative Phase 1-10 schema compatible with Phase 11 code.

-- Existing initial schema has levels(level_no, points_required).
alter table levels add column if not exists level_code text;
alter table levels add column if not exists referral_required integer not null default 0;
alter table levels add column if not exists skill_mastery_required integer not null default 0;
alter table levels add column if not exists active boolean not null default true;
update levels set level_code='L'||level_no where level_code is null;
create unique index if not exists idx_levels_code on levels(level_code);

-- Initial notifications schema uses body/read_at; keep it as canonical.
-- Initial withdrawals schema uses requested_at; keep it as canonical.
-- Initial rewards schema uses level_no/is_active; keep it as canonical.

-- Make the payment/referral data model idempotent and queryable.
create unique index if not exists idx_referrals_order_unique on referrals(order_id) where order_id is not null;
create index if not exists idx_payments_order_status on payments(order_id,status);
create index if not exists idx_enrollments_user_status on enrollments(user_id,status);
create index if not exists idx_audit_entity on audit_logs(entity_type,entity_id,created_at desc);

-- A verified commission must have an auditable ledger entry.
-- Existing rows are not fabricated or backfilled here.

-- Prevent negative/invalid reward claim state transitions at the database boundary.
alter table reward_claims drop constraint if exists reward_claims_status_check;
alter table reward_claims add constraint reward_claims_status_check
  check(status in ('eligible','pending','approved','rejected','fulfilled'));
