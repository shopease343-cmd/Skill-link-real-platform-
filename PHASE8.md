# SkillLink Phase 8 — Masterclasses + Workshops

Implemented:
- Public live-learning catalog.
- Student registration endpoints for masterclasses and workshops.
- Seat availability checked server-side with row locking.
- Free event registration creates a real registration.
- Paid event registration creates a pending order and pending-payment registration.
- Payment is NOT marked successful by the frontend.
- Student's live registrations view.
- Attendance endpoint restricted to CEO/Admin/own Instructor.
- Instructor ownership check for attendance.
- Student feedback restricted to valid registrations.
- Database support for thumbnails, live URLs, recordings, certificates, resources and feedback.
- Responsive Student live-learning section.

Important:
- Payment verification is still intentionally deferred to Phase 9.
- Event publishing/approval controls remain privileged and are not bypassed by instructors.
- No fake registrations, attendance, payment success, reviews or certificates are generated.
