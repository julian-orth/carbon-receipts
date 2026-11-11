begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email, encrypted_password, raw_app_meta_data) values
  ('aaaa0000-0000-0000-0000-000000000001', 'owner@example.com', 'x', '{}'),
  ('aaaa0000-0000-0000-0000-000000000002', 'victim@example.com', 'x', '{}'),
  ('aaaa0000-0000-0000-0000-000000000003', 'demo@example.com', 'old-hash', '{"demo": true}');

-- ---------------------------------------------------------------------------
-- 1. file_path must be in the owner's folder
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaa0000-0000-0000-0000-000000000001", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.receipts (file_path, source_type)
     values ('aaaa0000-0000-0000-0000-000000000001/1b2c.jpg', 'photo') $$,
  'a user can reference a file in their own folder'
);
select throws_ok(
  $$ insert into public.receipts (file_path, source_type)
     values ('aaaa0000-0000-0000-0000-000000000002/1b2c.jpg', 'photo') $$,
  '23514', null,
  'a user cannot reference a file in another user''s folder'
);
select throws_ok(
  $$ insert into public.receipts (file_path, source_type)
     values ('aaaa0000-0000-0000-0000-000000000001/../aaaa0000-0000-0000-0000-000000000002/x.jpg', 'photo') $$,
  '23514', null,
  'path traversal out of the own folder is rejected'
);
select throws_ok(
  $$ insert into public.receipts (file_path, source_type) values ('x.jpg', 'photo') $$,
  '23514', null,
  'a path without the owner folder is rejected'
);

reset role;

select throws_ok(
  $$ insert into public.receipts (user_id, file_path, source_type)
     values ('aaaa0000-0000-0000-0000-000000000001', 'aaaa0000-0000-0000-0000-000000000002/x.jpg', 'photo') $$,
  '23514', null,
  'the check also holds for the service role'
);

-- ---------------------------------------------------------------------------
-- 2. The demo account keeps its credentials
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ update auth.users set encrypted_password = 'new-hash' where id = 'aaaa0000-0000-0000-0000-000000000003' $$,
  '42501', null,
  'the demo password cannot be changed'
);
select throws_ok(
  $$ update auth.users set email_change = 'attacker@example.com' where id = 'aaaa0000-0000-0000-0000-000000000003' $$,
  '42501', null,
  'the demo email cannot be changed'
);
select lives_ok(
  $$ update auth.users set last_sign_in_at = now() where id = 'aaaa0000-0000-0000-0000-000000000003' $$,
  'the demo account can still sign in'
);
select lives_ok(
  $$ update auth.users
     set encrypted_password = 'admin-hash', raw_app_meta_data = raw_app_meta_data || '{"demo": false}'
     where id = 'aaaa0000-0000-0000-0000-000000000003' $$,
  'an admin can change it by clearing the flag in the same update'
);
select lives_ok(
  $$ update auth.users set encrypted_password = 'new-hash' where id = 'aaaa0000-0000-0000-0000-000000000001' $$,
  'other users can still change their password'
);

select * from finish();
rollback;
