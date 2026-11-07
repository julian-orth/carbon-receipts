begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email) values ('66666666-6666-6666-6666-666666666666', 'demo-test@example.com');
select private.reset_demo_data('66666666-6666-6666-6666-666666666666');

select ok(
  (select count(*) from public.receipts where user_id = '66666666-6666-6666-6666-666666666666' and status = 'done') >= 13,
  'about six months of confirmed receipts'
);
select is(
  (select count(*) from public.receipts where user_id = '66666666-6666-6666-6666-666666666666' and status = 'review')::int,
  1,
  'one receipt waits for review'
);
select is_empty(
  $$ select 1 from public.line_items li join public.emission_categories ec on ec.id = li.category_id
     where li.user_id = '66666666-6666-6666-6666-666666666666' and li.co2e_kg <> round(li.quantity * ec.co2e_per_unit, 4) $$,
  'every CO2e value equals quantity × factor'
);
select is_empty(
  $$ select 1 from public.receipts where user_id = '66666666-6666-6666-6666-666666666666' and purchased_at > current_date $$,
  'no receipts in the future'
);

select private.reset_demo_data('66666666-6666-6666-6666-666666666666');
select is(
  (select count(*) from public.goals where user_id = '66666666-6666-6666-6666-666666666666')::int,
  1,
  'resetting is idempotent'
);

set local role authenticated;
select throws_ok(
  $$ select private.reset_demo_data('66666666-6666-6666-6666-666666666666') $$,
  '42501', null,
  'users cannot reset demo data'
);

select * from finish();
rollback;
