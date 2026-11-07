begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

select ok(
  (select count(*) from public.emission_categories) >= 60,
  'at least 60 emission categories are seeded'
);

select is_empty(
  $$ select slug from public.emission_categories
     where source is null or trim(source) = '' or source_url !~ '^https://' $$,
  'every category has a source and an https source URL'
);

select is_empty(
  $$ select slug from public.emission_categories where co2e_per_unit <= 0 $$,
  'every factor is positive'
);

select is_empty(
  $$ select slug from public.emission_categories where category_group = 'other' $$,
  'every seeded category has a group'
);

select results_eq(
  $$ select co2e_per_unit from public.emission_categories where slug in ('beef', 'pork', 'tofu') order by slug $$,
  $$ values (13.6::numeric), (4.6::numeric), (1.0::numeric) $$,
  'spot check: ifeu 2020 values for beef, pork, tofu'
);

select results_eq(
  $$ select unit::text from public.emission_categories where slug in ('milk', 'eggs', 'petrol') order by slug $$,
  $$ values ('piece'), ('l'), ('l') $$,
  'milk and petrol are per litre, eggs per piece'
);

select * from finish();
rollback;
