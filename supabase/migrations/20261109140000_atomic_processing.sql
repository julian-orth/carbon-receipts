-- =============================================================================
-- Robust processing:
--   claim_receipt              – atomic claim; a receipt stuck in `processing`
--                                (crashed function) can be claimed again after 5 min
--   complete_receipt_processing – replaces line items and moves the receipt to
--                                `review` in one transaction (no half-written results)
-- Both are for the edge function only (service_role).
-- =============================================================================

create function public.claim_receipt(p_receipt_id uuid, p_user_id uuid)
returns table (id uuid, user_id uuid, file_path text)
language sql
set search_path = ''
as $$
  update public.receipts r
  set status = 'processing', error = null
  where r.id = p_receipt_id
    and r.user_id = p_user_id
    and (
      r.status = 'pending'
      or (r.status = 'processing' and r.updated_at < now() - interval '5 minutes')
    )
  returning r.id, r.user_id, r.file_path;
$$;

create function public.complete_receipt_processing(
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
  set status = 'review', merchant = p_merchant, purchased_at = p_purchased_at, error = null
  where id = p_receipt_id;
end;
$$;

revoke execute on function public.claim_receipt(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.complete_receipt_processing(uuid, jsonb, text, date) from public, anon, authenticated;
grant execute on function public.claim_receipt(uuid, uuid) to service_role;
grant execute on function public.complete_receipt_processing(uuid, jsonb, text, date) to service_role;
