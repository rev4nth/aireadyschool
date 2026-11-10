# Demo Account Setup (Judges)

Do **not** hardcode demo passwords in source code.

## Create a demo user in Supabase

1. Open Supabase Dashboard → Authentication → Users → Add user
2. Create:
   - Email: `demo@gapfinder.ai` (or your preferred demo email)
   - Password: choose a strong temporary password
   - Auto-confirm email: enabled
3. Share the credentials with judges through a secure channel (not git).
4. Optionally seed a subject and sample syllabus PDF after login.

## Optional SQL seed (after user exists)

Replace `USER_UUID` with the demo user's auth.users id:

```sql
INSERT INTO profiles (id, email, full_name, study_streak)
VALUES ('USER_UUID', 'demo@gapfinder.ai', 'Demo Student', 3)
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

INSERT INTO subjects (id, user_id, name, description, color)
VALUES (
  gen_random_uuid(),
  'USER_UUID',
  'Data Structures',
  'Demo subject for GapFinder AI',
  '#0f766e'
);
```

## Login UX note

The login page references that a demo account can be configured via Supabase/README — it never embeds credentials.
