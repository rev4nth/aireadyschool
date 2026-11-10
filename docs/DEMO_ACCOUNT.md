# Demo account

Judges and testers can sign in with:

- **Email:** `demo@gapfinder.ai`
- **Password:** `GapFinderDemo2026!`

These credentials are also shown on the login page.

## Recreate / reset (if needed)

In Supabase Auth → Users, create or reset:

1. Email: `demo@gapfinder.ai`
2. Password: `GapFinderDemo2026!`
3. Confirm email (required for login)

Optional profile row (replace `USER_UUID`):

```sql
INSERT INTO profiles (id, email, full_name, study_hours_per_day)
VALUES ('USER_UUID', 'demo@gapfinder.ai', 'Demo Student', 3)
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email, full_name = EXCLUDED.full_name;
```
