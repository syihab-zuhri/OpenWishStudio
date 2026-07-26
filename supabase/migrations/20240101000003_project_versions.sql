-- ─── project_versions ─────────────────────────────────────────────────────────
-- Immutable publish snapshots; never updated or deleted by users

create table public.project_versions (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  version_no        integer not null check (version_no >= 1),
  schema_version    integer not null check (schema_version >= 1),
  document_snapshot jsonb not null,
  content_hash      text not null,
  created_at        timestamptz not null default now(),
  created_by        uuid not null references auth.users(id),
  unique (project_id, version_no)
);

comment on table public.project_versions is 'Immutable snapshots created on each publish; referenced by published_pages';
comment on column public.project_versions.content_hash is 'SHA-256 of the canonical JSON to detect duplicate publishes';

create index idx_project_versions_project_id on public.project_versions(project_id);

-- ─── RLS: project_versions ────────────────────────────────────────────────────

alter table public.project_versions enable row level security;

-- Owner can read their own project versions
create policy "project_versions_select_owner"
  on public.project_versions for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_versions.project_id
        and p.owner_id = auth.uid()
    )
  );

-- Insert is done by server action / service role only
create policy "project_versions_insert_owner"
  on public.project_versions for insert
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_versions.project_id
        and p.owner_id = auth.uid()
    )
  );

-- No update or delete allowed for regular users (rows are immutable)
