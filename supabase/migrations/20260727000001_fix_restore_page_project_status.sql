-- Keep restore_page_atomic type-safe when synchronizing the parent project.
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
  set status = case
    when v_status = 'published' then 'published'::public.project_status
    else 'expired'::public.project_status
  end
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
