# SkillLink Phase 9 — Commerce + Payments + Referrals + Commissions + Levels

Implemented:
- Real course/package order creation.
- Server calculates item price from database.
- Client cannot set arbitrary order price.
- Referral QR code can attribute an order to a partner.
- Referral attribution alone does not create commission.
- Server-side payment verification boundary.
- Payment amount mismatch rejection.
- Provider payment reference persistence.
- Idempotent verified-payment handling.
- Verified course enrollment.
- Verified package enrollment into published package courses.
- CEO-configured commission rules.
- Commission creation only after verified payment.
- Partner earnings ledger entry for verified commission.
- Referral qualification after verified payment.
- Initial backend points award after verified purchase.
- Nine-level point structure preserved.
- Level lookup based on backend points/referrals.
- Refund event reverses commission/referral status.
- Order ownership checks.
- Audit logging.

CRITICAL PRODUCTION NOTE:
The provider-webhook route is an integration boundary, not a pretend payment gateway. In production, a Razorpay/Stripe/etc adapter must verify the provider's real webhook signature before calling the verified event logic. The frontend must never call this endpoint with signatureVerified=true.

Not yet implemented:
- Actual payment provider SDK/webhook adapter.
- Refund-to-enrollment revocation policy.
- Full CEO level/reward configuration UI.
- Automated skill-mastery calculation.
- Withdrawal approval integration with commission settlement.
