# Architecture — Document Signing & Management System

> **Disclaimer:** Electronic signatures in this system are *evidence of intent within the application*. Legal validity (e.g., ESIGN, eIDAS, UETA) requires a separate compliance review and is **not claimed** by this architecture.

## 1. Goals

- Role-separated document assignment, viewing, signing, and audit
- Strong server-side authorization (never trust the client)
- Private PDF storage with short-lived signed URLs
- Clear separation between Next.js UI and NestJS API
- Production-ready secrets handling and deploy paths

## 2. High-Level System Context

```
┌─────────────────┐     HTTPS/REST      ┌─────────────────┐
│  Next.js (Vercel)│ ◄────────────────► │ NestJS (Render/ │
│  App Router UI   │   Bearer JWT        │ Railway)        │
└────────┬─────────┘                    └────────┬────────┘
         │                                       │
         │ Supabase Auth (anon key)              │ Supabase Admin
         │ Client SDK                            │ (service role)
         ▼                                       ▼
┌────────────────────────────────────────────────────────────┐
│                     Supabase                                │
│  Auth │ PostgreSQL │ Storage (private buckets) │ (optional RLS)│
└────────────────────────────────────────────────────────────┘
```

### Trust boundaries

| Layer | Trust | Credentials |
|-------|--------|-------------|
| Browser / Next.js | Untrusted | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` only |
| NestJS API | Trusted | Supabase **service role**, DB connection, JWT secret / JWKS validation |
| Supabase Storage | Private buckets | Only NestJS mints signed URLs after authz checks |

**Rule:** The frontend never receives or embeds the service-role key. All privileged storage and cross-user queries go through NestJS.

## 3. Monorepo Layout

```
document-signing-system/
├── README.md
├── .gitignore
├── docs/                          # Architecture & planning (this folder)
├── frontend/                      # Next.js App Router application
│   ├── src/
│   │   ├── app/                   # Routes (App Router)
│   │   ├── components/            # UI (shadcn + feature components)
│   │   ├── features/              # Domain-oriented frontend modules
│   │   ├── lib/                   # Supabase client, API client, utils
│   │   ├── hooks/
│   │   ├── types/
│   │   └── validators/            # Zod schemas
│   ├── public/
│   └── ...
└── backend/                       # NestJS REST API
    ├── src/
    │   ├── main.ts
    │   ├── app.module.ts
    │   ├── config/
    │   ├── common/                # Guards, filters, decorators, pipes
    │   ├── modules/
    │   │   ├── auth/
    │   │   ├── users/
    │   │   ├── documents/
    │   │   ├── assignments/
    │   │   ├── signatures/
    │   │   ├── storage/
    │   │   └── audit/
    │   └── database/              # Migrations / SQL references
    └── ...
```

## 4. Roles & Capabilities

### EMPLOYEE

| Capability | Enforcement |
|------------|-------------|
| Sign in | Supabase Auth |
| List only own assignments | NestJS filters by `assignee_user_id = auth.uid` |
| View assigned PDF | NestJS checks assignment → returns short-lived signed URL |
| Capture / review / submit signature | NestJS validates assignment state machine |
| Status & history | Scoped queries only |

### MANAGEMENT

| Capability | Enforcement |
|------------|-------------|
| Sign in | Supabase Auth + role claim / profile |
| Invite / manage employees | NestJS + Supabase Admin Auth API |
| Upload PDF | NestJS validates MIME/ext/size → private Storage |
| Assign / revoke | NestJS + audit events |
| Track statuses, download signed PDFs, audit | NestJS role guard `MANAGEMENT` |

## 5. Backend Module Design

```
AuthModule        → JWT verification (Supabase JWT), CurrentUser, RolesGuard
UsersModule       → profiles, invites, role assignment
DocumentsModule   → document metadata CRUD (management)
AssignmentsModule → assign / revoke / list / status transitions
SignaturesModule  → signature capture payload, apply to PDF, submit
StorageModule     → upload, signed URL minting, private path rules
AuditModule       → append-only audit events
```

### Suggested REST surface (initial)

| Method | Path | Role | Purpose |
|--------|------|------|---------|
| GET | `/health` | public | Health check |
| GET | `/me` | any auth | Current profile + role |
| POST | `/users/invite` | MANAGEMENT | Invite employee |
| GET | `/users` | MANAGEMENT | List employees |
| POST | `/documents` | MANAGEMENT | Upload PDF + metadata |
| GET | `/documents` | MANAGEMENT | All documents |
| GET | `/documents/:id` | MANAGEMENT | Document detail |
| POST | `/assignments` | MANAGEMENT | Assign document → employee |
| PATCH | `/assignments/:id/revoke` | MANAGEMENT | Revoke if permitted |
| GET | `/assignments` | both | Scoped list (own vs all) |
| GET | `/assignments/:id` | both | Detail (ownership check) |
| GET | `/assignments/:id/file-url` | both | Short-lived signed URL |
| POST | `/assignments/:id/viewed` | EMPLOYEE | Mark viewed |
| POST | `/assignments/:id/signatures` | EMPLOYEE | Submit signature |
| GET | `/assignments/:id/signed-url` | both | Signed PDF URL (authz) |
| GET | `/audit` | MANAGEMENT | Filterable audit trail |
| GET | `/audit/assignments/:id` | MANAGEMENT | Per-assignment events |

Exact DTOs and pagination will be defined during implementation.

## 6. Data Model (PostgreSQL)

Core tables (logical):

```
profiles
  id (uuid, = auth.users.id)
  email
  full_name
  role ('EMPLOYEE' | 'MANAGEMENT')
  created_at, updated_at, disabled_at

documents
  id
  title, description
  original_storage_path
  mime_type, size_bytes, checksum
  uploaded_by
  created_at

assignments
  id
  document_id → documents
  assignee_user_id → profiles
  assigned_by → profiles
  status ('PENDING' | 'VIEWED' | 'SIGNED' | 'SUBMITTED' | 'OVERDUE' | 'REVOKED' | 'CANCELLED')
  due_at (nullable)
  viewed_at, signed_at, submitted_at, revoked_at
  created_at

signatures
  id
  assignment_id → assignments (unique per assignment for v1)
  signer_user_id
  signature_image_path (or inline storage path)
  signed_pdf_storage_path
  ip_address, user_agent (audit aids)
  created_at

audit_events
  id
  actor_user_id
  entity_type ('document' | 'assignment' | 'signature' | 'user')
  entity_id
  action (ASSIGNED, VIEWED, SIGNED, SUBMITTED, REVOKED, UPLOADED, ...)
  metadata (jsonb)
  created_at
```

### Status flow (assignment)

```
PENDING → VIEWED → SIGNED → SUBMITTED
   │         │
   └─────────┴──→ REVOKED / CANCELLED (management, when permitted)
PENDING / VIEWED → OVERDUE (scheduler or query-time if due_at < now)
```

Rules (server-enforced):

- Employee may only transition their own non-revoked assignment
- Cannot sign after `REVOKED` / `CANCELLED` / `SUBMITTED`
- Revoke allowed only before `SUBMITTED` (configurable)

## 7. Storage Strategy

- Bucket: `documents` (private)
- Path convention:
  - Originals: `originals/{documentId}/{filename}.pdf`
  - Signatures: `signatures/{assignmentId}/signature.png`
  - Signed PDFs: `signed/{assignmentId}/signed.pdf`
- Access pattern:
  1. Client requests file URL from NestJS
  2. NestJS verifies JWT + ownership/role
  3. NestJS returns Supabase signed URL (e.g. 60–300s TTL)
  4. Client fetches PDF/image directly from Storage via that URL

### Upload validation (NestJS)

- MIME: `application/pdf` only for documents
- Extension: `.pdf`
- Max size: configurable (e.g. 10–25 MB)
- Optional magic-byte / file-type sniffing

## 8. Authentication & Authorization

1. User signs in via Supabase Auth (frontend).
2. Frontend sends `Authorization: Bearer <access_token>` to NestJS.
3. NestJS validates JWT against Supabase JWT secret or JWKS.
4. NestJS loads `profiles.role` (source of truth for RBAC).
5. Guards:
   - `AuthGuard` — must be authenticated
   - `RolesGuard` — `@Roles('MANAGEMENT' | 'EMPLOYEE')`
   - Resource guards — assignment ownership / document access

Optional hardening: enable Supabase RLS as defense-in-depth; NestJS service role bypasses RLS, so **application authorization remains mandatory**.

## 9. Frontend Architecture

### Route groups (App Router)

```
app/
  (auth)/login, ...
  (employee)/dashboard, documents/[assignmentId], history
  (management)/dashboard, employees, documents, assignments, audit
  api/                 # optional BFF proxies — prefer calling NestJS directly
```

### Feature modules

- `features/auth`
- `features/documents` (viewer + list)
- `features/signing` (Signature Pad + review modal)
- `features/assignments`
- `features/audit` (management)
- `features/users` (management invites)

### UI stack

- Tailwind + shadcn/ui
- React PDF for viewing
- Signature Pad for capture
- Zod for form/API payload validation

## 10. Cross-Cutting Concerns

| Concern | Approach |
|---------|----------|
| Validation | Zod (FE) + class-validator/class-transformer (BE) |
| Errors | Consistent NestJS exception filters; FE toast/error boundaries |
| Audit | Write on assign, view, sign, submit, revoke, upload |
| Logging | Structured logs; never log tokens or signature images |
| Rate limiting | NestJS throttle on auth-sensitive + upload endpoints |
| CORS | Allow only frontend origin(s) |
| Health | `/health` for Render/Railway |

## 11. Deployment Topology

| Component | Host | Notes |
|-----------|------|--------|
| Frontend | Vercel | Env: public Supabase + `NEXT_PUBLIC_API_URL` |
| Backend | Render or Railway | Env: service role, JWT secret, CORS origin |
| DB / Auth / Storage | Supabase | Private buckets; migrations applied via SQL or CLI |

CI (future): GitHub Actions — lint, typecheck, test on PR. No deploy without explicit authorization.

## 12. Non-Goals (v1)

- Legally certified / qualified electronic signatures
- Multi-tenant organizations (single org assumed)
- Real-time collaboration / WebSockets
- Mobile native apps
- Advanced PDF form-field editing beyond signature overlay

## 13. Open Decisions (confirm before build)

1. Invite flow: magic link email vs temporary password
2. Overdue: cron job vs computed at read time
3. Signature placement: fixed page coordinates vs user-placed box
4. One signature per assignment (v1) vs multi-signer workflows
5. Whether to enable Supabase RLS in parallel with NestJS authz
`)