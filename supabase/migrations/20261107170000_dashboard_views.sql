-- =============================================================================
-- Dashboard views. All use security_invoker, so the caller's RLS applies and a
-- user only ever aggregates their own rows. Only confirmed (`done`) receipts
-- count; the effective date is the purchase date, falling back to the upload.
-- =============================================================================

-- One row per counted line item, enriched with its category.
create view public.line_item_emissions
with (security_invoker = true)
as
select
  li.id,
  li.user_id,
  li.receipt_id,
  li.raw_text,
  li.quantity,
  li.unit,
  li.co2e_kg,
  li.category_id,
  ec.slug as category_slug,
  ec.label as category_label,
  coalesce(ec.category_group, 'other') as category_group,
  coalesce(r.purchased_at, r.created_at::date) as purchased_on,
  date_trunc('month', coalesce(r.purchased_at, r.created_at::date))::date as month
from public.line_items li
join public.receipts r on r.id = li.receipt_id
left join public.emission_categories ec on ec.id = li.category_id
where r.status = 'done'
  and li.co2e_kg is not null;

-- Total per month (trend chart, stat tiles).
create view public.monthly_totals
with (security_invoker = true)
as
select
  user_id,
  month,
  sum(co2e_kg)::numeric(14, 4) as total_co2e_kg,
  count(distinct receipt_id)::integer as receipt_count
from public.line_item_emissions
group by user_id, month;

-- Existing view: add the category group (new columns may only be appended).
create or replace view public.monthly_emissions
with (security_invoker = true)
as
select
  li.user_id,
  date_trunc('month', coalesce(r.purchased_at::timestamptz, r.created_at))::date as month,
  ec.id as category_id,
  coalesce(ec.slug, 'uncategorized') as category_slug,
  coalesce(ec.label, 'Ohne Kategorie') as category_label,
  sum(li.co2e_kg)::numeric(14, 4) as sum_co2e_kg,
  coalesce(ec.category_group, 'other') as category_group
from public.line_items li
join public.receipts r on r.id = li.receipt_id
left join public.emission_categories ec on ec.id = li.category_id
where r.status = 'done'
  and li.co2e_kg is not null
group by li.user_id, 2, ec.id, ec.slug, ec.label, ec.category_group;

revoke all on public.line_item_emissions, public.monthly_totals from anon, authenticated, service_role;
grant select on public.line_item_emissions, public.monthly_totals to authenticated, service_role;
