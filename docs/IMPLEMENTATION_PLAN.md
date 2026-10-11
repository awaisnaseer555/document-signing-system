# Implementation Plan

Phased delivery. **Do not start a phase until the previous phase’s acceptance criteria are met**, unless explicitly agreed.

---

## Phase 0 — Scaffold & Documentation *(this phase)*

**Deliverables**

- [x] Monorepo folders: `frontend/`, `backend/`, `docs/`
- [x] Root `README.md`, `.gitignore`
- [x] Architecture + data model + security docs
- [x] Implementation plan (this document)

**Acceptance:** Structure and docs reviewed; go-ahead to implement.

**Manual commands after approval:** none yet (see later phases).

---

## Phase 1 — Project Bootstrapping ✅

**Backend**

1. [x] Scaffold NestJS (`@nestjs/cli`) with TypeScript
2. [x] Add config module (`@nestjs/config`), validation (`class-validator`), CORS, global pipes
3. [x] Health module (`GET /api/health`)
4. [x] `.env.example` (no real secrets)

**Frontend**

1. [x] Scaffold Next.js App Router + TypeScript + Tailwind
2. [x] Initialize shadcn/ui (Button sample)
3. [x] Add Zod (React PDF / Signature Pad deferred to signing UI phases)
4. [x] `.env.example` with public vars only

**Docs / root**

1. [x] Expand README with local run steps
2. [x] Confirm Node/npm versions (Node `v22.17.0`, npm `10.9.2`)

**Acceptance:** `frontend` and `backend` start locally with placeholder pages/health.

**Manual commands (you will run):**

```bash
# From repo root — exact commands will be confirmed at implementation time
cd backend && npm install && npm run start:dev
cd frontend && npm install && npm run dev
```

---

## Phase 2 — Supabase Foundation

1. Provide SQL migration scripts under `backend/src/database/migrations/` (or `supabase/migrations/`)
2. Tables: `profiles`, `documents`, `assignments`, `signatures`, `audit_events`
3. Indexes for assignee, status, due_at, document_id
4. Document private Storage bucket + path conventions
5. Document required Supabase Auth settings
6. Seed strategy for first MANAGEMENT user (manual SQL / Admin API — no hardcoded credentials)

**Acceptance:** Schema applied in your Supabase project; bucket private; env vars documented.

**Manual commands (you will run):**

- Create Supabase project in dashboard
- Apply SQL migrations
- Create private storage bucket
- Copy URL / anon key / service role into local `.env` files (never commit)

---

## Phase 3 — Auth & RBAC (Backend)

1. JWT validation middleware/guard (Supabase access token)
2. `CurrentUser` decorator + `profiles` lookup
3. `RolesGuard` + `@Roles()`
4. `GET /me`
5. Invite employee endpoint (MANAGEMENT) via Supabase Admin API
6. Reject missing/invalid tokens consistently

**Acceptance:** Protected routes return 401/403 correctly; management vs employee separation verified with two test users.

---

## Phase 4 — Documents & Storage (Backend)

1. `StorageModule` — upload to private bucket via service role
2. PDF validation: MIME, extension, size
3. `DocumentsModule` — create/list/get for MANAGEMENT
4. Audit: `DOCUMENT_UPLOADED`
5. Signed URL helper with short TTL

**Acceptance:** Management can upload PDF; object not publicly listable; signed URL works only after API authz.

---

## Phase 5 — Assignments & Audit (Backend)

1. Create assignment (document → employee)
2. List assignments (scoped): employee = own; management = all (+ filters)
3. Status transitions: viewed, revoke/cancel
4. Overdue computation (query-time first; cron optional later)
5. Audit events for assign / view / revoke

**Acceptance:** Employee cannot fetch another user’s assignment (404/403); management sees all; audit rows written.

---

## Phase 6 — Signing Pipeline (Backend)

1. Accept signature payload (image data or upload)
2. Store signature asset privately
3. Generate signed PDF (overlay signature on PDF — library TBD, e.g. pdf-lib)
4. Transition assignment → SIGNED → SUBMITTED
5. Endpoints for signed PDF signed-URL
6. Audit: SIGNED, SUBMITTED

**Acceptance:** Employee can submit once; re-submit blocked; management can download signed PDF; employee cannot access others’ signed files.

---

## Phase 7 — Frontend Auth & Shell

1. Supabase Auth client (browser)
2. Login page
3. Session handling; attach Bearer token to API client
4. Role-based route protection (middleware + server checks where applicable)
5. Layouts: employee vs management shells (shadcn)

**Acceptance:** Login redirects by role; unauthenticated users cannot open app routes.

---

## Phase 8 — Employee UI

1. Assigned documents list + status badges
2. PDF viewer (React PDF) via signed URL from API
3. Mark viewed on open
4. Signature Pad capture + review step
5. Submit signature
6. History / status view

**Acceptance:** Full employee happy path works end-to-end against local NestJS + Supabase.

---

## Phase 9 — Management UI

1. Employee invite / list
2. Document upload
3. Assign documents
4. Dashboard: pending / viewed / signed / overdue
5. View & download signed PDFs
6. Audit event viewer
7. Revoke/cancel where permitted

**Acceptance:** Management workflows complete without using Supabase dashboard for day-to-day ops.

---

## Phase 10 — Hardening & Production Readiness

1. Rate limiting, request size limits
2. Stricter CORS / Helmet
3. Consistent error shapes
4. Basic unit/e2e tests for authz (critical paths)
5. README production env checklist
6. Deploy docs for Vercel + Render/Railway (**deploy only with your authorization**)

**Acceptance:** Security checklist in `docs/SECURITY.md` reviewed; no secrets in repo; disclaimer present in UI/README.

---

## Suggested Implementation Order (summary)

```
Phase 0 (docs) → 1 bootstrap → 2 Supabase → 3 authz → 4 docs/storage
→ 5 assignments → 6 signing → 7 FE auth → 8 employee UI → 9 management UI → 10 harden
```

## Out of Scope Until Requested

- GitHub push / remote setup
- Vercel / Render / Railway deployment
- Legal compliance certification of e-signatures
- Multi-tenant / multi-org support
`)