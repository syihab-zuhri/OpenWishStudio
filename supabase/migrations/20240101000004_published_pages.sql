-- ─── published_pages ──────────────────────────────────────────────────────────
-- Public-facing pages reachable by slug; readable without auth

create table public.published_pages (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.projects(id) on delete cascade,
  current_version_id uuid not null references public.project_versions(id),
  slug               text not null unique check (
                       slug ~ '^[a-zA-Z0-9][a-zA-Z0-9\-]{2,62}[a-zA-Z0-9]$'
                     ),
  status             page_status not null default 'published',
  published_at       timestamptz not null default now(),
  expires_at         timestamptz,
  unpublished_at     timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid not null references auth.users(id)
);

comment on table public.published_pages is 'Publicly accessible greeting pages; slug is the unlisted share key';
comment on column public.published_pages.slug is 'URL-safe slug (4–64 chars, alphanumeric + hyphens); unique across all pages';

create index idx_published_pages_project_id on public.published_pages(project_id);
create index idx_published_pages_slug on public.published_pages(slug) where status = 'published';

create trigger published_pages_updated_at
  before update on public.published_pages
  for each row execute function public.set_updated_at();

-- ─── RLS: published_pages ─────────────────────────────────────────────────────

alter table public.published_pages enable row level security;

-- Anyone (even anon) can read published pages for viewing
create policy "published_pages_select_public"
  on public.published_pages for select
  using (status = 'published');

-- Owner can also read their own pages regardless of status
create policy "published_pages_select_owner"
  on public.published_pages for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = published_pages.project_id
        and p.owner_id = auth.uid()
    )
  );

-- Owner can insert (publish) for their own projects
create policy "published_pages_insert_owner"
  on public.published_pages for insert
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = published_pages.project_id
        and p.owner_id = auth.uid()
    )
  );

-- Owner can update (expire/unpublish) their own pages
create policy "published_pages_update_owner"
  on public.published_pages for update
  using (
    exists (
      select 1 from public.projects p
      where p.id = published_pages.project_id
        and p.owner_id = auth.uid()
    )
  );

-- Moderator/admin can update any page (e.g., disable for content moderation)
create policy "published_pages_update_moderator"
  on public.published_pages for update
  using (
    exists (
      select 1 from public.profiles pr
      where pr.id = auth.uid()
        and pr.role in ('moderator', 'admin')
    )
  );
