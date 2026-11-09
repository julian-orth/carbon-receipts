begin;
create extension if not exists pgtap with schema extensions;

select plan(3);

insert into auth.users (id, email) values
  ('99999999-9999-9999-9999-999999999991', 'totals-a@example.com'),
  ('99999999-9999-9999-9999-999999999992', 'totals-b@example.com');

insert into public.receipts (id, user_id, source_type, status) values
  ('ffffffff-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999991', 'photo', 'review'),
  ('ffffffff-0000-0000-0000-000000000002', '99999999-9999-9999-9999-999999999992', 'photo', 'done');

insert into public.line_items (receipt_id, user_id, raw_text, co2e_kg) values
  ('ffffffff-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999991', 'Käse', 1.71),
  ('ffffffff-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999991', 'Hack', 6.8),
  ('ffffffff-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999991', 'Lachs', null),
  ('ffffffff-0000-0000-0000-000000000002', '99999999-9999-9999-9999-999999999992', 'Fremd', 50);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"99999999-9999-9999-9999-999999999991","role":"authenticated"}', true);

select results_eq(
  $$ select receipt_id::text, item_count, total_co2e_kg from public.receipt_totals $$,
  $$ values ('ffffffff-0000-0000-0000-000000000001', 3, 8.51::numeric) $$,
  'totals count every item and sum the known CO2e values'
);
select is(
  (select count(*)::int from public.receipt_totals where user_id = '99999999-9999-9999-9999-999999999992'),
  0,
  'other users'' totals are not visible'
);

reset role;
set local role anon;
select throws_ok(
  $$ select * from public.receipt_totals $$,
  '42501', null,
  'anonymous users cannot read totals'
);

select * from finish();
rollback;
