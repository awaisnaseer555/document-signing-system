-- Document Signing & Management System schema
-- Apply in Supabase SQL editor or via migration tooling.

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
  original_storage_path text not null,
  mime_type text not null default 'application/pdf',
  size_bytes bigint not null default 0,
  uploaded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
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
  created_at timestamptz not null default now(),
  unique (document_id, assignee_id)
);

create table if not exists public.document_signatures (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.document_assignments (id) on delete cascade,
  signer_id uuid not null references public.profiles (id),
  signature_image_path text not null,
  signed_pdf_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.document_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_assignments_assignee on public.document_assignments (assignee_id);
create index if not exists idx_assignments_status on public.document_assignments (status);
create index if not exists idx_assignments_document on public.document_assignments (document_id);
create index if not exists idx_documents_uploaded_by on public.documents (uploaded_by);
create index if not exists idx_audit_entity on public.document_audit_logs (entity_type, entity_id);
create index if not exists idx_audit_created on public.document_audit_logs (created_at desc);

-- Auto-create profile on signup
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
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'EMPLOYEE')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
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

drop policy if exists "profiles_select_own_or_management" on public.profiles;
create policy "profiles_select_own_or_management" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.current_role() = 'MANAGEMENT');

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "documents_management_all" on public.documents;
create policy "documents_management_all" on public.documents
  for all to authenticated
  using (public.current_role() = 'MANAGEMENT')
  with check (public.current_role() = 'MANAGEMENT');

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

drop policy if exists "assignments_management_all" on public.document_assignments;
create policy "assignments_management_all" on public.document_assignments
  for all to authenticated
  using (public.current_role() = 'MANAGEMENT')
  with check (public.current_role() = 'MANAGEMENT');

drop policy if exists "assignments_employee_own" on public.document_assignments;
create policy "assignments_employee_own" on public.document_assignments
  for select to authenticated
  using (assignee_id = auth.uid());

drop policy if exists "assignments_employee_update_own" on public.document_assignments;
create policy "assignments_employee_update_own" on public.document_assignments
  for update to authenticated
  using (assignee_id = auth.uid())
  with check (assignee_id = auth.uid());

drop policy if exists "signatures_management_all" on public.document_signatures;
create policy "signatures_management_all" on public.document_signatures
  for select to authenticated
  using (public.current_role() = 'MANAGEMENT');

drop policy if exists "signatures_employee_own" on public.document_signatures;
create policy "signatures_employee_own" on public.document_signatures
  for select to authenticated
  using (signer_id = auth.uid());

drop policy if exists "signatures_employee_insert_own" on public.document_signatures;
create policy "signatures_employee_insert_own" on public.document_signatures
  for insert to authenticated
  with check (
    signer_id = auth.uid()
    and exists (
      select 1 from public.document_assignments a
      where a.id = assignment_id
        and a.assignee_id = auth.uid()
        and a.status in ('PENDING', 'VIEWED')
    )
  );

drop policy if exists "audit_management_select" on public.document_audit_logs;
create policy "audit_management_select" on public.document_audit_logs
  for select to authenticated
  using (public.current_role() = 'MANAGEMENT');

drop policy if exists "audit_insert_authenticated" on public.document_audit_logs;
create policy "audit_insert_authenticated" on public.document_audit_logs
  for insert to authenticated
  with check (actor_id = auth.uid());

-- Private storage buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documents', 'documents', false, 26214400, array['application/pdf']),
  ('signatures', 'signatures', false, 5242880, array['image/png', 'image/jpeg', 'application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Storage: no direct client access. NestJS uses service role for uploads/signed URLs.
drop policy if exists "storage_no_anon" on storage.objects;
-- Intentionally no broad authenticated storage policies.
-- Authorized file access is mediated by the NestJS API via short-lived signed URLs.
