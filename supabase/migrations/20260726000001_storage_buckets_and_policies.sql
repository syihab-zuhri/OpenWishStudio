-- ─── Storage buckets and object policies ───────────────────────────
-- Split out of 20260726000000_security_hardening.sql on purpose: creating
-- policies on storage.objects requires privileges the migration role does not
-- always hold, and a failure here would otherwise roll back the RLS and
-- privilege-escalation fixes in that migration.
--
-- If this migration fails with insufficient_privilege, apply it from the
-- Supabase dashboard SQL editor instead; the hardening migration stays applied.

-- These existed only as manual dashboard state; nothing guaranteed the MIME
-- allow-list, the size ceiling, or per-user path scoping.
--
-- `assets` is public-read on purpose: published pages are public and reference
-- objects by URL. Confidentiality comes from the unguessable UUID path. SVG is
-- deliberately excluded — it is script-bearing and would execute on the
-- storage origin.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assets',
  'assets',
  true,
  52428800, -- 50 MiB, matches the audio ceiling in the upload-intent route
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/aac'
  ]
)
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'music-library',
  'music-library',
  true,
  52428800,
  array['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/aac']
)
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Writes are confined to `<uid>/...`, matching the key layout built in
-- apps/web/src/app/api/v1/assets/upload-intents/route.ts.
drop policy if exists "assets_objects_write_own_folder" on storage.objects;
create policy "assets_objects_write_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "assets_objects_update_own_folder" on storage.objects;
create policy "assets_objects_update_own_folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "assets_objects_delete_own_folder" on storage.objects;
create policy "assets_objects_delete_own_folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "assets_objects_read_public" on storage.objects;
create policy "assets_objects_read_public"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id in ('assets', 'music-library'));
