-- =============================================================================
-- Helpful failures and notes for receipts.
--   receipts.error_code – machine-readable reason of a failed analysis, so the UI can
--                         explain what to do (blurry photo, not a receipt, too long ...)
--   receipts.notes      – non-fatal observations on a successful analysis (cut off,
--                         foreign currency ...), shown on the review page
-- Both are set by the edge function only and cleared whenever a new attempt starts.
-- =============================================================================

alter table public.receipts
  add column error_code text
    constraint receipts_error_code_check check (error_code in (
      'not_a_receipt', 'unreadable', 'cut_off', 'no_items', 'quota', 'ai_unavailable',
      'no_file', 'unknown'
    )),
  add column notes text[] not null default '{}'
    constraint receipts_notes_check check (
      notes <@ array['cut_off', 'unreadable', 'multiple_receipts', 'foreign_currency', 'non_food_only']
    );

-- Both functions below are the latest versions (progress columns, item positions) plus the new
-- columns. A new attempt starts clean.
create or replace function private.enforce_receipt_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' or new.status = old.status then
    return new;
  end if;

  if (old.status = 'review' and new.status = 'done')
     or (old.status = 'failed' and new.status = 'pending') then
    if new.status = 'pending' then
      new.error := null;
      new.error_code := null;
      new.notes := '{}';
    end if;
    return new;
  end if;

  raise exception 'Receipt status transition % -> % is not allowed', old.status, new.status
    using errcode = 'check_violation';
end;
$$;

create or replace function public.claim_receipt(p_receipt_id uuid, p_user_id uuid)
returns table (id uuid, user_id uuid, file_path text)
language sql
set search_path = ''
as $$
  update public.receipts r
  set status = 'processing', error = null, error_code = null, notes = '{}',
      processing_step = 'reading', ai_provider = null
  where r.id = p_receipt_id
    and r.user_id = p_user_id
    and (
      r.status = 'pending'
      or (r.status = 'processing' and r.updated_at < now() - interval '5 minutes')
    )
  returning r.id, r.user_id, r.file_path;
$$;

drop function public.complete_receipt_processing(uuid, jsonb, text, date);

create function public.complete_receipt_processing(
  p_receipt_id uuid,
  p_items jsonb,
  p_merchant text default null,
  p_purchased_at date default null,
  p_notes text[] default '{}'
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
  set status = 'review', merchant = p_merchant, purchased_at = p_purchased_at,
      error = null, error_code = null, notes = coalesce(p_notes, '{}'), processing_step = null
  where id = p_receipt_id;
end;
$$;

revoke execute on function public.claim_receipt(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.complete_receipt_processing(uuid, jsonb, text, date, text[]) from public, anon, authenticated;
grant execute on function public.claim_receipt(uuid, uuid) to service_role;
grant execute on function public.complete_receipt_processing(uuid, jsonb, text, date, text[]) to service_role;
