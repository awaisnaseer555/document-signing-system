# Supabase schema & migrations

Version-controlled SQL lives in `migrations/`. Apply these against your Supabase project; do not invent credentials.

## Apply with Supabase CLI

```bash
# From repo root (requires supabase CLI + linked project)
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

## Apply with SQL Editor

1. Open Supabase Dashboard → SQL Editor.
2. For a new project, run `migrations/20260322120000_initial_schema.sql`.
3. For a project that already used the older `schema.sql`, run `migrations/20260322120100_harden_rls_and_columns.sql`.
4. Confirm private buckets `documents` and `signatures` exist (Storage → Buckets).

## Security review (post-migration)

| Control | Behavior |
|---------|----------|
| Profile bootstrap | Trigger always creates `EMPLOYEE`; management role set only via service role / SQL |
| Role escalation | Trigger blocks role changes unless `auth.role() = service_role` |
| Assignment writes | No employee UPDATE policy — NestJS service role updates status/timestamps |
| Signatures / audit | No authenticated INSERT/UPDATE/DELETE — append/write via NestJS only |
| Storage | Private buckets; no broad `storage.objects` policies for clients |
| Active uniqueness | Partial unique index on `(document_id, assignee_id)` where status ≠ `REVOKED` |

Promote a manager only with a trusted SQL update (or backend admin path):

```sql
update public.profiles
set role = 'MANAGEMENT'
where email = 'manager@example.com';
```

> NestJS uses the service role and must still enforce JWT + role checks on every operation. RLS is defense-in-depth for direct PostgREST access.
