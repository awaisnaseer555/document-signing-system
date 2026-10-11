-- Harden RLS and add columns for existing deployments that applied the older schema.sql.
-- Additive / policy-only. Does not drop tables or storage objects.

alter table public.documents
  add column if not exists description text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.document_assignments
  add column if not exists submitted_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.document_signatures
  add column if not exists signed_at timestamptz not null default now(),
  add column if not exists submission_metadata jsonb not null default '{}'::jsonb;

alter table public.document_audit_logs
  add column if not exists document_id uuid references public.documents (id) on delete set null,
  add column if not exists assignment_id uuid references public.document_assignments (id) on delete set null;

-- Replace rigid unique(document_id, assignee_id) with unique active assignments
do $$
declare
  constraint_name text;
begin
  select c.conname into constraint_name
  from pg_constraint c
  join pg_class t on c.conrelid = t.oid
  join pg_namespace n on t.relnamespace = n.oid
  where n.nspname = 'public'
    and t.relname = 'document_assignments'
    and c.contype = 'u'
    and pg_get_constraintdef(c.oid) ilike '%document_id%assignee_id%';

  if constraint_name is not null then
    execute format('alter table public.document_assignments drop constraint %I', constraint_name);
  end if;
end $$;

create unique index if not exists uq_active_assignment_document_employee
  on public.document_assignments (document_id, assignee_id)
  where status <> 'REVOKED';

create index if not exists idx_assignments_due_date on public.document_assignments (due_date);
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

-- Never trust client-supplied role on signup
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

-- Restrictive RLS: reads only for authenticated users; mutations via service role
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_update_own_name" on public.profiles;
create policy "profiles_update_own_name" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "documents_management_all" on public.documents;
drop policy if exists "documents_management_select" on public.documents;
create policy "documents_management_select" on public.documents
  for select to authenticated
  using (public.current_role() = 'MANAGEMENT');

drop policy if exists "assignments_management_all" on public.document_assignments;
drop policy if exists "assignments_management_select" on public.document_assignments;
create policy "assignments_management_select" on public.document_assignments
  for select to authenticated
  using (public.current_role() = 'MANAGEMENT');

drop policy if exists "assignments_employee_update_own" on public.document_assignments;

drop policy if exists "signatures_management_all" on public.document_signatures;
drop policy if exists "signatures_management_select" on public.document_signatures;
create policy "signatures_management_select" on public.document_signatures
  for select to authenticated
  using (public.current_role() = 'MANAGEMENT');

drop policy if exists "signatures_employee_insert_own" on public.document_signatures;
drop policy if exists "audit_insert_authenticated" on public.document_audit_logs;
