# Deploy NestJS API on Vercel (monorepo)

## Compatibility verdict

**Compatible with caveats.** This NestJS **11** + Express app can run on Vercel as a single Fluid/serverless function using [official NestJS support](https://vercel.com/docs/frameworks/backend/nestjs) (`src/main.ts` + `listen()`). No custom adapter.

| Works well | Constrained |
|------------|-------------|
| Auth (`/api/auth/me`), users, assignments, audit | Multipart PDF upload body size (~**4 MB** on Vercel) |
| Supabase Auth JWT + service-role DB/Storage | Function timeout (Hobby ~10s; raise if on Pro) |
| Signature flow for small PDFs (memory → Supabase) | Cold starts; in-memory throttler not global |

Local `npm run start:dev` / `start:prod` is unchanged (25 MB PDF limit locally).

If you later need large PDFs or long-running jobs without Vercel Pro, easiest **no credit-card** alternatives are typically a free-tier VM (e.g. Oracle Cloud Always Free) or a platform that still offers free Nest hosting without a card — not a rewrite of this API.

---

## Exact environment variables

### Backend Vercel project (secrets — server only)

| Variable | Required | Example |
|----------|----------|---------|
| `FRONTEND_ORIGIN` | Yes (recommended) | `https://document-signing-system-six.vercel.app` |
| `SUPABASE_URL` | Yes | `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Yes | anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | **service_role** (never in frontend) |
| `PORT` | No | Injected by Vercel |

Comma-separate origins if needed:
`http://localhost:3000,https://document-signing-system-six.vercel.app`

### Frontend Vercel project (public only)

| Variable | Required | Example |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | same Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | anon key only |
| `NEXT_PUBLIC_API_URL` | Yes | `https://YOUR-API-PROJECT.vercel.app/api` |

---

## Step-by-step: deploy API on Vercel

### A) Dashboard (recommended)

1. Push this repo to GitHub (if not already), including `backend/vercel.json` and recent Nest entry files.
2. Open [vercel.com](https://vercel.com) → **Add New… → Project** → import **the same repo** used by the frontend.
3. Configure:
   - **Root Directory:** `backend` (Edit → select `backend`)
   - **Framework Preset:** NestJS
   - **Build Command:** `npm run build`
   - **Install Command:** `npm install`
4. **Environment Variables** (Production):

   ```
   FRONTEND_ORIGIN=https://document-signing-system-six.vercel.app
   SUPABASE_URL=<from Supabase Project Settings → API>
   SUPABASE_ANON_KEY=<anon key>
   SUPABASE_SERVICE_ROLE_KEY=<service_role key>
   ```

5. Deploy. Note the URL, e.g. `https://document-signing-api-xxx.vercel.app`.
6. Smoke test (in browser or curl):

   ```
   https://YOUR-API-PROJECT.vercel.app/api/health
   https://YOUR-API-PROJECT.vercel.app/api/docs
   ```

7. Open the **frontend** Vercel project → Settings → Environment Variables → set:

   ```
   NEXT_PUBLIC_API_URL=https://YOUR-API-PROJECT.vercel.app/api
   ```

8. **Redeploy** the frontend (Deployments → … → Redeploy). Login should call `/api/auth/me` successfully.

### B) CLI

```bash
cd backend
npx vercel login
npx vercel link
# Create a NEW project (do not reuse the Next.js project). Root = backend.

# Set env vars (or set them in the dashboard)
npx vercel env add FRONTEND_ORIGIN production
npx vercel env add SUPABASE_URL production
npx vercel env add SUPABASE_ANON_KEY production
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production

npx vercel          # preview
npx vercel --prod   # production
```

Then update the frontend project’s `NEXT_PUBLIC_API_URL` and redeploy the UI.

---

## CORS

Configured in `src/create-app.ts` from `FRONTEND_ORIGIN`.

- On Vercel API project, set `FRONTEND_ORIGIN=https://document-signing-system-six.vercel.app` (no trailing slash).
- If unset, defaults include `http://localhost:3000` and `https://document-signing-system-six.vercel.app`.

---

## PDF / serverless notes

- Uploads use **multer memoryStorage** (no local disk) → OK for serverless.
- Files go to **private Supabase Storage**; clients use short-lived signed URLs.
- On Vercel (`VERCEL=1`), max PDF is capped at **4 MB** so failures return a clear API error instead of an opaque platform 413.
- Keep signing PDFs small on Hobby plan to avoid timeouts.

---

## Repo files used for Vercel

- `backend/vercel.json` — framework NestJS, build, region `sin1`
- `backend/src/main.ts` — entry with `listen()` (Vercel NestJS detection)
- `backend/src/create-app.ts` — `/api` prefix, CORS, validation, Swagger
- ConfigModule ignores `.env` when `VERCEL=1` (dashboard secrets only)

**Do not claim deploy success until `/api/health` returns OK and frontend login works against the live API URL.**
