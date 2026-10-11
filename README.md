# Document Signing & Management System (MVP)

Monorepo: Next.js frontend + NestJS API + Supabase (Auth, Postgres, private Storage).

> Electronic signatures here are application evidence of intent — not a legal validity claim.

## Structure

```text
frontend/              Next.js App Router
backend/               NestJS REST API
supabase/migrations/   Versioned SQL schema + RLS
docs/                  Architecture & security notes
```

## One-time Supabase setup

1. Apply migrations (see [supabase/README.md](./supabase/README.md)):
   - New project: `supabase/migrations/20260322120000_initial_schema.sql`
   - Existing project from older `schema.sql`: also run `20260322120100_harden_rls_and_columns.sql`
2. Confirm private buckets: `documents`, `signatures`.
3. Create users via **Authentication → Users** or Management → Invite employee.
4. Promote a management user (trusted SQL only):

```sql
update public.profiles
set role = 'MANAGEMENT'
where email = 'manager@example.com';
```

### Apply migrations with Supabase CLI

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

### Apply with SQL Editor

Open Supabase Dashboard → SQL Editor → paste and run the migration file contents (no credentials inventing; use your project).

## Environment

### Backend `backend/.env`

```env
PORT=3001
FRONTEND_ORIGIN=http://localhost:3000
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Copy the **service role** key from Supabase → Project Settings → API. Never put it in the frontend.

### Frontend `frontend/.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## Run locally (manual commands)

```bash
# Terminal 1 — API
cd backend
cp .env.example .env   # then set real keys
npm install
npm run start:dev

# Terminal 2 — UI
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

- UI: http://localhost:3000
- API health: http://localhost:3001/api/health
- Swagger: http://localhost:3001/api/docs

## Core API

| Method | Path | Role |
|--------|------|------|
| GET | `/api/auth/me` | any |
| GET/POST | `/api/users/employees`, `/api/users/invite` | MANAGEMENT |
| GET/POST | `/api/documents` | MANAGEMENT |
| GET/POST | `/api/assignments` | scoped |
| GET | `/api/assignments/:id/file-url` | scoped |
| GET | `/api/assignments/:id/signed-url` | scoped |
| POST | `/api/assignments/:id/signatures` | EMPLOYEE |
| PATCH | `/api/assignments/:id/revoke` | MANAGEMENT |
| GET | `/api/audit` | MANAGEMENT |

## Frontend notes

- Public: login, forgot password, reset password, unauthorized
- Employee / management dashboards call NestJS via typed `api` helpers (`NEXT_PUBLIC_API_URL`)
- Light/dark mode via `next-themes`
- Auth UX is client-side; **authorization is enforced by NestJS**

## Deploy (manual — only with your authorization)

### Frontend (Vercel)

1. Project **Root Directory** = `frontend` (required for this monorepo).
2. Use the working app URL (e.g. `document-signing-system-six.vercel.app`). A separate project like `document-ss` will 404 if it has no successful deployment.
3. Environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=https://YOUR-API.onrender.com/api
```

`NEXT_PUBLIC_API_URL` must **not** be `http://localhost:3001/api` on Vercel — that causes **Failed to fetch** after login.

### Backend on Vercel (recommended for this monorepo)

Use a **second** Vercel project with **Root Directory** = `backend` (NestJS 11 Fluid function — no Render/Railway required). Details: [`docs/VERCEL_BACKEND.md`](./docs/VERCEL_BACKEND.md).

```bash
cd backend
npx vercel link   # new project, root = backend
npx vercel --prod
```

API env (server only):

```env
FRONTEND_ORIGIN=https://document-signing-system-six.vercel.app
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Frontend env:

```env
NEXT_PUBLIC_API_URL=https://YOUR-API-PROJECT.vercel.app/api
```

Then redeploy the frontend. Never put the service role key on the Next.js project.

Do not deploy or push without explicit authorization.
