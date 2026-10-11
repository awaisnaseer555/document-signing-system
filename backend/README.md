# Backend — NestJS API

TypeScript NestJS REST API for the Document Signing & Management System.

## Stack

- NestJS 11 + TypeScript
- `@nestjs/config` with env validation
- Supabase Auth token verification + service-role DB/Storage
- Global `ValidationPipe`, exception filter, CORS (`FRONTEND_ORIGIN`)
- Swagger at `/api/docs`
- Rate limiting via `@nestjs/throttler`
- Modules: auth, users, documents, assignments, signatures, storage, audit

## Local setup

```bash
cd backend
cp .env.example .env
# set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, FRONTEND_ORIGIN
npm install
npm run start:dev
```

- Health: `http://localhost:3001/api/health`
- Swagger: `http://localhost:3001/api/docs`

Never put the service role key in the frontend.

## Tests

```bash
npm test
npm run test:e2e
```

Unit coverage includes role guards, signature duplicate/conflict paths, and employee assignment isolation.

## Deploy on Vercel (separate project from Next.js)

This NestJS 11 + Express app is compatible with Vercel’s official NestJS Fluid/serverless runtime. **No custom adapter** is required.

Full steps, env vars, CLI commands, and serverless limitations (uploads, timeouts, PDF signing): see [`docs/VERCEL_BACKEND.md`](../docs/VERCEL_BACKEND.md).

Summary:

1. New Vercel project → **Root Directory** = `backend`
2. Env: `FRONTEND_ORIGIN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
3. Frontend: `NEXT_PUBLIC_API_URL=https://YOUR-API.vercel.app/api` then redeploy UI
4. Do not push/deploy without authorization

```bash
cd backend
npx vercel        # preview
npx vercel --prod # production
```
