-- Seed: music_library_items (sinkron dengan produksi per 27 Jul 2026)
-- File audio adalah komposisi original OpenWish (disintesis programatik, CC0)
-- dan sudah berada di bucket 'music-library' dengan storage_key di bawah.
-- created_by: ganti dengan UUID user admin bila diterapkan ke project lain.

insert into public.music_library_items
  (title, artist, duration_ms, storage_key, mime_type, license_code, attribution_text, status, created_by)
values
  (
    'Melodi Bahagia',
    'OpenWish Original',
    30000,
    'melodi-bahagia.wav',
    'audio/wav',
    'CC0',
    'Melodi Bahagia — OpenWish Original (CC0)',
    'active',
    'aa684585-0e9e-4740-a140-ff02fdc1c6a1'
  ),
  (
    'Senja Tenang',
    'OpenWish Original',
    30000,
    'senja-tenang.wav',
    'audio/wav',
    'CC0',
    'Senja Tenang — OpenWish Original (CC0)',
    'active',
    'aa684585-0e9e-4740-a140-ff02fdc1c6a1'
  )
on conflict (storage_key) do update set
  title = excluded.title,
  artist = excluded.artist,
  duration_ms = excluded.duration_ms,
  mime_type = excluded.mime_type,
  license_code = excluded.license_code,
  attribution_text = excluded.attribution_text,
  status = excluded.status;
