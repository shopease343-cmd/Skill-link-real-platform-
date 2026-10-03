# SkillLink — Real Skill-Selling Platform

This is a new production-oriented SkillLink codebase.

## Important
- No demo credentials are included.
- No hard-coded CEO/admin accounts are included.
- Secrets belong in environment variables only.
- Role and permission checks are performed server-side.
- Payment success, balances, commissions, points and withdrawals are never trusted from the browser.

## Stack
- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL / Supabase
- Authentication: backend-issued JWT with bcrypt password hashing
- Validation: Zod
- Security: Helmet, CORS, rate limiting, parameterized SQL
- Database authorization: PostgreSQL constraints + backend authorization; RLS-ready schema

## Start
1. Create a Supabase project.
2. Run `supabase/001_initial_schema.sql` in Supabase SQL Editor.
3. Copy `backend/.env.example` to `backend/.env` and fill real secrets.
4. Run `npm install` inside `backend`.
5. Run `npm install` inside `frontend`.
6. Start backend with `npm run dev`.
7. Start frontend with `npm run dev`.

The first CEO account must be provisioned intentionally by an operator through a secure server-side process; this project does not ship with a usable CEO credential.
