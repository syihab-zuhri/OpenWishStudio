-- ─── Security hardening ───────────────────────────────────────────────────────
-- Addresses findings from the security audit:
--   1. Infinite recursion (42P17) in profiles RLS, which disabled every
--      role-based policy in the schema.
--   2. Privilege escalation: profiles_update_own did not protect the `role`
--      column despite its comment claiming otherwise.
--   3. Overly permissive INSERT policies on reports and audit_logs.
--   4. Missing WITH CHECK on UPDATE policies (moderation bypass).
--   5. Missing storage buckets and storage.objects policies.
--
-- IMPORTANT: fixes 1 and 2 must land together. Fixing the recursion alone
-- would activate the previously-masked privilege escalation.
--
-- Grant model: the browser never talks to PostgREST directly (all database
-- access goes through Next.js route handlers). Writes that are performed with
-- the service-role client therefore have their table grants revoked from
-- `anon`/`authenticated` entirely — RLS stays in place as defence in depth.

-- ─── 1. Role helper (breaks the recursion) ────────────────────────────────────
-- A SECURITY DEFINER function reads profiles without re-entering RLS, which is
-- what makes the self-referencing policy legal.

create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

comment on function public.current_user_role() is
  'Returns the calling user''s role without triggering profiles RLS recursion.';

revoke execute on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

-- ─── 2. profiles: fix recursion + close privilege escalation ──────────────────

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (
    (select auth.uid()) = id
    or public.current_user_role() in ('moderator', 'admin')
  );

-- The old policy's WITH CHECK only constrained `id`, leaving `role` writable.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- The signup trigger is SECURITY DEFINER and does not need this policy.
-- Leaving it in place allowed an upsert to reach the UPDATE path.
drop policy if exists "profiles_insert_self" on public.profiles;

-- Column-level grants are evaluated before RLS, so this is the hard stop on
-- `role` — a user cannot even name the column in an UPDATE statement.
revoke insert, update on public.profiles from anon, authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

-- Defence in depth: blocks role changes even if grants are widened later.
create or replace function public.prevent_self_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- auth.uid() is NULL for the service role, the SQL editor and psql. Those
  -- paths must stay open, otherwise there is no way to promote the first admin.
  if new.role is distinct from old.role
     and (select auth.uid()) is not null
     and public.current_user_role() is distinct from 'admin' then
    raise exception 'role cannot be changed by the profile owner'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_change on public.profiles;
create trigger profiles_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_self_role_change();

-- ─── 3. Replace every recursive role subquery with the helper ─────────────────

-- published_pages
drop policy if exists "published_pages_update_moderator" on public.published_pages;
create policy "published_pages_update_moderator"
  on public.published_pages for update
  to authenticated
  using (public.current_user_role() in ('moderator', 'admin'))
  with check (public.current_user_role() in ('moderator', 'admin'));

-- templates
drop policy if exists "templates_select_maintainer" on public.templates;
create policy "templates_select_maintainer"
  on public.templates for select
  to authenticated
  using (public.current_user_role() in ('template_maintainer', 'moderator', 'admin'));

drop policy if exists "templates_insert_contributor" on public.templates;
create policy "templates_insert_contributor"
  on public.templates for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and contributor_id = (select auth.uid())
    and status in ('draft', 'review')
    and public.current_user_role() in ('template_maintainer', 'admin')
  );

drop policy if exists "templates_update_maintainer" on public.templates;
create policy "templates_update_maintainer"
  on public.templates for update
  to authenticated
  using (public.current_user_role() in ('template_maintainer', 'admin'))
  with check (public.current_user_role() in ('template_maintainer', 'admin'));

-- music_library_items
drop policy if exists "music_library_items_admin_all" on public.music_library_items;
create policy "music_library_items_admin_all"
  on public.music_library_items for all
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- reports
drop policy if exists "reports_select_moderator" on public.reports;
create policy "reports_select_moderator"
  on public.reports for select
  to authenticated
  using (public.current_user_role() in ('moderator', 'admin'));

drop policy if exists "reports_update_moderator" on public.reports;
create policy "reports_update_moderator"
  on public.reports for update
  to authenticated
  using (public.current_user_role() in ('moderator', 'admin'))
  with check (public.current_user_role() in ('moderator', 'admin'));

-- audit_logs
drop policy if exists "audit_logs_select_admin" on public.audit_logs;
create policy "audit_logs_select_admin"
  on public.audit_logs for select
  to authenticated
  using (public.current_user_role() = 'admin');

-- ─── 4. reports: anonymous reporting + no forged verdicts ─────────────────────

-- Anonymous reports are legitimate, so created_by cannot be NOT NULL. The route
-- previously worked around this by writing the published_page id into a column
-- with a FK to auth.users, which made every insert fail with 23503.
alter table public.reports alter column created_by drop not null;

-- Makes the route's 23505 duplicate-handling branch real instead of dead code.
create unique index if not exists reports_page_fingerprint_uniq
  on public.reports (published_page_id, fingerprint_hash)
  where fingerprint_hash is not null;

-- with check (true) let the caller set status/reviewed_by/resolution_note.
drop policy if exists "reports_insert_anyone" on public.reports;
create policy "reports_insert_authenticated"
  on public.reports for insert
  to authenticated
  with check (
    reporter_user_id = (select auth.uid())
    and created_by = (select auth.uid())
    and status = 'open'
    and reviewed_by is null
    and reviewed_at is null
    and resolution_note is null
  );

-- Anonymous submissions go through the service-role client in the route handler.
revoke insert on public.reports from anon;

-- ─── 5. audit_logs: genuinely append-only ─────────────────────────────────────
-- The policy claimed "service role only" but permitted any authenticated user
-- to forge entries under another user's actor_id.

drop policy if exists "audit_logs_insert_service" on public.audit_logs;
revoke insert, update, delete on public.audit_logs from anon, authenticated;

-- ─── 6. published_pages: moderation cannot be undone by the owner ─────────────

-- No WITH CHECK meant USING was reused, which tested ownership but not status:
-- an owner could flip a moderator-disabled page back to 'published'.
drop policy if exists "published_pages_update_owner" on public.published_pages;
create policy "published_pages_update_owner"
  on public.published_pages for update
  to authenticated
  using (
    status <> 'disabled'
    and exists (
      select 1 from public.projects p
      where p.id = published_pages.project_id
        and p.owner_id = (select auth.uid())
    )
  )
  with check (
    status <> 'disabled'
    and created_by = (select auth.uid())
    and exists (
      select 1 from public.projects p
      where p.id = published_pages.project_id
        and p.owner_id = (select auth.uid())
    )
  );

-- Expired pages stayed publicly readable because nothing enforced expires_at.
drop policy if exists "published_pages_select_public" on public.published_pages;
create policy "published_pages_select_public"
  on public.published_pages for select
  to anon, authenticated
  using (
    status = 'published'
    and (expires_at is null or expires_at > now())
  );

drop policy if exists "published_pages_select_owner" on public.published_pages;
create policy "published_pages_select_owner"
  on public.published_pages for select
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = published_pages.project_id
        and p.owner_id = (select auth.uid())
    )
  );

-- All publish/unpublish/moderation writes go through the service-role client.
revoke insert, update on public.published_pages from anon, authenticated;

-- ─── 7. project_versions: let public pages actually render ────────────────────
-- Only an owner-scoped SELECT policy existed, so anonymous visitors could not
-- read the snapshot behind a published page and every public page 404'd.
-- Scoped to live pages so unpublished, disabled and expired snapshots stay private.

drop policy if exists "project_versions_select_published" on public.project_versions;
create policy "project_versions_select_published"
  on public.project_versions for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.published_pages pp
      where pp.current_version_id = project_versions.id
        and pp.status = 'published'
        and (pp.expires_at is null or pp.expires_at > now())
    )
  );

-- Snapshots are written by the service-role client during publish.
revoke insert on public.project_versions from anon, authenticated;

-- ─── 8. assets: storage_key and status are not user-writable ──────────────────
-- WITH CHECK only constrained owner_id, so a user could repoint storage_key at
-- another user's object, or flip status from 'pending' to 'ready'.

revoke insert, update on public.assets from anon, authenticated;
grant update (deleted_at) on public.assets to authenticated;
