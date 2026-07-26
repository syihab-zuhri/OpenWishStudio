-- ─── assets ───────────────────────────────────────────────────────────────────

create table public.assets (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references auth.users(id) on delete cascade,
  project_id       uuid references public.projects(id) on delete set null,
  library_item_id  uuid,
  kind             asset_kind not null,
  source           asset_source not null,
  storage_key      text not null unique,
  original_name    text not null check (char_length(original_name) <= 500),
  mime_type        text not null,
  size_bytes       bigint not null check (size_bytes > 0),
  width            integer check (width > 0),
  height           integer check (height > 0),
  duration_ms      integer check (duration_ms > 0),
  checksum_sha256  text not null,
  status           asset_status not null default 'pending',
  license_metadata jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid not null references auth.users(id),
  deleted_at       timestamptz
);

comment on table public.assets is 'Uploaded or library-sourced media files stored in Supabase Storage';
comment on column public.assets.storage_key is 'Path within the storage bucket; unique constraint prevents duplicate uploads';
comment on column public.assets.checksum_sha256 is 'SHA-256 hex digest of the file content for deduplication';

create index idx_assets_owner_id on public.assets(owner_id) where deleted_at is null;
create index idx_assets_project_id on public.assets(project_id) where deleted_at is null;

create trigger assets_updated_at
  before update on public.assets
  for each row execute function public.set_updated_at();

-- ─── RLS: assets ──────────────────────────────────────────────────────────────

alter table public.assets enable row level security;

-- Owner can read their own non-deleted assets
create policy "assets_select_owner"
  on public.assets for select
  using (owner_id = auth.uid() and deleted_at is null);

-- Owner can insert their own assets
create policy "assets_insert_owner"
  on public.assets for insert
  with check (owner_id = auth.uid() and created_by = auth.uid());

-- Owner can update their own assets (e.g., soft delete)
create policy "assets_update_owner"
  on public.assets for update
  using (owner_id = auth.uid() and deleted_at is null)
  with check (owner_id = auth.uid());
