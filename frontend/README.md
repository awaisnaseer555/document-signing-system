# Frontend — Next.js

Next.js App Router UI for the Document Signing & Management System.

## Stack (Phase 1)

- Next.js 15 (App Router) + TypeScript + Turbopack
- Tailwind CSS v4
- shadcn/ui (initialized; `Button` sample component)
- Zod (installed for later form/API validation)

## Local setup

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Default URL: `http://localhost:3000`

Only public env vars belong here (`NEXT_PUBLIC_*`). Never add Supabase service-role credentials.
