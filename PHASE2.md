# Phase 2 — Authentication and authorization foundation
Run `supabase/001_initial_schema.sql`, then `supabase/002_phase2_permissions.sql`.
Set real backend environment values; never commit .env. Public signup always creates a Student.
Five role-specific protected API endpoints are present. Admin has zero permissions by default.
CEO provisioning must be performed privately by the operator; no credentials are supplied.
Logout discards the browser session token, but server-side revocation and refresh-token rotation are NOT implemented.
The existing JWT is held in sessionStorage; for production, move to HttpOnly Secure SameSite cookies with CSRF protection and server-side session revocation.
Role-specific business dashboards, user/role management workflows, email verification, password recovery, MFA, and integration tests are NOT yet implemented.
Do not deploy as production authentication without these controls and live database/security testing.
