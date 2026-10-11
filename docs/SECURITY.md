# Security Notes

## Principles

1. **Server is the authority** — every document/assignment access is checked in NestJS.
2. **Least privilege in the browser** — only Supabase anon key + user JWT.
3. **Private storage** — no public bucket reads; short-lived signed URLs only.
4. **Defense in depth** — optional RLS; never a substitute for API authz.
5. **Auditability** — assignment, view, sign, submit, revoke are recorded.
6. **No legal overclaim** — UI and docs must not assert legal signature validity without review.

## Credential Handling

| Secret | Where | Exposed to browser? |
|--------|--------|---------------------|
| Supabase URL | FE + BE | Yes (public) |
| Supabase anon key | FE | Yes (public, RLS-limited) |
| Supabase service role | BE only | **Never** |
| JWT secret / JWKS | BE only | Never |
| Database URL (if used) | BE only | Never |

Use `.env` locally and platform env vars in production. Commit only `.env.example`.

## Authorization Checklist (v1)

- [ ] JWT required on all non-public endpoints
- [ ] Role checks for management-only operations
- [ ] Assignment ownership checks for employee file/signature access
- [ ] Signed URLs minted only after authz
- [ ] PDF upload MIME/extension/size validation
- [ ] Revoke blocked after terminal states (e.g. SUBMITTED)
- [ ] Audit written for sensitive actions
- [ ] CORS restricted to known frontend origin(s)
- [ ] No service-role key in Next.js bundle or client components

## Employee Isolation

An authenticated employee requesting `/assignments/:id` (or file URLs) for another user’s assignment must receive **403 or 404** (prefer 404 to avoid ID enumeration if feasible). Management may access all assignments within the org.

## Storage

- Bucket(s) configured as **private**
- Path includes document/assignment IDs; listing not exposed to clients
- TTL for signed URLs kept short (recommend ≤ 5 minutes for downloads/views)

## Abuse Controls

- Upload size caps
- Rate limiting on login-adjacent and upload endpoints
- Validate content-type; reject non-PDF document uploads

## Compliance Disclaimer

This product provides an electronic signature capture and audit trail for operational workflows. It does **not** by itself guarantee compliance with ESIGN, UETA, eIDAS, or industry-specific regulations. Engage legal counsel before production use in regulated contexts.
`)