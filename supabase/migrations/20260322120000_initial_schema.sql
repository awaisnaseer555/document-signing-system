-- Initial schema for Document Signing & Management System
-- Idempotent: safe to re-run against an empty or partially applied project.

create extension if not exists "pgcrypto";

do $$ begin
  create type public.user_role as enum ('EMPLOYEE', 'MANAGEMENT');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.assignment_status as enum (
    'PENDING', 'VIEWED', 'SIGNED', 'REVOKED'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  role public.user_role not null default 'EMPLOYEE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  original_storage_path text not null,
  mime_type text not null default 'application/pdf',
  size_bytes bigint not null default 0,
  uploaded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_assignments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  assignee_id uuid not null references public.profiles (id),
  assigned_by uuid not null references public.profiles (id),
  status public.assignment_status not null default 'PENDING',
  due_date date,
  viewed_at timestamptz,
  signed_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_signatures (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.document_assignments (id) on delete cascade,
  signer_id uuid not null references public.profiles (id),
  signature_image_path text not null,
  signed_pdf_path text not null,
  signed_at timestamptz not null default now(),
  submission_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.document_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  document_id uuid references public.documents (id) on delete set null,
  assignment_id uuid references public.document_assignments (id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Unique active assignment per employee + document (revoked rows may be reassigned)
create unique index if not exists uq_active_assignment_document_employee
  on public.document_assignments (document_id, assignee_id)
  where status <> 'REVOKED';

create index if not exists idx_assignments_assignee on public.document_assignments (assignee_id);
create index if not exists idx_assignments_status on public.document_assignments (status);
create index if not exists idx_assignments_document on public.document_assignments (document_id);
create index if not exists idx_assignments_due_date on public.document_assignments (due_date);
create index if not exists idx_documents_uploaded_by on public.documents (uploaded_by);
create index if not exists idx_audit_entity on public.document_audit_logs (entity_type, entity_id);
create index if not exists idx_audit_created on public.document_audit_logs (created_at desc);
create index if not exists idx_audit_document on public.document_audit_logs (document_id);
create index if not exists idx_audit_assignment on public.document_audit_logs (assignment_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

drop trigger if exists assignments_set_updated_at on public.document_assignments;
create trigger assignments_set_updated_at
  before update on public.document_assignments
  for each row execute function public.set_updated_at();

-- Trusted profile bootstrap: always EMPLOYEE. Role elevation is service-role only.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'EMPLOYEE'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.document_assignments enable row level security;
alter table public.document_signatures enable row level security;
alter table public.document_audit_logs enable row level security;

create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Prevent ordinary users from changing their own role
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role and auth.role() <> 'service_role' then
    raise exception 'Role changes require the service role';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- RLS: restrictive policies (writes for documents/signatures/audit via NestJS service role)
drop policy if exists "profiles_select_own_or_management" on public.profiles;
create policy "profiles_select_own_or_management" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.current_role() = 'MANAGEMENT');

drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_update_own_name" on public.profiles;
create policy "profiles_update_own_name" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "documents_management_select" on public.documents;
drop policy if exists "documents_management_all" on public.documents;
create policy "documents_management_select" on public.documents
  for select to authenticated
  using (public.current_role() = 'MANAGEMENT');

drop policy if exists "documents_employee_assigned" on public.documents;
create policy "documents_employee_assigned" on public.documents
  for select to authenticated
  using (
    exists (
      select 1 from public.document_assignments a
      where a.document_id = documents.id
        and a.assignee_id = auth.uid()
        and a.status <> 'REVOKED'
    )
  );

drop policy if exists "assignments_management_select" on public.document_assignments;
drop policy if exists "assignments_management_all" on public.document_assignments;
create policy "assignments_management_select" on public.document_assignments
  for select to authenticated
  using (public.current_role() = 'MANAGEMENT');

drop policy if exists "assignments_employee_own" on public.document_assignments;
create policy "assignments_employee_own" on public.document_assignments
  for select to authenticated
  using (assignee_id = auth.uid());

-- Employees must NOT update assignment timestamps/status/paths via PostgREST
drop policy if exists "assignments_employee_update_own" on public.document_assignments;

drop policy if exists "signatures_management_all" on public.document_signatures;
drop policy if exists "signatures_management_select" on public.document_signatures;
create policy "signatures_management_select" on public.document_signatures
  for select to authenticated
  using (public.current_role() = 'MANAGEMENT');

drop policy if exists "signatures_employee_own" on public.document_signatures;
create policy "signatures_employee_own" on public.document_signatures
  for select to authenticated
  using (signer_id = auth.uid());

-- No direct client inserts/updates/deletes for signatures (NestJS service role only)
drop policy if exists "signatures_employee_insert_own" on public.document_signatures;

drop policy if exists "audit_management_select" on public.document_audit_logs;
create policy "audit_management_select" on public.document_audit_logs
  for select to authenticated
  using (public.current_role() = 'MANAGEMENT');

-- Audit is append-only via NestJS service role; no client writes
drop policy if exists "audit_insert_authenticated" on public.document_audit_logs;

-- Private storage buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documents', 'documents', false, 26214400, array['application/pdf']),
  ('signatures', 'signatures', false, 5242880, array['image/png', 'image/jpeg', 'application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Intentionally no authenticated storage.objects policies.
-- File access is mediated by NestJS via short-lived signed URLs.
