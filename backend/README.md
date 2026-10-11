# Backend — NestJS API

TypeScript NestJS REST API for the Document Signing & Management System.

## Stack (Phase 1)

- NestJS 11 + TypeScript (strict)
- `@nestjs/config` with env validation
- Global `ValidationPipe` (`class-validator` / `class-transformer`)
- CORS limited to `FRONTEND_ORIGIN`
- Global prefix: `/api`
- Health: `GET /api/health`

## Local setup

```bash
cd backend
cp .env.example .env
npm install
npm run start:dev
```

Default URL: `http://localhost:3001/api/health`

Supabase keys in `.env` are optional until Phase 2+. Never put the service role key in the frontend.
