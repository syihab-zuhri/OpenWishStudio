-- ─── Security invariant assertions ────────────────────────────────────────────
-- These statements change nothing. Each one asserts a property the two
-- preceding hardening migrations were written to establish, and aborts the push
-- with a readable message if the property does not hold.
--
-- The point is verification without a live psql session: if this migration
-- applies cleanly, the invariants below are true of the remote database.
-- Keeping it in history also documents what must stay true.

-- ── 1. `role` is not writable by end users ────────────────────────────────────
-- The original bug: profiles_update_own claimed to protect `role` but its
-- WITH CHECK only constrained `id`. Column-level grants are the real control.
do $$
declare
  offending text;
begin
  select string_agg(column_name, ', ' order by column_name)
    into offending
  from information_schema.column_privileges
  where table_schema   = 'public'
    and table_name     = 'profiles'
    and grantee        = 'authenticated'
    and privilege_type = 'UPDATE'
    and column_name not in ('display_name', 'avatar_url');

  if offending is not null then
    raise exception
      'INVARIANT FAILED: authenticated holds UPDATE on profiles column(s): %. Privilege escalation is open.',
      offending;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'profiles'
      and grantee in ('anon', 'authenticated')
      and privilege_type in ('UPDATE', 'INSERT')
  ) then
    raise exception
      'INVARIANT FAILED: table-level INSERT/UPDATE on profiles is still granted to anon or authenticated.';
  end if;
end $$;

-- ── 2. The recursion fix is in place ──────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'current_user_role' and p.prosecdef
  ) then
    raise exception
      'INVARIANT FAILED: public.current_user_role() is missing or not SECURITY DEFINER.';
  end if;
end $$;

-- No policy on `profiles` may reference `profiles` again — that is the exact
-- shape that produced 42P17 and disabled every role-based policy.
do $$
declare
  offending text;
begin
  select string_agg(policyname, ', ' order by policyname)
    into offending
  from pg_policies
  where schemaname = 'public'
    and tablename  = 'profiles'
    and coalesce(qual, '') || coalesce(with_check, '') like '%profiles%';

  if offending is not null then
    raise exception
      'INVARIANT FAILED: self-referencing policy on profiles: %. This causes 42P17.',
      offending;
  end if;
end $$;

-- ── 3. audit_logs is append-only for end users ────────────────────────────────
do $$
begin
  if exists (
    select 1 from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'audit_logs'
      and grantee in ('anon', 'authenticated')
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  ) then
    raise exception
      'INVARIANT FAILED: audit_logs is writable by anon or authenticated; entries can be forged.';
  end if;
end $$;

-- ── 4. No table in `public` is left without RLS ───────────────────────────────
do $$
declare
  offending text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
    into offending
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

  if offending is not null then
    raise exception
      'INVARIANT FAILED: table(s) in public without RLS: %.', offending;
  end if;
end $$;

-- ── 5. SVG cannot be stored in the assets bucket ──────────────────────────────
-- Served from the storage origin, an SVG executes rather than renders.
do $$
begin
  if exists (
    select 1 from storage.buckets
    where id = 'assets'
      and (allowed_mime_types is null or 'image/svg+xml' = any(allowed_mime_types))
  ) then
    raise exception
      'INVARIANT FAILED: assets bucket allows image/svg+xml (or has no MIME allow-list at all).';
  end if;
end $$;
