begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, email) values
  ('44444444-4444-4444-4444-444444444444', 'dash-a@example.com'),
  ('55555555-5555-5555-5555-555555555555', 'dash-b@example.com');

insert into public.receipts (id, user_id, source_type, status, purchased_at) values
  ('dddddddd-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'photo', 'done', '2026-10-15'),
  ('dddddddd-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', 'photo', 'done', '2026-11-02'),
  ('dddddddd-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444', 'photo', 'review', '2026-11-03'),
  ('dddddddd-0000-0000-0000-000000000004', '55555555-5555-5555-5555-555555555555', 'photo', 'done', '2026-11-02');

insert into public.line_items (receipt_id, user_id, raw_text, co2e_kg, category_id) values
  ('dddddddd-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'Rind', 4.6, (select id from public.emission_categories where slug = 'ground-beef')),
  ('dddddddd-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', 'Milch', 1.4, (select id from public.emission_categories where slug = 'milk')),
  ('dddddddd-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', 'Käse', 1.0, (select id from public.emission_categories where slug = 'cheese')),
  ('dddddddd-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', 'Unbekannt', null, null),
  ('dddddddd-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444', 'Noch in Prüfung', 99, null),
  ('dddddddd-0000-0000-0000-000000000004', '55555555-5555-5555-5555-555555555555', 'Fremd', 50, null);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);

select results_eq(
  $$ select month::text, total_co2e_kg, receipt_count from public.monthly_totals order by month $$,
  $$ values ('2026-10-01', 4.6::numeric, 1), ('2026-11-01', 2.4::numeric, 1) $$,
  'monthly totals only count done receipts with a CO2e value'
);

select is((select count(*) from public.line_item_emissions)::int, 3, 'line_item_emissions skips items without CO2e and unconfirmed receipts');
select is((select max(co2e_kg) from public.line_item_emissions), 4.6::numeric, 'other users'' items never appear');

select results_eq(
  $$ select category_group, sum(sum_co2e_kg) from public.monthly_emissions where month = '2026-11-01' group by 1 order by 1 $$,
  $$ values ('dairy_eggs', 2.4::numeric) $$,
  'monthly_emissions exposes the category group'
);

select is(
  (select category_group from public.line_item_emissions where raw_text = 'Rind'),
  'meat_fish',
  'line items carry their category group'
);

select is(
  (select month::text from public.line_item_emissions where raw_text = 'Rind'),
  '2026-10-01',
  'month is derived from the purchase date'
);

reset role;
set local role anon;
select throws_ok($$ select * from public.monthly_totals $$, '42501', null, 'anon cannot read dashboard views');

select * from finish();
rollback;
