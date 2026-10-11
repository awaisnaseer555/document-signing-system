# Deploy NestJS API on Vercel (monorepo)

## Compatibility verdict

This NestJS **11** app (`@nestjs/platform-express`) **can** run on Vercel as a **single Fluid/serverless function**.

Vercel has [official NestJS support](https://vercel.com/docs/frameworks/backend/nestjs): keep `src/main.ts` with `NestFactory.create` + `app.listen()`. **No custom serverless adapter is required** for this stack.

Smallest reliable approach for this monorepo:

1. **Separate Vercel project** for the API (do not mix with the Next.js project).
2. Set **Root Directory** = `backend`.
3. Framework = NestJS (auto-detected via `src/main.ts` + `backend/vercel.json`).
4. Put **server secrets only** on the API project (never on the frontend project).

Local `npm run start:dev` / `npm run start:prod` is unchanged.

---

## Limitations (important)

| Concern | Impact on this app |
|--------|---------------------|
| **Request body size** | Vercel Functions typically cap request bodies around **~4.5 MB**. The API still validates up to 25 MB in code, but **large PDF uploads via multipart will fail on Vercel**. Keep uploaded PDFs small (under ~4 MB) or later move to direct-to-Supabase signed uploads. |
| **Timeouts** | Hobby plans often allow **~10s**; Pro can raise **maxDuration** (e.g. 60s). PDF download + `pdf-lib` signing + dual Storage uploads can approach limits for large files. Raise **Function Max Duration** in the API project settings. |
| **Cold starts** | First request after idle bootstraps Nest + modules — expect higher latency (~1–3s+). |
| **Memory** | `pdf-lib` + PDF buffers need RAM; prefer **1024 MB** function memory if available. |
| **Throttling** | `@nestjs/throttler` is **in-memory per instance** — not a shared rate-limit store across isolates. |
| **No local disk** | Fine here: uploads use **multer memoryStorage** and Supabase Storage. |
| **Swagger** | `/api/docs` works but adds bundle/cold-start cost. |

Electronic signatures remain **application evidence of intent**, not a legal validity claim.

---

## Exact Vercel project settings (API)

Create a **new** Vercel project linked to the **same GitHub repo**.

| Setting | Value |
|--------|--------|
| Framework Preset | NestJS (or Other → NestJS) |
| **Root Directory** | `backend` |
| Build Command | `npm run build` (from `vercel.json`) |
| Install Command | `npm install` |
| Output / Node | Leave default (NestJS Fluid function) |
| Region | `sin1` (matches current frontend edge region) |
| Function Max Duration | **60** (Pro) or highest available on your plan |

### Environment variables (API project only)

```env
FRONTEND_ORIGIN=https://document-signing-system-six.vercel.app
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Optional: `PORT` is injected by Vercel — you do not need to set it.

**Never** add `SUPABASE_SERVICE_ROLE_KEY` to the Next.js Vercel project.

### Frontend project (already deployed)

Set / update:

```env
NEXT_PUBLIC_API_URL=https://YOUR-API-PROJECT.vercel.app/api
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Then **redeploy** the frontend so the public API URL is baked in.

CORS: `FRONTEND_ORIGIN` on the API must exactly match the browser origin (no trailing slash; comma-separate if multiple).

---

## Deployment commands (manual — do not auto-run)

From a machine with Vercel CLI logged in:

```bash
# One-time: link a NEW project to backend/
cd backend
npx vercel login
npx vercel link
# When prompted: create new project, Root Directory = backend (or link after setting Root in dashboard)

# Preview
npx vercel

# Production
npx vercel --prod
```

Or: Vercel Dashboard → Add New Project → import repo → Root Directory `backend` → add env vars → Deploy.

### Smoke tests after deploy

```bash
curl https://YOUR-API-PROJECT.vercel.app/api/health
# open https://YOUR-API-PROJECT.vercel.app/api/docs
```

Then sign in on the frontend; `/api/auth/me` must succeed (no Failed to fetch).

---

## What was changed in the repo

- `src/create-app.ts` — shared Nest configuration (`/api` prefix, CORS, validation, Swagger)
- `src/main.ts` — thin local/Vercel entry that `listen()`s (required by Vercel NestJS detection)
- `vercel.json` — NestJS framework + install/build + `sin1`
- ConfigModule `ignoreEnvFile` when `VERCEL=1` so production uses dashboard secrets only
