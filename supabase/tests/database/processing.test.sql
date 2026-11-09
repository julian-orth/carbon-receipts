begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

insert into auth.users (id, email) values
  ('77777777-7777-7777-7777-777777777777', 'proc@example.com'),
  ('88888888-8888-8888-8888-888888888888', 'other@example.com');

insert into public.receipts (id, user_id, source_type, status, file_path) values
  ('eeeeeeee-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777777777', 'photo', 'pending', 'a.jpg'),
  ('eeeeeeee-0000-0000-0000-000000000002', '77777777-7777-7777-7777-777777777777', 'photo', 'processing', 'b.jpg'),
  ('eeeeeeee-0000-0000-0000-000000000003', '77777777-7777-7777-7777-777777777777', 'photo', 'processing', 'c.jpg');

-- receipt 3 has been processing for 10 minutes (crashed run)
alter table public.receipts disable trigger receipts_set_updated_at;
update public.receipts set updated_at = now() - interval '10 minutes'
where id = 'eeeeeeee-0000-0000-0000-000000000003';
alter table public.receipts enable trigger receipts_set_updated_at;

set local role service_role;

select is(
  (select count(*) from public.claim_receipt('eeeeeeee-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777777777'))::int,
  1, 'a pending receipt can be claimed'
);
select is(
  (select count(*) from public.claim_receipt('eeeeeeee-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777777777'))::int,
  0, 'a receipt cannot be claimed twice'
);
select is(
  (select count(*) from public.claim_receipt('eeeeeeee-0000-0000-0000-000000000002', '77777777-7777-7777-7777-777777777777'))::int,
  0, 'a fresh processing receipt is not reclaimed'
);
select is(
  (select count(*) from public.claim_receipt('eeeeeeee-0000-0000-0000-000000000003', '77777777-7777-7777-7777-777777777777'))::int,
  1, 'a receipt stuck in processing for > 5 minutes can be reclaimed'
);
select is(
  (select count(*) from public.claim_receipt('eeeeeeee-0000-0000-0000-000000000001', '88888888-8888-8888-8888-888888888888'))::int,
  0, 'nobody can claim another user''s receipt'
);

select results_eq(
  $$ select processing_step::text, ai_provider from public.receipts where id = 'eeeeeeee-0000-0000-0000-000000000001' $$,
  $$ values ('reading', null::text) $$,
  'claiming starts at the reading step without a provider'
);

update public.receipts set processing_step = 'matching', ai_provider = 'groq'
where id = 'eeeeeeee-0000-0000-0000-000000000001';

select lives_ok(
  $$ select public.complete_receipt_processing(
       'eeeeeeee-0000-0000-0000-000000000001',
       '[{"raw_text":"Milch 1L","normalized_name":"milch","quantity":1,"unit":"l","quantity_source":"receipt","price":1.39,"category_id":null,"confidence":0.9,"co2e_kg":null},
         {"raw_text":"Brot","normalized_name":"brot","quantity":null,"unit":null,"quantity_source":null,"price":2.5,"category_id":null,"confidence":0,"co2e_kg":null}]'::jsonb,
       'REWE', '2026-11-08'
     ) $$,
  'the result is written in one call'
);
select results_eq(
  $$ select status::text, merchant, (select count(*)::int from public.line_items where receipt_id = 'eeeeeeee-0000-0000-0000-000000000001')
     from public.receipts where id = 'eeeeeeee-0000-0000-0000-000000000001' $$,
  $$ values ('review', 'REWE', 2) $$,
  'receipt moved to review with its line items'
);
select results_eq(
  $$ select raw_text, position from public.line_items
     where receipt_id = 'eeeeeeee-0000-0000-0000-000000000001' order by position $$,
  $$ values ('Milch 1L', 1), ('Brot', 2) $$,
  'items keep the order of the receipt'
);
select results_eq(
  $$ select processing_step::text, ai_provider from public.receipts where id = 'eeeeeeee-0000-0000-0000-000000000001' $$,
  $$ values (null::text, 'groq') $$,
  'completion clears the step and keeps the provider that read the receipt'
);
select throws_ok(
  $$ select public.complete_receipt_processing('eeeeeeee-0000-0000-0000-000000000001', '[]'::jsonb) $$,
  '23514', null,
  'a receipt that is not processing cannot be completed again'
);

reset role;
set local role authenticated;
select throws_ok(
  $$ select public.claim_receipt('eeeeeeee-0000-0000-0000-000000000002', '77777777-7777-7777-7777-777777777777') $$,
  '42501', null,
  'users cannot call the processing functions'
);

select throws_ok(
  $$ update public.receipts set processing_step = 'calculating' where id = 'eeeeeeee-0000-0000-0000-000000000002' $$,
  '42501', null,
  'users cannot write the processing step'
);
select throws_ok(
  $$ update public.receipts set ai_provider = 'fake' where id = 'eeeeeeee-0000-0000-0000-000000000002' $$,
  '42501', null,
  'users cannot write the provider'
);
select lives_ok(
  $$ select processing_step, ai_provider from public.receipts $$,
  'users can read the progress columns'
);

select * from finish();
rollback;
