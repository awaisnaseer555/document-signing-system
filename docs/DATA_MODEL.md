# Data Model

Logical schema for Supabase PostgreSQL. Exact SQL migrations land in Phase 2.

## Enums

```text
user_role:        EMPLOYEE | MANAGEMENT
assignment_status: PENDING | VIEWED | SIGNED | SUBMITTED | OVERDUE | REVOKED | CANCELLED
audit_entity:     document | assignment | signature | user
```

## Tables

### profiles

| Column | Type | Notes |
|--------|------|--------|
| id | uuid PK | Matches `auth.users.id` |
| email | text unique | |
| full_name | text | |
| role | user_role | Default EMPLOYEE |
| disabled_at | timestamptz nullable | Soft disable |
| created_at / updated_at | timestamptz | |

### documents

| Column | Type | Notes |
|--------|------|--------|
| id | uuid PK | |
| title | text | |
| description | text nullable | |
| original_storage_path | text | Private bucket path |
| mime_type | text | `application/pdf` |
| size_bytes | bigint | |
| checksum | text nullable | Optional integrity |
| uploaded_by | uuid FK → profiles | |
| created_at | timestamptz | |

### assignments

| Column | Type | Notes |
|--------|------|--------|
| id | uuid PK | |
| document_id | uuid FK | |
| assignee_user_id | uuid FK | Employee |
| assigned_by | uuid FK | Management |
| status | assignment_status | |
| due_at | timestamptz nullable | |
| viewed_at / signed_at / submitted_at / revoked_at | timestamptz nullable | |
| created_at | timestamptz | |

**Indexes:** `(assignee_user_id, status)`, `(document_id)`, `(due_at)`, `(status)`.

**Uniqueness (v1):** optional unique `(document_id, assignee_user_id)` where status not in (REVOKED, CANCELLED).

### signatures

| Column | Type | Notes |
|--------|------|--------|
| id | uuid PK | |
| assignment_id | uuid FK unique | One signature set per assignment in v1 |
| signer_user_id | uuid FK | |
| signature_image_path | text | Private storage |
| signed_pdf_storage_path | text | Private storage |
| ip_address | text nullable | |
| user_agent | text nullable | |
| created_at | timestamptz | |

### audit_events

| Column | Type | Notes |
|--------|------|--------|
| id | uuid PK | |
| actor_user_id | uuid FK nullable | System actions may be null |
| entity_type | audit_entity | |
| entity_id | uuid | |
| action | text | e.g. ASSIGNED, VIEWED, SIGNED |
| metadata | jsonb | Non-sensitive context |
| created_at | timestamptz | |

**Indexes:** `(entity_type, entity_id)`, `(actor_user_id)`, `(created_at desc)`.

## Entity Relationships

```
profiles 1──* documents (uploaded_by)
profiles 1──* assignments (assignee)
profiles 1──* assignments (assigned_by)
documents 1──* assignments
assignments 1──1 signatures   (v1)
* ── audit_events (polymorphic by entity_type + entity_id)
```
`)