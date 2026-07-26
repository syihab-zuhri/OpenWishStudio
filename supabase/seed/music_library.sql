-- Seed: music_library_items
-- Placeholder entries; replace storage_key with actual Supabase Storage paths after upload

insert into public.music_library_items (title, artist, duration_ms, storage_key, mime_type, license_code, attribution_text, created_by)
values
  -- NOTE: replace created_by with actual admin user UUID after first deploy
  -- These are examples; upload actual audio files to storage bucket 'music-library' first
  (
    'Cinta Abadi',
    'OpenWish Original',
    180000,
    'music-library/cinta-abadi.mp3',
    'audio/mpeg',
    'CC-BY-4.0',
    'Cinta Abadi by OpenWish Original, licensed CC-BY 4.0',
    '00000000-0000-0000-0000-000000000000'
  ),
  (
    'Bahagia Selalu',
    'OpenWish Original',
    210000,
    'music-library/bahagia-selalu.mp3',
    'audio/mpeg',
    'CC-BY-4.0',
    'Bahagia Selalu by OpenWish Original, licensed CC-BY 4.0',
    '00000000-0000-0000-0000-000000000000'
  );
