-- ─── Positive control for the invariant assertions ────────────────────────────
-- 20260726000002 proves things by finding *no* offending rows. That style of
-- check passes vacuously if the catalog query is wrong and returns nothing at
-- all. This asserts the opposite direction: the grants that are supposed to
-- exist really do, which means the queries in the previous migration were
-- looking at a populated view and their silence was meaningful.

do $$
declare
  granted text;
begin
  select string_agg(column_name, ', ' order by column_name)
    into granted
  from information_schema.column_privileges
  where table_schema   = 'public'
    and table_name     = 'profiles'
    and grantee        = 'authenticated'
    and privilege_type = 'UPDATE';

  if granted is distinct from 'avatar_url, display_name' then
    raise exception
      'POSITIVE CONTROL FAILED: expected authenticated to hold UPDATE on exactly (avatar_url, display_name), found: %.',
      coalesce(granted, '<none — the catalog query returns no rows, so the invariant checks were vacuous>');
  end if;
end $$;

-- Same idea for RLS: prove the policy catalog is readable and populated, so
-- "no self-referencing policy found" was a real result rather than an empty one.
do $$
declare
  n int;
begin
  select count(*) into n
  from pg_policies
  where schemaname = 'public' and tablename = 'profiles';

  if n = 0 then
    raise exception
      'POSITIVE CONTROL FAILED: no policies visible on public.profiles; the 42P17 check was vacuous.';
  end if;
end $$;
