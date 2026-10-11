# Document Signing & Management System (MVP)

Monorepo: Next.js frontend + NestJS API + Supabase (Auth, Postgres, private Storage).

> Electronic signatures here are application evidence of intent — not a legal validity claim.

## Structure

```text
frontend/     Next.js App Router
backend/      NestJS REST API
supabase/     schema.sql
```

## One-time Supabase setup

1. Schema is in `supabase/schema.sql` (already applied to the linked project via migration).
2. Private buckets created: `documents`, `signatures`.
3. Create users in **Authentication → Users** (or use Management → Invite employee).
4. Promote a management user:

```sql
update public.profiles
set role = 'MANAGEMENT'
where email = 'manager@example.com';
```

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

## Run locally

```bash
# Terminal 1
cd backend
cp .env.example .env   # then set SERVICE_ROLE_KEY
npm install
npm run start:dev

# Terminal 2
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

- UI: http://localhost:3000  
- API health: http://localhost:3001/api/health  

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

## Deploy (manual)

- **Frontend (Vercel):** set root to `frontend/`, add `NEXT_PUBLIC_*` env vars, point `NEXT_PUBLIC_API_URL` at your API.
- **Backend (Render/Railway):** Node service from `backend/`, start `npm run start:prod` (build `npm run build`), set server env vars including `SUPABASE_SERVICE_ROLE_KEY` and `FRONTEND_ORIGIN`.

Do not deploy without explicit authorization.
