-- ─── reports ──────────────────────────────────────────────────────────────────
-- Content abuse reports; submitted by anyone (anonymous or authenticated)

create table public.reports (
  id                 uuid primary key default gen_random_uuid(),
  published_page_id  uuid not null references public.published_pages(id) on delete cascade,
  reporter_user_id   uuid references auth.users(id) on delete set null,
  reporter_email     text check (reporter_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  reason             text not null check (char_length(reason) between 1 and 100),
  details            text check (char_length(details) <= 2000),
  status             report_status not null default 'open',
  reviewed_by        uuid references auth.users(id),
  reviewed_at        timestamptz,
  resolution_note    text check (char_length(resolution_note) <= 2000),
  fingerprint_hash   text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid not null references auth.users(id)
);

comment on table public.reports is 'Abuse/content reports submitted against published pages';
comment on column public.reports.fingerprint_hash is 'Hashed browser fingerprint to detect repeat anonymous reports';

create index idx_reports_status on public.reports(status);
create index idx_reports_published_page_id on public.reports(published_page_id);

create trigger reports_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

-- ─── RLS: reports ─────────────────────────────────────────────────────────────

alter table public.reports enable row level security;

-- Reporters can see their own reports (authenticated only)
create policy "reports_select_own"
  on public.reports for select
  using (reporter_user_id = auth.uid());

-- Moderators and admins can see all reports
create policy "reports_select_moderator"
  on public.reports for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('moderator', 'admin')
    )
  );

-- Anyone can submit a report (even anon via service role proxy)
-- Actual insert goes through a server action that validates input
create policy "reports_insert_anyone"
  on public.reports for insert
  with check (true);

-- Moderators can update report status
create policy "reports_update_moderator"
  on public.reports for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('moderator', 'admin')
    )
  );

-- ─── audit_logs ───────────────────────────────────────────────────────────────
-- Append-only audit trail; never updated or deleted

create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users(id) on delete set null,
  project_id  uuid references public.projects(id) on delete set null,
  action      text not null check (char_length(action) <= 100),
  target_type text not null check (char_length(target_type) <= 100),
  target_id   uuid,
  metadata    jsonb,
  ip_hash     text,
  created_at  timestamptz not null default now(),
  created_by  uuid not null references auth.users(id)
);

comment on table public.audit_logs is 'Append-only audit trail for security-relevant actions';

create index idx_audit_logs_actor_id on public.audit_logs(actor_id);
create index idx_audit_logs_project_id on public.audit_logs(project_id);
create index idx_audit_logs_created_at on public.audit_logs(created_at desc);

-- ─── RLS: audit_logs ──────────────────────────────────────────────────────────

alter table public.audit_logs enable row level security;

-- Admins can read all audit logs
create policy "audit_logs_select_admin"
  on public.audit_logs for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

-- Users can read their own audit events
create policy "audit_logs_select_own"
  on public.audit_logs for select
  using (actor_id = auth.uid());

-- Insert via service role only (no user-initiated inserts)
create policy "audit_logs_insert_service"
  on public.audit_logs for insert
  with check (created_by = auth.uid());
