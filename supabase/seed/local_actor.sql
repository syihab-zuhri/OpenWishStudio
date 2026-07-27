-- Stable local-only actor required by the template seed's created_by FK.
-- It is intentionally not a usable login account.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  'aa684585-0e9e-4740-a140-ff02fdc1c6a1',
  'authenticated',
  'authenticated',
  'seed-actor@openwish.local',
  '!',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"OpenWish Seed"}'::jsonb,
  '',
  '',
  '',
  '',
  now(),
  now()
)
on conflict (id) do nothing;
