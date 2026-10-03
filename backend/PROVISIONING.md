# Secure privileged-user provisioning

There are intentionally NO CEO or Admin credentials in this repository.

Before production:
1. Deploy the backend with a strong JWT_SECRET.
2. Create the first privileged user through a private operator-only provisioning procedure.
3. Insert the user with a bcrypt password hash.
4. Assign the `ceo` role in `user_roles`.
5. Record the action in `audit_logs`.
6. Never place the password, database password, JWT secret or service-role key in frontend code, GitHub, screenshots or chat.

Public signup can only create a Student account.
