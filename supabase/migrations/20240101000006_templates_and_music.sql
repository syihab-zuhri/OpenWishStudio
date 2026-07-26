-- ─── music_library_items ──────────────────────────────────────────────────────
-- Curated music tracks managed by admins; readable by all authenticated users

create table public.music_library_items (
  id               uuid primary key default gen_random_uuid(),
  title            text not null check (char_length(title) between 1 and 500),
  artist           text check (char_length(artist) <= 500),
  duration_ms      integer not null check (duration_ms > 0),
  storage_key      text not null unique,
  mime_type        text not null,
  license_code     text not null,
  license_url      text,
  attribution_text text,
  status           music_status not null default 'active',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid not null references auth.users(id)
);

comment on table public.music_library_items is 'Curated royalty-free music tracks available to all users in the editor';

create index idx_music_library_items_status on public.music_library_items(status);

create trigger music_library_items_updated_at
  before update on public.music_library_items
  for each row execute function public.set_updated_at();

-- ─── RLS: music_library_items ─────────────────────────────────────────────────

alter table public.music_library_items enable row level security;

-- All authenticated users can read active music library items
create policy "music_library_items_select_authenticated"
  on public.music_library_items for select
  to authenticated
  using (status = 'active');

-- Admin-only writes (done via service role in practice)
create policy "music_library_items_admin_all"
  on public.music_library_items for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

-- ─── templates ────────────────────────────────────────────────────────────────

create table public.templates (
  id               uuid primary key default gen_random_uuid(),
  contributor_id   uuid references auth.users(id) on delete set null,
  slug             text not null unique check (slug ~ '^[a-z][a-z0-9\-]{1,62}[a-z0-9]$'),
  name             text not null check (char_length(name) between 1 and 500),
  category         text not null check (char_length(category) <= 100),
  status           template_status not null default 'draft',
  schema_version   integer not null default 1 check (schema_version >= 1),
  scene_document   jsonb not null,
  thumbnail_url    text,
  license_metadata jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid not null references auth.users(id),
  deleted_at       timestamptz
);

comment on table public.templates is 'Scene templates; status=published means visible in the template picker';

create index idx_templates_status on public.templates(status) where deleted_at is null;
create index idx_templates_category on public.templates(category) where status = 'published' and deleted_at is null;

create trigger templates_updated_at
  before update on public.templates
  for each row execute function public.set_updated_at();

-- ─── RLS: templates ───────────────────────────────────────────────────────────

alter table public.templates enable row level security;

-- Anyone (even anon) can read published templates
create policy "templates_select_published"
  on public.templates for select
  using (status = 'published' and deleted_at is null);

-- Contributors can read their own templates (to see draft/review status)
create policy "templates_select_contributor"
  on public.templates for select
  using (contributor_id = auth.uid() and deleted_at is null);

-- template_maintainer and admin can read all templates (for moderation)
create policy "templates_select_maintainer"
  on public.templates for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('template_maintainer', 'moderator', 'admin')
    )
  );

-- Contributors can insert their own templates (status defaults to draft/review)
create policy "templates_insert_contributor"
  on public.templates for insert
  with check (
    created_by = auth.uid()
    and contributor_id = auth.uid()
    and status in ('draft', 'review')
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('template_maintainer', 'admin')
    )
  );

-- Maintainers can update any template (status transitions, moderation)
create policy "templates_update_maintainer"
  on public.templates for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('template_maintainer', 'admin')
    )
  );
