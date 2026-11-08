begin;
create extension if not exists pgtap with schema extensions;

select plan(21);

-- ---------------------------------------------------------------------------
-- Fixtures (run as postgres, bypassing RLS)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com', '{"full_name":"Alice"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com', '{}');

insert into public.emission_categories (id, slug, label, unit, co2e_per_unit, source)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'test-beef', 'Test-Rind', 'kg', 27.0, 'test');

insert into public.receipts (id, user_id, source_type, status)
values
  ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'photo', 'review'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'photo', 'done');

insert into public.line_items (receipt_id, user_id, raw_text, co2e_kg, category_id)
values
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'RINDERHACK', 13.5,
   'aaaaaaaa-0000-0000-0000-000000000001');

insert into public.category_mappings (user_id, normalized_name, category_id)
values
  (null, 'rinderhack', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('22222222-2222-2222-2222-222222222222', 'hack gemischt', 'aaaaaaaa-0000-0000-0000-000000000001');

-- ---------------------------------------------------------------------------
-- Trigger: profile is created for new users
-- ---------------------------------------------------------------------------
select is(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Alice',
  'profile is created from auth user metadata'
);

-- ---------------------------------------------------------------------------
-- As Alice
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is((select count(*) from public.receipts)::int, 1, 'Alice only sees her own receipts');
select is((select count(*) from public.line_items)::int, 0, 'Alice cannot see Bob''s line items');
select is((select count(*) from public.monthly_emissions)::int, 0, 'Alice cannot see Bob''s emissions');
select is((select count(*) from public.profiles)::int, 1, 'Alice only sees her own profile');
select is((select count(*) from public.category_mappings)::int, 1, 'Alice sees global but not Bob''s mappings');
select ok((select count(*) from public.emission_categories) > 1, 'emission categories are readable');

select lives_ok(
  $$ insert into public.receipts (source_type) values ('photo') $$,
  'Alice can create a receipt (user_id defaults to auth.uid())'
);

select throws_ok(
  $$ insert into public.receipts (source_type, status) values ('photo', 'done') $$,
  '42501', null,
  'Alice cannot set the status on insert'
);

select throws_ok(
  $$ insert into public.receipts (user_id, source_type)
     values ('22222222-2222-2222-2222-222222222222', 'photo') $$,
  '42501', null,
  'Alice cannot set user_id explicitly'
);

select lives_ok(
  $$ update public.receipts set status = 'done' where id = 'bbbbbbbb-0000-0000-0000-000000000001' $$,
  'Alice can confirm a reviewed receipt (review -> done)'
);

select throws_ok(
  $$ update public.receipts set status = 'processing' where id = 'bbbbbbbb-0000-0000-0000-000000000001' $$,
  '23514', null,
  'Alice cannot move a receipt to processing'
);

select is_empty(
  $$ update public.receipts set merchant = 'hacked'
     where id = 'bbbbbbbb-0000-0000-0000-000000000002' returning id $$,
  'Alice cannot update Bob''s receipt'
);

select throws_ok(
  $$ insert into public.line_items (receipt_id, raw_text)
     values ('bbbbbbbb-0000-0000-0000-000000000002', 'injected') $$,
  null, null,
  'Alice cannot attach line items to Bob''s receipt'
);

select throws_ok(
  $$ insert into public.category_mappings (user_id, normalized_name, category_id)
     values (null, 'global', 'aaaaaaaa-0000-0000-0000-000000000001') $$,
  '42501', null,
  'Alice cannot create global mappings'
);

select lives_ok(
  $$ insert into public.category_mappings (normalized_name, category_id)
     values ('hafer drink', 'aaaaaaaa-0000-0000-0000-000000000001')
     on conflict (user_id, normalized_name) do update
       set normalized_name = excluded.normalized_name, category_id = excluded.category_id $$,
  'Alice can upsert her own mapping (review correction)'
);

select lives_ok(
  $$ insert into public.category_mappings (normalized_name, category_id)
     values ('hafer drink', 'aaaaaaaa-0000-0000-0000-000000000001')
     on conflict (user_id, normalized_name) do update
       set normalized_name = excluded.normalized_name, category_id = excluded.category_id $$,
  'upserting the same mapping again updates it'
);

select is(
  (select count(*) from public.category_mappings where normalized_name = 'hafer drink')::int,
  1,
  'two upserts leave a single mapping'
);

select lives_ok(
  $$ insert into public.category_mappings (normalized_name, category_id, quantity, unit)
     values ('kinder bueno', 'aaaaaaaa-0000-0000-0000-000000000001', 0.043, 'kg')
     on conflict (user_id, normalized_name) do update
       set category_id = excluded.category_id, quantity = excluded.quantity, unit = excluded.unit $$,
  'Alice can learn an amount for a product'
);

select throws_ok(
  $$ insert into public.category_mappings (normalized_name, category_id, quantity)
     values ('halbe menge', 'aaaaaaaa-0000-0000-0000-000000000001', 1) $$,
  '23514', null,
  'a learned amount needs both quantity and unit'
);

-- ---------------------------------------------------------------------------
-- As anon
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$ select count(*) from public.receipts $$,
  '42501', null,
  'anon has no access to receipts at all'
);

select * from finish();
rollback;
