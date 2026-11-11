begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'quota@example.com');
update public.profiles set daily_ai_quota = 2 where id = '33333333-3333-3333-3333-333333333333';

set local role service_role;
select ok(public.consume_ai_quota('33333333-3333-3333-3333-333333333333'), 'first request is allowed');
select ok(public.consume_ai_quota('33333333-3333-3333-3333-333333333333'), 'second request is allowed');
select ok(not public.consume_ai_quota('33333333-3333-3333-3333-333333333333'), 'third request exceeds the quota of 2');
select ok(not public.consume_ai_quota(gen_random_uuid()), 'unknown users get no quota');
select is(
  (select request_count from public.ai_usage where user_id = '33333333-3333-3333-3333-333333333333'),
  2,
  'the counter never exceeds the quota'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select throws_ok(
  $$ select public.consume_ai_quota('33333333-3333-3333-3333-333333333333') $$,
  '42501', null,
  'users cannot consume quota themselves'
);

select is(
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'daily_ai_quota'),
  '5',
  'new profiles get 5 analyses per day'
);

select * from finish();
rollback;
