# GapFinder AI — Find What the Student Doesn't Know

Hackathon 2026 full-stack diagnostic study platform.

**Core workflow:** Upload materials → Topic map → RAG retrieval → Diagnostic quiz → Evaluate answers → Gap report → Revision plan → Retest → Update mastery.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript, Tailwind CSS v4, TanStack Query, React Router, Recharts |
| Backend | FastAPI, Pydantic, SQLAlchemy (async), Redis |
| Data | Supabase Postgres + pgvector, Supabase Auth, Supabase Storage |
| AI | Gemini (primary) + Groq (fallback), Gemini embeddings, custom RAG |

## Repository layout

```text
frontend/          React app
backend/           FastAPI app
supabase/migrations/  SQL schema + RLS + storage policies
docs/DEMO_ACCOUNT.md  Judge demo login (demo@gapfinder.ai)
docker-compose.yml    Redis (+ optional backend)
```

## Prerequisites

- Node.js 20+
- Python 3.12+
- Redis (local or Docker)
- Supabase project (Auth, Postgres with `vector` extension, Storage)
- Gemini API key + Groq API key

## 1. Supabase setup

1. Create a Supabase project.
2. Enable the `vector` extension.
3. Run SQL in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_storage_bucket.sql`
4. Auth settings:
   - Enable email/password
   - Configure Site URL = `http://localhost:5173`
   - Redirect URLs include `/auth/verify` and `/auth/reset-password`
5. Copy Project URL, anon key, service role key, and JWT secret.

## 2. Environment files

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Fill in Supabase, `DATABASE_URL`, Redis, Gemini, and Groq values.  
**Never commit `.env` files. Never put Gemini/Groq/service-role keys in the frontend.**

## 3. Redis

```bash
docker compose up redis -d
```

## 4. Backend

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs (development): http://localhost:8000/docs  
Health: http://localhost:8000/health

## 5. Frontend

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173

## Demo account for judges

- Email: `demo@gapfinder.ai`
- Password: `GapFinderDemo2026!`

Shown on the login page. Details: [docs/DEMO_ACCOUNT.md](docs/DEMO_ACCOUNT.md).

On Materials, use **Load sample Biology pack** for a one-click syllabus + notes + past papers seed.

## Problem-statement coverage

Core loop implemented: Upload → Topic map (with past-paper frequency) → RAG quiz + citations → Answer evaluation → Gap report with reasons → Revision plan (days × hours, auto-refresh after quiz) → Explain assistant → Progress analytics.

**Future (not built):** class-level teacher dashboards, parent views, spaced-repetition reminders, LMS integration.

## Tests

```bash
cd backend
pytest -q
```

Tests use mock AI providers and fakeredis. They do **not** require paid API calls.

Covered areas include JWT verification, IDOR owner checks, chunking, citation validation, PDF extraction, mastery scoring, revision priority formula, Redis cache hit/miss + rate limit, and Gemini→Groq fallback behavior.

## Security notes

- Passwords handled only by Supabase Auth (never stored by this app).
- Backend verifies Supabase JWTs (signature, expiry, audience).
- User identity always comes from the verified token.
- CORS allows only `FRONTEND_URL`.
- RLS enabled on student-owned tables.
- Uploaded documents treated as untrusted; prompt-injection patterns filtered.
- Citations must reference retrieved chunk IDs.

## Deployment

- **Frontend:** Vercel — set `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **Backend:** Render/Railway — set all backend env vars; start with `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Redis:** Redis Cloud / managed Redis
- **Supabase:** production project with migrations applied

## What still needs your configuration

1. Real Supabase project + migrations applied  
2. `backend/.env` and `frontend/.env` with your keys  
3. Redis running  
4. Gemini + Groq API keys (you said you will add these at the end)

Once those are set, the full product workflow is wired end-to-end through `/api/v1`.
