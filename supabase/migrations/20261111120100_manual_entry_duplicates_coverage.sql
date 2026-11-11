-- =============================================================================
-- Three product features that need the database:
--   1. manual entry   – receipts without a photo, or a failed photo receipt typed in by hand
--   2. duplicates     – "this looks like a receipt you already have"
--   3. coverage       – how many items actually got a CO2e value (honest limits of the data)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Manual entry
-- ---------------------------------------------------------------------------

alter table public.receipts drop constraint receipts_photo_only;
alter table public.receipts
  add constraint receipts_source_check check (
    source_type = 'photo' or (source_type = 'manual' and file_path is null)
  );

-- Clients cannot insert a status (that would let them skip the analysis), so entering a receipt
-- by hand goes through these two functions. Both only ever touch the caller's own rows.
create function public.create_manual_receipt(
  p_merchant text default null,
  p_purchased_at date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  insert into public.receipts (user_id, source_type, status, merchant, purchased_at)
  values (v_user_id, 'manual', 'review', nullif(btrim(p_merchant), ''), p_purchased_at)
  returning id into v_id;
  return v_id;
end;
$$;

-- A failed analysis becomes a receipt in review: the photo stays for comparison, the items are
-- typed in. Only failed receipts qualify, so a receipt in progress cannot be hijacked.
create function public.start_manual_entry(p_receipt_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.receipts
  set status = 'review', error = null, error_code = null, notes = '{}', processing_step = null
  where id = p_receipt_id
    and user_id = auth.uid()
    and status = 'failed';

  if not found then
    raise exception 'Receipt % is not a failed receipt of the caller', p_receipt_id
      using errcode = 'check_violation';
  end if;
end;
$$;

revoke all on function public.create_manual_receipt(text, date) from public, anon;
revoke all on function public.start_manual_entry(uuid) from public, anon;
grant execute on function public.create_manual_receipt(text, date) to authenticated;
grant execute on function public.start_manual_entry(uuid) to authenticated;

-- Items typed in by the user: position and "already reviewed" are theirs to set.
grant insert (position, reviewed) on public.line_items to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Duplicates: same merchant, same day, same number of items and same price sum
-- ---------------------------------------------------------------------------

create function public.find_duplicate_receipts(p_receipt_id uuid)
returns table (
  id uuid,
  merchant text,
  purchased_at date,
  status public.receipt_status,
  item_count integer
)
language sql
stable
set search_path = ''
as $$
  with summary as (
    select
      r.id, r.merchant, r.purchased_at, r.status,
      lower(btrim(r.merchant)) as merchant_key,
      count(li.id)::integer as item_count,
      sum(li.price) as price_sum
    from public.receipts r
    left join public.line_items li on li.receipt_id = r.id
    where r.user_id = auth.uid()
      and r.status in ('review', 'done')
      and r.purchased_at is not null
      and btrim(coalesce(r.merchant, '')) <> ''
    group by r.id
  )
  select o.id, o.merchant, o.purchased_at, o.status, o.item_count
  from summary mine
  join summary o
    on o.id <> mine.id
   and o.merchant_key = mine.merchant_key
   and o.purchased_at = mine.purchased_at
   and o.item_count = mine.item_count
   and o.price_sum is not distinct from mine.price_sum
  where mine.id = p_receipt_id
    and mine.item_count > 0
  order by o.purchased_at desc, o.id;
$$;

revoke all on function public.find_duplicate_receipts(uuid) from public, anon;
grant execute on function public.find_duplicate_receipts(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Coverage: confirmed items with and without a CO2e value, per month
-- ---------------------------------------------------------------------------

create view public.monthly_coverage
with (security_invoker = true)
as
select
  li.user_id,
  date_trunc('month', coalesce(r.purchased_at, r.created_at::date))::date as month,
  count(*)::integer as item_count,
  count(li.co2e_kg)::integer as counted_count
from public.line_items li
join public.receipts r on r.id = li.receipt_id
where r.status = 'done'
group by li.user_id, 2;

-- The items behind the gap, so the dashboard can name examples instead of just a number.
create view public.uncovered_items
with (security_invoker = true)
as
select
  li.id,
  li.user_id,
  li.raw_text,
  date_trunc('month', coalesce(r.purchased_at, r.created_at::date))::date as month,
  coalesce(r.purchased_at, r.created_at::date) as purchased_on
from public.line_items li
join public.receipts r on r.id = li.receipt_id
where r.status = 'done'
  and li.co2e_kg is null;

revoke all on public.monthly_coverage, public.uncovered_items from anon, authenticated, service_role;
grant select on public.monthly_coverage, public.uncovered_items to authenticated, service_role;
