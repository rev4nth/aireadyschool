# GapFinder AI

**Find what you don’t know.**

GapFinder AI is a diagnostic EdTech platform — not a generic chatbot. It uses a student’s **own uploaded study materials** to test understanding, explain mistakes with citations, surface evidence-based knowledge gaps, and build a personalized revision plan.

---

## Why this product exists

Most AI study tools either:

1. Chat freely without grounding in the student’s syllabus, or  
2. Show quiz scores without explaining **what** is weak and **why**.

GapFinder is built around one loop:

> Diagnose → Explain with evidence → Plan → Retest → Update mastery

Unattempted topics are **Not assessed**, never marked Weak. Mastery only comes from real quiz answers.

---

## Core student workflow

1. Sign up / log in (Supabase Auth)
2. Create a subject (e.g. Biology)
3. Upload syllabus, notes, textbooks, past papers (PDF/TXT) or paste text
4. System extracts searchable chunks + embeddings
5. Generate a hierarchical **topic map** (with exam importance + past-paper frequency)
6. Take a **diagnostic quiz** grounded in retrieved materials (RAG)
7. Answers are evaluated; mistakes get explanations + source citations
8. View an evidence-based **knowledge gap report** (Strong / Medium / Weak / Not assessed)
9. Generate a **revision plan** from available days × hours
10. Ask the **AI study assistant** (answers only from uploads; refuses out-of-scope topics)
11. Track progress in **analytics**, then retest — mastery and plan priorities update

---

## Architecture (what we built and why)

```text
Browser (React SPA)
    │  Supabase JWT (email/password)
    ▼
FastAPI backend  (/api/v1/...)
    │
    ├── Supabase Postgres + pgvector   ← subjects, materials, chunks, topics,
    │                                    quizzes, mastery, gaps, plans, chats
    ├── Supabase Storage               ← original uploaded files
    ├── Supabase Auth                  ← passwords / sessions (not stored by us)
    ├── Redis                          ← cache + rate limits
    └── Gemini (primary) + Groq (fallback)
         Gemini embeddings (768-d)
```

### Why this shape

| Choice | Why |
|--------|-----|
| **FastAPI backend** | Long-running upload/RAG/quiz jobs; Python AI ecosystem; clear REST contracts |
| **React + Vite frontend** | Fast DX; SPA routes for the diagnosis loop; TanStack Query for server state |
| **Supabase Auth + JWT verification on API** | No plaintext passwords in our DB; backend trusts only verified tokens |
| **Postgres + pgvector** | One store for relational data and vector retrieval (hybrid RAG) |
| **Redis** | Cache quiz/topic work and rate-limit abuse without blocking the product if Redis is down |
| **Gemini primary / Groq fallback** | Resilience when one provider fails or structured output fails |
| **Subject isolation everywhere** | Materials, topics, quizzes, gaps, plans, and assistant retrieval never cross subjects |
| **Citations must match retrieved chunk IDs** | Prevents invented sources |

Frontend **never** holds Gemini/Groq/service-role keys. Only the backend talks to AI providers and Storage with the service role.

---

## Repository layout

```text
frontend/                 React + Vite + TypeScript + Tailwind UI
backend/                  FastAPI app (API, RAG, scoring, plans)
supabase/migrations/      Schema, RLS, storage policies, mastery constraints
docs/DEMO_ACCOUNT.md      Judge demo login
deploy/                   Optional Lightsail/Docker helpers (compose, nginx)
docker-compose.yml        Local Redis (+ optional backend)
README.md                 This file
```

Local manual packs under `test_materials/` are gitignored (share separately if needed).

---

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, Vite, TypeScript, Tailwind CSS v4, TanStack Query, React Router, Recharts, Lucide |
| Backend | FastAPI, Pydantic, SQLAlchemy (async), asyncpg |
| Data | Supabase Postgres + pgvector, Auth, Storage |
| Cache | Redis |
| AI | Gemini (LLM + embeddings), Groq fallback |

---

## API surface (`/api/v1`)

| Area | Purpose |
|------|---------|
| `/auth`, `/profile` | Session identity / profile |
| `/subjects` | Subject CRUD (isolation boundary) |
| `/materials` | Upload, paste text, process, reprocess, delete |
| `/topics` | Generate/list/edit topic map; linked materials |
| `/quizzes` | Generate (RAG), start, submit/evaluate |
| `/gap-reports` | Evidence-based diagnosis |
| `/revision-plans` | Time-bounded plan + task completion |
| `/assistant` | Grounded chat sessions + citations |
| `/progress`, `/analytics` | Dashboard + trends from real attempts |

OpenAPI (dev): `http://localhost:8000/docs`

---

## Mastery rules (non-negotiable)

1. **Not assessed** = no (or insufficient) quiz evidence  
2. **Weak / Medium / Strong** = derived from actual answer scores  
3. Unattempted topics are **never** classified as Weak  
4. Overall mastery averages **assessed topics only**  
5. Gap reasons reference real attempt counts / correctness  
6. No hardcoded demo mastery stats in production UI  

Classification policy lives in `backend/app/services/gap_analysis/scoring.py`.  
DB constraint (allows `not_assessed`): `supabase/migrations/003_not_assessed_classification.sql`.

---

## RAG behavior (transparent grounding)

1. **Ingest** — extract text → chunk → embed → store  
2. **Retrieve** — hybrid vector + keyword, subject-scoped  
3. **Generate** — quiz / explanation / assistant reply from retrieved context  
4. **Cite** — only real chunk IDs from retrieval  
5. **Refuse** — if materials don’t cover the question, say so (no fake citations)

---

## Local setup

### Prerequisites

- Node.js 20+
- Python 3.12+
- Redis (Docker recommended)
- Supabase project (`vector` extension, Auth, Storage)
- Gemini + Groq API keys

### 1. Supabase

1. Create a project and enable the `vector` extension  
2. Run migrations in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_storage_bucket.sql`
   - `supabase/migrations/003_not_assessed_classification.sql`
3. Auth → URL configuration (local):
   - Site URL: `http://localhost:5173`
   - Redirects: `/auth/verify`, `/auth/reset-password`
4. Copy Project URL, anon key, service role key, JWT secret, and `DATABASE_URL`  
   Prefer Supabase **transaction pooler** (`:6543`) with `?pgbouncer=true` for the API.

### 2. Environment

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Fill Supabase, `DATABASE_URL`, Redis, Gemini, Groq.  
**Never commit `.env` files. Never put provider secrets in the frontend.**

### 3. Redis

```bash
docker compose up redis -d
```

### 4. Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- Health: http://localhost:8000/health  
- Docs: http://localhost:8000/docs  

### 5. Frontend

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173

Default UI theme is **light** (dark only if the user toggles it).

---

## Demo account (judges)

See [docs/DEMO_ACCOUNT.md](docs/DEMO_ACCOUNT.md).

- Email: `demo@gapfinder.ai`  
- Password: `GapFinderDemo2026!`  

Also shown on the login page. On Materials, **Load sample Biology pack** seeds syllabus + notes + past papers under a Biology subject.

---

## Tests

```bash
cd backend
pytest -q
```

Tests use mock AI providers and fakeredis (no paid API calls required).

Covered areas include JWT verification, ownership checks, chunking, citation validation, mastery scoring (`not_assessed`), revision priority, Redis cache/rate limit, and Gemini→Groq fallback.

---

## Security

- Passwords only in Supabase Auth  
- Backend verifies JWT signature / expiry / audience  
- User id always from verified token  
- CORS limited to `FRONTEND_URL`  
- RLS on student-owned tables  
- Uploads treated as untrusted text (prompt-injection filtered)  
- Citations must reference retrieved chunks  

---

## Deployment (high level)

| Piece | Typical host |
|-------|----------------|
| Frontend SPA | Vercel or static Nginx |
| FastAPI + Redis | VM / Render / Railway / Docker Compose |
| DB / Auth / Storage | Supabase |

Example Docker helpers live under `deploy/` (`docker-compose.prod.yml`, `nginx.conf`).  
Production notes:

- Use transaction pooler + disabled asyncpg statement cache (see `backend/app/core/database.py`)  
- Apply migration `003_not_assessed_classification.sql` before relying on Not Assessed mastery  
- Point Supabase Auth Site URL / redirects at the public frontend origin  

---

## Problem-statement coverage

**Implemented:** upload → topic map (importance + past-paper frequency) → RAG quiz + citations → evaluation → gap report with reasons → revision plan (days × hours, refresh after quiz) → grounded assistant → progress analytics → subject isolation → Not Assessed policy.

**Not in scope for this build:** teacher class dashboards, parent views, LMS sync, push study reminders as a full notification product.

---

## Design philosophy

> Don’t just show students their scores. Show them what they don’t understand, why they don’t understand it, and exactly what to do next.

That is why GapFinder is a **diagnosis platform**, not a chat wrapper.
