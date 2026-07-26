-- ─── projects ─────────────────────────────────────────────────────────────────

create table public.projects (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 500),
  status          project_status not null default 'draft',
  schema_version  integer not null default 1 check (schema_version >= 1),
  draft_document  jsonb not null,
  draft_revision  integer not null default 1 check (draft_revision >= 1),
  last_saved_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid not null references auth.users(id),
  deleted_at      timestamptz
);

comment on table public.projects is 'User greeting projects; draft_document holds the working ProjectDocument JSON';
comment on column public.projects.deleted_at is 'Soft delete; rows with non-null deleted_at are treated as deleted';

create index idx_projects_owner_id on public.projects(owner_id) where deleted_at is null;
create index idx_projects_status on public.projects(status) where deleted_at is null;

create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ─── RLS: projects ────────────────────────────────────────────────────────────

alter table public.projects enable row level security;

-- Owner can select their own non-deleted projects
create policy "projects_select_owner"
  on public.projects for select
  using (owner_id = auth.uid() and deleted_at is null);

-- Owner can insert (owner_id must equal auth.uid())
create policy "projects_insert_owner"
  on public.projects for insert
  with check (owner_id = auth.uid() and created_by = auth.uid());

-- Owner can update their own non-deleted projects
create policy "projects_update_owner"
  on public.projects for update
  using (owner_id = auth.uid() and deleted_at is null)
  with check (owner_id = auth.uid());

-- Owner can soft-delete (set deleted_at) — handled via update policy above
-- Hard delete is disallowed; only service role can delete
