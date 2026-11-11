begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email) values
  ('99999999-9999-9999-9999-999999999999', 'codes@example.com');

insert into public.receipts (id, user_id, source_type, status, file_path) values
  ('ffffffff-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999', 'photo', 'processing', '99999999-9999-9999-9999-999999999999/a.jpg'),
  ('ffffffff-0000-0000-0000-000000000002', '99999999-9999-9999-9999-999999999999', 'photo', 'processing', '99999999-9999-9999-9999-999999999999/b.jpg');

-- ---------------------------------------------------------------------------
-- Edge function (service_role): notes with a result, codes with a failure
-- ---------------------------------------------------------------------------
set local role service_role;

select lives_ok(
  $$ select public.complete_receipt_processing(
       'ffffffff-0000-0000-0000-000000000001', '[]'::jsonb, 'Migros', '2026-11-08',
       array['cut_off', 'foreign_currency']
     ) $$,
  'a result is stored together with its notes'
);
select results_eq(
  $$ select notes from public.receipts where id = 'ffffffff-0000-0000-0000-000000000001' $$,
  $$ values (array['cut_off', 'foreign_currency']) $$,
  'the notes are on the receipt'
);
select throws_ok(
  $$ update public.receipts set notes = array['made_up'] where id = 'ffffffff-0000-0000-0000-000000000001' $$,
  '23514',
  null,
  'only known notes are accepted'
);

update public.receipts
set status = 'failed', error = 'Das sieht nicht nach einem Kassenbon aus.', error_code = 'not_a_receipt'
where id = 'ffffffff-0000-0000-0000-000000000002';

select results_eq(
  $$ select error_code from public.receipts where id = 'ffffffff-0000-0000-0000-000000000002' $$,
  $$ values ('not_a_receipt') $$,
  'a failure keeps its machine-readable reason'
);
select throws_ok(
  $$ update public.receipts set error_code = 'made_up' where id = 'ffffffff-0000-0000-0000-000000000002' $$,
  '23514',
  null,
  'only known failure codes are accepted'
);

-- ---------------------------------------------------------------------------
-- A new attempt by the user starts clean
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claim.sub', '99999999-9999-9999-9999-999999999999', true);
set local role authenticated;

update public.receipts set status = 'pending' where id = 'ffffffff-0000-0000-0000-000000000002';

select results_eq(
  $$ select status::text, error, error_code from public.receipts where id = 'ffffffff-0000-0000-0000-000000000002' $$,
  $$ values ('pending', null::text, null::text) $$,
  'retrying clears the error and its code'
);

reset role;
update public.receipts set status = 'failed', error = 'x', error_code = 'unreadable', notes = array['cut_off']
where id = 'ffffffff-0000-0000-0000-000000000002';

set local role service_role;
select is(
  (select count(*)::int from public.claim_receipt('ffffffff-0000-0000-0000-000000000002', '99999999-9999-9999-9999-999999999999')),
  0,
  'a failed receipt is not claimed again by itself'
);

reset role;
update public.receipts set status = 'pending' where id = 'ffffffff-0000-0000-0000-000000000002';
set local role service_role;
select is(
  (select count(*)::int from public.claim_receipt('ffffffff-0000-0000-0000-000000000002', '99999999-9999-9999-9999-999999999999')),
  1,
  'a pending receipt is claimed'
);
select results_eq(
  $$ select error_code, notes from public.receipts where id = 'ffffffff-0000-0000-0000-000000000002' $$,
  $$ values (null::text, array[]::text[]) $$,
  'claiming starts with no code and no notes'
);

-- ---------------------------------------------------------------------------
-- Users cannot write codes or notes themselves
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
select throws_ok(
  $$ update public.receipts set error_code = 'quota' where id = 'ffffffff-0000-0000-0000-000000000002' $$,
  '42501',
  null,
  'error_code is not writable by users'
);

select * from finish();
rollback;
