-- ─── Rate limiting ────────────────────────────────────────────────────────────
-- Nothing in the app was rate limited, including the unauthenticated abuse
-- report endpoint, which any client could call in a loop.
--
-- Postgres-backed rather than in-memory: the app runs serverless on Vercel, so
-- a per-process counter is near-useless — each instance keeps its own tally and
-- is recycled constantly. Postgres is the only shared state available without
-- introducing another service.
--
-- Fixed-window counter. A caller can burst up to 2x the limit across a window
-- boundary; that is an accepted trade for keeping this to a single round trip
-- and no extra infrastructure.

create table public.rate_limits (
  bucket       text primary key,
  window_start timestamptz not null default now(),
  count        integer not null default 0
);

comment on table public.rate_limits is
  'Fixed-window request counters. Written only by check_rate_limit(); no end-user access.';

create index idx_rate_limits_window_start on public.rate_limits (window_start);

-- Only the service role touches this table, and it bypasses RLS. Enabling RLS
-- with no policies means anon/authenticated get nothing even if a grant is
-- added by mistake later.
alter table public.rate_limits enable row level security;

revoke all on public.rate_limits from anon, authenticated;

/**
 * Records one hit against `p_bucket` and reports whether it is within budget.
 *
 * Returns true when the request should proceed. The counter is incremented
 * either way, so a caller that keeps hammering stays blocked for the rest of
 * the window.
 */
create or replace function public.check_rate_limit(
  p_bucket         text,
  p_max            integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_cutoff timestamptz := now() - make_interval(secs => p_window_seconds);
begin
  insert into public.rate_limits as rl (bucket, window_start, count)
  values (p_bucket, now(), 1)
  on conflict (bucket) do update
    set count        = case when rl.window_start < v_cutoff then 1 else rl.count + 1 end,
        window_start = case when rl.window_start < v_cutoff then now() else rl.window_start end
  returning rl.count into v_count;

  return v_count <= p_max;
end;
$$;

comment on function public.check_rate_limit(text, integer, integer) is
  'Increments a fixed-window counter and returns true if the caller is within budget.';

-- End users must never call this directly: it is the enforcement mechanism, and
-- an attacker who could invoke it would be able to burn another key''s budget.
revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;

/**
 * Drops counters whose window closed long ago, so the table does not grow
 * without bound. Safe to call from a cron job; also called opportunistically.
 */
create or replace function public.prune_rate_limits(p_older_than_seconds integer default 86400)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.rate_limits
  where window_start < now() - make_interval(secs => p_older_than_seconds);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function public.prune_rate_limits(integer) from public, anon, authenticated;
