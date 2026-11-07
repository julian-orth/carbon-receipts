-- Local seed: demo account with six months of data.
-- Login: demo@carbon-receipts.app / demo-carbon-receipts (also used by the E2E tests).
-- Production: create the user in the dashboard and run
--   select private.reset_demo_data((select id from auth.users where email = 'demo@carbon-receipts.app'));

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  'de300000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated',
  'demo@carbon-receipts.app',
  extensions.crypt('demo-carbon-receipts', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Demo"}',
  now(), now(), '', '', '', ''
);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  gen_random_uuid(),
  'de300000-0000-4000-8000-000000000001',
  'de300000-0000-4000-8000-000000000001',
  '{"sub": "de300000-0000-4000-8000-000000000001", "email": "demo@carbon-receipts.app", "email_verified": true}',
  'email', now(), now(), now()
);

-- The demo is public: keep AI usage low.
update public.profiles set daily_ai_quota = 5 where id = 'de300000-0000-4000-8000-000000000001';

select private.reset_demo_data('de300000-0000-4000-8000-000000000001');
