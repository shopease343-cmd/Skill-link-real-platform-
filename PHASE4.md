# SkillLink Phase 4 — Partner System

Implemented:
- Server-side Partner-only authorization.
- Partner dashboard backed by PostgreSQL.
- Partner referral identity.
- Referral QR record creation.
- QR/Referral visit attribution endpoint.
- Referral counts.
- Ledger-derived balance view.
- Minimum ₹100 withdrawal validation.
- Available-balance validation.
- Pending-withdrawal overlap protection.
- Real withdrawal records with Pending status.
- Audit logs for QR creation and withdrawal requests.
- Partner UI for earnings, referrals, QR records and withdrawal requests.
- Partner cannot access another partner's data through these APIs.
- Partner cannot change commission rules or approve withdrawals.

Important:
- QR scanning/visiting does NOT create commission.
- Commission is intentionally not created by the referral-visit endpoint.
- Commission must only be generated later from a verified paid order and CEO-configured commission rule.
- No demo credentials are included.

Not yet implemented:
- Payment gateway verification.
- Automated commission calculation from verified payments.
- QR image rendering/download.
- CEO withdrawal approval UI.
- Partner detailed commission ledger UI.
- Student/instructor dashboards.
