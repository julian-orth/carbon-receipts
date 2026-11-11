begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

select is(
  (select relrowsecurity from pg_class where oid = 'public.ai_provider_state'::regclass),
  true,
  'RLS is enabled'
);

select table_privs_are('public', 'ai_provider_state', 'authenticated', array[]::text[], 'signed-in users have no access');
select table_privs_are('public', 'ai_provider_state', 'anon', array[]::text[], 'anonymous users have no access');

set local role service_role;
insert into public.ai_provider_state (provider, exhausted_until)
values ('gemini:test', now() + interval '1 hour');
select is(
  (select count(*)::int from public.ai_provider_state where exhausted_until > now()),
  1,
  'the edge function can store and read an exhausted provider'
);

reset role;
set local role authenticated;
select throws_ok(
  $$ select * from public.ai_provider_state $$,
  '42501', null,
  'users cannot read the provider state'
);

select * from finish();
rollback;
