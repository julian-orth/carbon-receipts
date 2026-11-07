-- =============================================================================
-- Daily AI quota per user. The edge function calls `consume_ai_quota` right
-- before an LLM request; the counter is incremented atomically and only while
-- below `profiles.daily_ai_quota`.
-- =============================================================================

create table public.ai_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  usage_date date not null default current_date,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, usage_date)
);

alter table public.ai_usage enable row level security;

revoke all on public.ai_usage from anon, authenticated, service_role;
grant select on public.ai_usage to authenticated;
grant select, insert, update, delete on public.ai_usage to service_role;

create policy "ai_usage: select own" on public.ai_usage
  for select to authenticated using (user_id = (select auth.uid()));

-- Returns true and counts the request if the user is below the quota.
create function public.consume_ai_quota(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quota integer;
  v_count integer;
begin
  select daily_ai_quota into v_quota from public.profiles where id = p_user_id;
  if v_quota is null or v_quota <= 0 then
    return false;
  end if;

  insert into public.ai_usage as u (user_id, usage_date, request_count)
  values (p_user_id, current_date, 1)
  on conflict (user_id, usage_date) do update
    set request_count = u.request_count + 1
    where u.request_count < v_quota
  returning request_count into v_count;

  return v_count is not null;
end;
$$;

-- Only the edge function (service_role) may consume quota.
revoke execute on function public.consume_ai_quota(uuid) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid) to service_role;
