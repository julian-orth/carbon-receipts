begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

insert into auth.users (id, email) values
  ('aaaaaaaa-1111-1111-1111-111111111111', 'dup-a@example.com'),
  ('aaaaaaaa-2222-2222-2222-222222222222', 'dup-b@example.com');

-- A: two identical receipts, one lookalike with another price, one on another day, one failed.
insert into public.receipts (id, user_id, source_type, status, merchant, purchased_at, error) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-1111-1111-1111-111111111111', 'photo', 'done', 'REWE', '2026-11-03', null),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-1111-1111-1111-111111111111', 'photo', 'review', ' rewe ', '2026-11-03', null),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-1111-1111-1111-111111111111', 'photo', 'review', 'REWE', '2026-11-03', null),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'aaaaaaaa-1111-1111-1111-111111111111', 'photo', 'review', 'REWE', '2026-11-04', null),
  ('bbbbbbbb-0000-0000-0000-000000000005', 'aaaaaaaa-1111-1111-1111-111111111111', 'photo', 'failed', 'REWE', '2026-11-03', 'kaputt'),
  ('bbbbbbbb-0000-0000-0000-000000000009', 'aaaaaaaa-2222-2222-2222-222222222222', 'photo', 'done', 'REWE', '2026-11-03', null);

insert into public.line_items (receipt_id, user_id, raw_text, price, co2e_kg) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-1111-1111-1111-111111111111', 'Käse', 2.50, 1.7),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-1111-1111-1111-111111111111', 'Duschgel', 1.99, null),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-1111-1111-1111-111111111111', 'Käse', 2.50, 1.7),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-1111-1111-1111-111111111111', 'Duschgel', 1.99, null),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-1111-1111-1111-111111111111', 'Käse', 2.50, 1.7),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-1111-1111-1111-111111111111', 'Duschgel', 2.49, null),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'aaaaaaaa-1111-1111-1111-111111111111', 'Käse', 2.50, 1.7),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'aaaaaaaa-1111-1111-1111-111111111111', 'Duschgel', 1.99, null),
  ('bbbbbbbb-0000-0000-0000-000000000009', 'aaaaaaaa-2222-2222-2222-222222222222', 'Käse', 2.50, 1.7),
  ('bbbbbbbb-0000-0000-0000-000000000009', 'aaaaaaaa-2222-2222-2222-222222222222', 'Duschgel', 1.99, null);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-1111-1111-1111-111111111111","role":"authenticated"}', true);

-- Duplicates ---------------------------------------------------------------
select results_eq(
  $$ select id::text from public.find_duplicate_receipts('bbbbbbbb-0000-0000-0000-000000000002') $$,
  $$ values ('bbbbbbbb-0000-0000-0000-000000000001') $$,
  'same merchant (case/space-insensitive), day, item count and price sum is a duplicate'
);
select is(
  (select count(*)::int from public.find_duplicate_receipts('bbbbbbbb-0000-0000-0000-000000000003')),
  0,
  'a different price sum is not a duplicate'
);
select is(
  (select count(*)::int from public.find_duplicate_receipts('bbbbbbbb-0000-0000-0000-000000000004')),
  0,
  'another day is not a duplicate'
);
select is(
  (select count(*)::int from public.find_duplicate_receipts('bbbbbbbb-0000-0000-0000-000000000001')
   where id = 'bbbbbbbb-0000-0000-0000-000000000009'),
  0,
  'receipts of other users never match'
);

-- Coverage -----------------------------------------------------------------
select results_eq(
  $$ select month::text, item_count, counted_count from public.monthly_coverage $$,
  $$ values ('2026-11-01', 2, 1) $$,
  'coverage counts confirmed items and those with a value'
);
select results_eq(
  $$ select raw_text from public.uncovered_items $$,
  $$ values ('Duschgel') $$,
  'uncovered items list the confirmed items without a value'
);

-- Manual entry ---------------------------------------------------------------
create temp table manual_id (id uuid);
grant all on manual_id to authenticated;
insert into manual_id select public.create_manual_receipt('  Bäcker  ', '2026-11-05');

select results_eq(
  $$ select source_type::text, status::text, merchant, file_path is null from public.receipts r join manual_id m on m.id = r.id $$,
  $$ values ('manual', 'review', 'Bäcker', true) $$,
  'a manual receipt starts in review, without a photo, with a trimmed merchant'
);
select lives_ok(
  $$ insert into public.line_items (receipt_id, raw_text, position, reviewed, quantity, unit, quantity_source, co2e_kg)
     select id, 'Brot', 1, true, 0.5, 'kg', 'user', 0.4 from manual_id $$,
  'items can be added to a manual receipt with position and reviewed flag'
);
select throws_ok(
  $$ insert into public.receipts (source_type, status, file_path) values ('manual', 'done', 'x/y.jpg') $$,
  '42501',
  null,
  'clients still cannot insert a status or a manual receipt with a file directly'
);

select lives_ok(
  $$ select public.start_manual_entry('bbbbbbbb-0000-0000-0000-000000000005') $$,
  'a failed receipt can be taken over for manual entry'
);
select results_eq(
  $$ select status::text, error is null from public.receipts where id = 'bbbbbbbb-0000-0000-0000-000000000005' $$,
  $$ values ('review', true) $$,
  'it is in review afterwards and the error is cleared'
);
select throws_ok(
  $$ select public.start_manual_entry('bbbbbbbb-0000-0000-0000-000000000001') $$,
  '23514',
  null,
  'a receipt that is not failed cannot be taken over'
);
select throws_ok(
  $$ select public.start_manual_entry('bbbbbbbb-0000-0000-0000-000000000009') $$,
  '23514',
  null,
  'neither can a receipt of another user'
);

reset role;
set local role anon;
select throws_ok(
  $$ select public.create_manual_receipt('X', null) $$,
  '42501',
  null,
  'anonymous users cannot create receipts'
);
select throws_ok(
  $$ select * from public.find_duplicate_receipts('bbbbbbbb-0000-0000-0000-000000000001') $$,
  '42501',
  null,
  'anonymous users cannot search for duplicates'
);

select * from finish();
rollback;
