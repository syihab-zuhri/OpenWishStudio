-- ─── Fix: soft delete projects tertolak RLS ─────────────────────────────────
-- Gejala: UPDATE yang mengisi deleted_at gagal dengan "new row violates
-- row-level security policy" — WITH CHECK kebijakan update di database
-- produksi memuat syarat "deleted_at is null", sehingga baris hasil update
-- (deleted_at terisi) selalu ditolak.
--
-- Niat awal (lihat 20240101000002): USING membatasi operasi ke baris yang
-- masih aktif; WITH CHECK cukup memastikan kepemilikan supaya soft delete
-- (mengisi deleted_at) tetap diizinkan.

drop policy if exists "projects_update_owner" on public.projects;
create policy "projects_update_owner"
  on public.projects for update
  using (owner_id = (select auth.uid()) and deleted_at is null)
  with check (owner_id = (select auth.uid()));
