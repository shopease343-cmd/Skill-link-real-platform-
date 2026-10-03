# Phase 2 setup and verification
1. Run `supabase/001_initial_schema.sql` if Phase 1 has not been installed.
2. Run `supabase/002_auth_permissions.sql` in Supabase SQL Editor.
3. Configure backend/.env using backend/.env.example. Do not commit it.
4. In backend run `npm install` then `npm run dev`.
5. In frontend copy .env.example to .env, run `npm install` and `npm run dev`.
6. Public signup creates a Student only. Login returns a signed, revocable two-hour session.
7. Provision the first CEO privately with CEO_INITIAL_PASSWORD set in the backend process environment, then run `npm run provision:ceo` and enter real email/name. Remove the environment variable immediately afterward. Never use a demo credential.
8. Assign Admin/Partner/Instructor only through an authorized server-side operation. No public role-selection API exists.
9. Admin has no default permissions. CEO can configure explicit role_permissions via an authorized server-side procedure; admin users cannot self-assign them.
10. Logout revokes the server-side session. Session tokens are held in sessionStorage, not a hard-coded credential.

## Not yet implemented
CEO role/permission management UI, password reset, email verification, MFA, secure payment gateway, purchase/enrollment, partner financial workflows and complete dashboards. A production deployment should use TLS, managed secrets, robust monitoring, and secure browser session design.

## Not yet tested
Real Supabase integration, signup/login/logout end-to-end, live role routing, permission checks against a deployed database, mobile browser testing. Syntax checks alone are not end-to-end verification.
