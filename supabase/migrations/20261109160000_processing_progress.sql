-- =============================================================================
-- Live processing progress for the UI:
--   receipts.processing_step – which pipeline step the edge function is in
--   receipts.ai_provider     – which LLM provider is reading the receipt (fallback is visible)
-- Both are written by the edge function only (service_role) and reach the client via Realtime.
-- After a failure they keep their last value, so the UI can show where it stopped.
-- =============================================================================

create type public.processing_step as enum ('reading', 'validating', 'matching', 'calculating');

alter table public.receipts
  add column processing_step public.processing_step,
  add column ai_provider text,
  add constraint receipts_ai_provider_length check (char_length(ai_provider) <= 40);

-- No grants for authenticated: the existing column-level grants (select on the table,
-- update of merchant/purchased_at/status) already exclude the new columns from writes.

create or replace function public.claim_receipt(p_receipt_id uuid, p_user_id uuid)
returns table (id uuid, user_id uuid, file_path text)
language sql
set search_path = ''
as $$
  update public.receipts r
  set status = 'processing', error = null, processing_step = 'reading', ai_provider = null
  where r.id = p_receipt_id
    and r.user_id = p_user_id
    and (
      r.status = 'pending'
      or (r.status = 'processing' and r.updated_at < now() - interval '5 minutes')
    )
  returning r.id, r.user_id, r.file_path;
$$;

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
    receipt_id, user_id, raw_text, normalized_name, quantity, unit, quantity_source,
    price, category_id, confidence, co2e_kg
  )
  select
    p_receipt_id, v_user_id, i.raw_text, i.normalized_name, i.quantity, i.unit, i.quantity_source,
    i.price, i.category_id, i.confidence, i.co2e_kg
  from jsonb_to_recordset(p_items) as i (
    raw_text text,
    normalized_name text,
    quantity numeric,
    unit public.emission_unit,
    quantity_source text,
    price numeric,
    category_id uuid,
    confidence real,
    co2e_kg numeric
  );

  update public.receipts
  set status = 'review', merchant = p_merchant, purchased_at = p_purchased_at, error = null,
      processing_step = null
  where id = p_receipt_id;
end;
$$;

-- `create or replace` keeps the existing privileges (service_role only).

-- Per-receipt totals for the receipt list (all statuses, so a receipt in review shows its
-- preliminary total). security_invoker: the caller's RLS on line_items applies.
create view public.receipt_totals
with (security_invoker = true)
as
select
  receipt_id,
  user_id,
  count(*)::integer as item_count,
  coalesce(sum(co2e_kg), 0)::numeric(14, 4) as total_co2e_kg
from public.line_items
group by receipt_id, user_id;

grant select on public.receipt_totals to authenticated, service_role;
