-- Atomic publication, idempotent imports, expiry maintenance, and route-only
-- mutations for data whose invariants are enforced by Next.js route handlers.

alter table public.projects
  add column if not exists import_idempotency_key text;

create unique index if not exists projects_owner_import_idempotency_uniq
  on public.projects (owner_id, import_idempotency_key)
  where import_idempotency_key is not null and deleted_at is null;

-- One public page is the mutable pointer for exactly one project. The publish
-- route has always assumed this relationship when using maybeSingle().
create unique index if not exists published_pages_project_id_uniq
  on public.published_pages (project_id);

-- Project writes must pass the API validation/rate-limit/concurrency boundary.
-- SELECT remains available under RLS for server components and route reads.
revoke insert, update, delete on public.projects from anon, authenticated;

-- Every report, including authenticated reports, goes through the rate-limited
-- route and its Zod validation.
drop policy if exists "reports_insert_authenticated" on public.reports;
revoke insert on public.reports from anon, authenticated;

-- Signed upload URLs are the only supported browser write path. Keeping these
-- policies would let a session upload or delete arbitrary objects in its folder
-- without creating/checking an assets row.
drop policy if exists "assets_objects_write_own_folder" on storage.objects;
drop policy if exists "assets_objects_update_own_folder" on storage.objects;
drop policy if exists "assets_objects_delete_own_folder" on storage.objects;

-- The earlier migration revoked PUBLIC execute without explicitly granting
-- the service role, making the rate limiter fail closed on every real request.
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
grant execute on function public.prune_rate_limits(integer) to service_role;

create or replace function public.cleanup_stale_pending_assets(
  p_older_than_seconds integer default 86400
)
returns table (asset_id uuid, object_key text)
language sql
security definer
set search_path = ''
as $$
  update public.assets
  set status = 'rejected', deleted_at = now()
  where status = 'pending'
    and deleted_at is null
    and created_at < now() - make_interval(secs => p_older_than_seconds)
  returning id, storage_key;
$$;

revoke execute on function public.cleanup_stale_pending_assets(integer)
  from public, anon, authenticated;
grant execute on function public.cleanup_stale_pending_assets(integer) to service_role;

create or replace function public.publish_project_atomic(
  p_project_id uuid,
  p_actor_id uuid,
  p_document jsonb,
  p_schema_version integer,
  p_content_hash text,
  p_expires_at timestamptz,
  p_new_slug text
)
returns table (published_slug text, published_version_no integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects%rowtype;
  v_page public.published_pages%rowtype;
  v_version_id uuid := gen_random_uuid();
  v_version_no integer;
  v_slug text;
  v_now timestamptz := now();
begin
  select * into v_project
  from public.projects
  where id = p_project_id and deleted_at is null
  for update;

  if not found or v_project.owner_id <> p_actor_id then
    raise exception 'project not found' using errcode = 'P0002';
  end if;

  if p_expires_at is not null and p_expires_at <= v_now then
    raise exception 'expiry must be in the future' using errcode = '22007';
  end if;

  if exists (
    select 1 from public.assets
    where project_id = p_project_id
      and status = 'pending'
      and deleted_at is null
  ) then
    raise exception 'project has pending assets' using errcode = '55000';
  end if;

  select * into v_page
  from public.published_pages
  where project_id = p_project_id
  for update;

  if found and v_page.status = 'disabled' then
    raise exception 'disabled pages can only be restored by a moderator'
      using errcode = '42501';
  end if;

  select coalesce(max(version_no), 0) + 1
    into v_version_no
  from public.project_versions
  where project_id = p_project_id;

  insert into public.project_versions (
    id, project_id, version_no, schema_version, document_snapshot,
    content_hash, created_by
  ) values (
    v_version_id, p_project_id, v_version_no, p_schema_version, p_document,
    p_content_hash, p_actor_id
  );

  if v_page.id is not null then
    v_slug := v_page.slug;
    update public.published_pages
    set current_version_id = v_version_id,
        status = 'published',
        expires_at = p_expires_at,
        published_at = v_now,
        unpublished_at = null
    where id = v_page.id;
  else
    v_slug := p_new_slug;
    insert into public.published_pages (
      project_id, current_version_id, slug, status, expires_at,
      published_at, created_by
    ) values (
      p_project_id, v_version_id, v_slug, 'published', p_expires_at,
      v_now, p_actor_id
    );
  end if;

  update public.projects
  set status = 'published'
  where id = p_project_id;

  insert into public.audit_logs (
    actor_id, project_id, action, target_type, target_id, metadata, created_by
  ) values (
    p_actor_id,
    p_project_id,
    case when v_page.id is null then 'project.publish' else 'project.republish' end,
    'project',
    p_project_id,
    jsonb_build_object(
      'slug', v_slug,
      'versionNo', v_version_no,
      'expiresAt', p_expires_at
    ),
    p_actor_id
  );

  return query select v_slug, v_version_no;
end;
$$;

revoke execute on function public.publish_project_atomic(
  uuid, uuid, jsonb, integer, text, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.publish_project_atomic(
  uuid, uuid, jsonb, integer, text, timestamptz, text
) to service_role;

create or replace function public.unpublish_project_atomic(
  p_project_id uuid,
  p_actor_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects%rowtype;
  v_page public.published_pages%rowtype;
begin
  select * into v_project
  from public.projects
  where id = p_project_id and deleted_at is null
  for update;

  if not found or v_project.owner_id <> p_actor_id then
    raise exception 'project not found' using errcode = 'P0002';
  end if;

  select * into v_page
  from public.published_pages
  where project_id = p_project_id
  for update;

  if not found then
    raise exception 'published page not found' using errcode = 'P0002';
  end if;

  if v_page.status = 'disabled' then
    raise exception 'disabled pages can only be restored by a moderator'
      using errcode = '42501';
  end if;

  if v_page.status <> 'unpublished' then
    update public.published_pages
    set status = 'unpublished', unpublished_at = now()
    where id = v_page.id;

    update public.projects
    set status = 'draft'
    where id = p_project_id;

    insert into public.audit_logs (
      actor_id, project_id, action, target_type, target_id, metadata, created_by
    ) values (
      p_actor_id, p_project_id, 'project.unpublish', 'project', p_project_id,
      '{}'::jsonb, p_actor_id
    );
  end if;

  return 'unpublished';
end;
$$;

revoke execute on function public.unpublish_project_atomic(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.unpublish_project_atomic(uuid, uuid) to service_role;

create or replace function public.soft_delete_project_atomic(
  p_project_id uuid,
  p_actor_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects%rowtype;
  v_page public.published_pages%rowtype;
begin
  select * into v_project
  from public.projects
  where id = p_project_id and deleted_at is null
  for update;

  if not found or v_project.owner_id <> p_actor_id then
    raise exception 'project not found' using errcode = 'P0002';
  end if;

  select * into v_page
  from public.published_pages
  where project_id = p_project_id
  for update;

  if found and v_page.status <> 'disabled' then
    update public.published_pages
    set status = 'unpublished', unpublished_at = now()
    where id = v_page.id;
  end if;

  update public.projects
  set deleted_at = now()
  where id = p_project_id;

  insert into public.audit_logs (
    actor_id, project_id, action, target_type, target_id, metadata, created_by
  ) values (
    p_actor_id, p_project_id, 'project.delete', 'project', p_project_id,
    jsonb_build_object('previousProjectStatus', v_project.status, 'pageStatus', v_page.status),
    p_actor_id
  );

  return true;
end;
$$;

revoke execute on function public.soft_delete_project_atomic(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.soft_delete_project_atomic(uuid, uuid) to service_role;

create or replace function public.disable_page_atomic(
  p_page_id uuid,
  p_actor_id uuid,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_page public.published_pages%rowtype;
  v_role public.user_role;
begin
  select role into v_role
  from public.profiles
  where id = p_actor_id;

  if v_role is null or v_role not in ('moderator', 'admin') then
    raise exception 'moderator role required' using errcode = '42501';
  end if;

  select * into v_page
  from public.published_pages
  where id = p_page_id
  for update;

  if not found then
    raise exception 'published page not found' using errcode = 'P0002';
  end if;

  if v_page.status <> 'disabled' then
    update public.published_pages
    set status = 'disabled'
    where id = p_page_id;

    insert into public.audit_logs (
      actor_id, project_id, action, target_type, target_id, metadata, created_by
    ) values (
      p_actor_id, v_page.project_id, 'page.disable', 'published_page', p_page_id,
      jsonb_build_object('reason', p_reason, 'previousStatus', v_page.status), p_actor_id
    );
  end if;

  return 'disabled';
end;
$$;

revoke execute on function public.disable_page_atomic(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.disable_page_atomic(uuid, uuid, text) to service_role;

create or replace function public.restore_page_atomic(
  p_page_id uuid,
  p_actor_id uuid,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_page public.published_pages%rowtype;
  v_role public.user_role;
  v_status public.page_status;
begin
  select role into v_role
  from public.profiles
  where id = p_actor_id;

  if v_role is null or v_role not in ('moderator', 'admin') then
    raise exception 'moderator role required' using errcode = '42501';
  end if;

  select pp.* into v_page
  from public.published_pages pp
  join public.projects p on p.id = pp.project_id and p.deleted_at is null
  where pp.id = p_page_id
  for update of pp;

  if not found then
    raise exception 'published page not found' using errcode = 'P0002';
  end if;

  if v_page.status <> 'disabled' then
    raise exception 'only disabled pages can be restored' using errcode = '55000';
  end if;

  v_status := case
    when v_page.expires_at is not null and v_page.expires_at <= now()
      then 'expired'::public.page_status
    else 'published'::public.page_status
  end;

  update public.published_pages
  set status = v_status
  where id = p_page_id;

  update public.projects
  set status = case when v_status = 'published' then 'published' else 'expired' end
  where id = v_page.project_id;

  insert into public.audit_logs (
    actor_id, project_id, action, target_type, target_id, metadata, created_by
  ) values (
    p_actor_id, v_page.project_id, 'page.restore', 'published_page', p_page_id,
    jsonb_build_object('reason', p_reason, 'restoredStatus', v_status), p_actor_id
  );

  return v_status::text;
end;
$$;

revoke execute on function public.restore_page_atomic(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.restore_page_atomic(uuid, uuid, text) to service_role;

create or replace function public.expire_publications(p_owner_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with expired as (
    update public.published_pages pp
    set status = 'expired'
    where pp.status = 'published'
      and pp.expires_at is not null
      and pp.expires_at <= now()
      and (
        p_owner_id is null
        or exists (
          select 1 from public.projects p
          where p.id = pp.project_id and p.owner_id = p_owner_id
        )
      )
    returning pp.project_id
  ), project_updates as (
    update public.projects p
    set status = 'expired'
    where p.id in (select project_id from expired)
    returning p.id
  )
  select count(*) into v_count from expired;

  return v_count;
end;
$$;

revoke execute on function public.expire_publications(uuid)
  from public, anon, authenticated;
grant execute on function public.expire_publications(uuid) to service_role;
