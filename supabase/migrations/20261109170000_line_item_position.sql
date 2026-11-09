-- =============================================================================
-- line_items.position: the item's line on the receipt (1 = top).
-- All items of a receipt are written in one insert and share created_at, so ordering
-- by (created_at, id) was effectively random. Review shows items in receipt order,
-- which makes comparing against the photo much easier.
-- =============================================================================

alter table public.line_items
  add column position integer not null default 0,
  add constraint line_items_position_nonnegative check (position >= 0);

-- Best effort for existing rows: their original order is unknown, keep the old tie-break.
update public.line_items li
set position = numbered.n
from (
  select id, row_number() over (partition by receipt_id order by created_at, id)::integer as n
  from public.line_items
) numbered
where numbered.id = li.id;

create index line_items_receipt_position_idx on public.line_items (receipt_id, position);
drop index public.line_items_receipt_idx;

-- No grant for authenticated: users neither insert items nor reorder them; the existing
-- table-level select grant covers reading.

create or replace function public.complete_receipt_processing(
  p_receipt_id uuid,
  p_items jsonb,
  p_merchant text default null,
  p_purchased_at date default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  select r.user_id into v_user_id
  from public.receipts r
  where r.id = p_receipt_id and r.status = 'processing'
  for update;

  if v_user_id is null then
    raise exception 'Receipt % is not being processed', p_receipt_id
      using errcode = 'check_violation';
  end if;

  delete from public.line_items where receipt_id = p_receipt_id;

  insert into public.line_items (
    receipt_id, user_id, position, raw_text, normalized_name, quantity, unit, quantity_source,
    price, category_id, confidence, co2e_kg
  )
  select
    p_receipt_id, v_user_id, i.ord::integer, i.raw_text, i.normalized_name, i.quantity, i.unit,
    i.quantity_source, i.price, i.category_id, i.confidence, i.co2e_kg
  -- `with ordinality` numbers the array elements in their order: the order on the receipt.
  from rows from (
    jsonb_to_recordset(p_items) as (
      raw_text text,
      normalized_name text,
      quantity numeric,
      unit public.emission_unit,
      quantity_source text,
      price numeric,
      category_id uuid,
      confidence real,
      co2e_kg numeric
    )
  ) with ordinality as i (
    raw_text, normalized_name, quantity, unit, quantity_source, price, category_id, confidence,
    co2e_kg, ord
  );

  update public.receipts
  set status = 'review', merchant = p_merchant, purchased_at = p_purchased_at, error = null,
      processing_step = null
  where id = p_receipt_id;
end;
$$;

-- `create or replace` keeps the existing privileges (service_role only).
