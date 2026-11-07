-- =============================================================================
-- Carbon Receipts – initial schema
--   * every table has RLS enabled; policies use `(select auth.uid())` so the
--     value is evaluated once per statement instead of once per row
--   * helper functions live in the non-exposed `private` schema
--   * the client may only move a receipt through the status steps it owns
--     (review → done, failed → pending); everything else is the edge function's
--     job (service_role, bypasses RLS and the transition guard)
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------

create type public.receipt_status as enum ('pending', 'processing', 'review', 'done', 'failed');
create type public.receipt_source as enum ('photo', 'pdf', 'csv');
-- `eur` is for spend-based factors (bank CSV exports without quantities).
create type public.emission_unit as enum ('kg', 'l', 'piece', 'eur');
create type public.goal_period as enum ('month', 'year');

-- -----------------------------------------------------------------------------
-- Shared trigger: updated_at
-- -----------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  daily_ai_quota integer not null default 20 check (daily_ai_quota >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Create a profile for every new auth user.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'user_name')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- -----------------------------------------------------------------------------
-- emission_categories (public reference data)
-- -----------------------------------------------------------------------------

create table public.emission_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  label text not null,
  unit public.emission_unit not null,
  co2e_per_unit numeric(10, 4) not null check (co2e_per_unit >= 0),
  source text not null,
  source_url text,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- receipts
-- -----------------------------------------------------------------------------

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  file_path text,
  source_type public.receipt_source not null,
  status public.receipt_status not null default 'pending',
  merchant text,
  purchased_at date,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- target for the composite FK from line_items (keeps user_id consistent)
  unique (id, user_id),
  constraint receipts_failed_has_error check (status <> 'failed' or error is not null)
);

create index receipts_user_created_idx on public.receipts (user_id, created_at desc);

create trigger receipts_set_updated_at
  before update on public.receipts
  for each row execute function private.set_updated_at();

-- Guard status transitions made by end users. service_role / postgres skip this.
create function private.enforce_receipt_status_transition()
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
    end if;
    return new;
  end if;

  raise exception 'Receipt status transition % -> % is not allowed', old.status, new.status
    using errcode = 'check_violation';
end;
$$;

create trigger receipts_enforce_status_transition
  before update of status on public.receipts
  for each row execute function private.enforce_receipt_status_transition();

-- -----------------------------------------------------------------------------
-- line_items
-- -----------------------------------------------------------------------------

create table public.line_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null,
  user_id uuid not null default auth.uid(),
  raw_text text not null,
  normalized_name text,
  quantity numeric(12, 3) check (quantity > 0),
  unit public.emission_unit,
  price numeric(12, 2),
  category_id uuid references public.emission_categories (id) on delete set null,
  confidence real check (confidence between 0 and 1),
  reviewed boolean not null default false,
  co2e_kg numeric(12, 4) check (co2e_kg >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (receipt_id, user_id) references public.receipts (id, user_id) on delete cascade
);

create index line_items_receipt_idx on public.line_items (receipt_id);
create index line_items_user_idx on public.line_items (user_id);
create index line_items_category_idx on public.line_items (category_id);

create trigger line_items_set_updated_at
  before update on public.line_items
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- category_mappings (user_id null = global mapping, maintained by service_role)
-- -----------------------------------------------------------------------------

create table public.category_mappings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references public.profiles (id) on delete cascade,
  normalized_name text not null check (normalized_name = lower(trim(normalized_name))),
  category_id uuid not null references public.emission_categories (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint category_mappings_user_name_key unique nulls not distinct (user_id, normalized_name)
);

create index category_mappings_name_idx on public.category_mappings (normalized_name);
create index category_mappings_category_idx on public.category_mappings (category_id);

create trigger category_mappings_set_updated_at
  before update on public.category_mappings
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- goals
-- -----------------------------------------------------------------------------

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  period public.goal_period not null,
  target_co2e_kg numeric(10, 2) not null check (target_co2e_kg > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period)
);

create trigger goals_set_updated_at
  before update on public.goals
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- View: monthly_emissions (only confirmed receipts, RLS of the caller applies)
-- -----------------------------------------------------------------------------

create view public.monthly_emissions
with (security_invoker = true)
as
select
  li.user_id,
  date_trunc('month', coalesce(r.purchased_at::timestamptz, r.created_at))::date as month,
  ec.id as category_id,
  coalesce(ec.slug, 'uncategorized') as category_slug,
  coalesce(ec.label, 'Ohne Kategorie') as category_label,
  sum(li.co2e_kg)::numeric(14, 4) as sum_co2e_kg
from public.line_items li
join public.receipts r on r.id = li.receipt_id
left join public.emission_categories ec on ec.id = li.category_id
where r.status = 'done'
  and li.co2e_kg is not null
group by li.user_id, 2, ec.id, ec.slug, ec.label;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.emission_categories enable row level security;
alter table public.receipts enable row level security;
alter table public.line_items enable row level security;
alter table public.category_mappings enable row level security;
alter table public.goals enable row level security;

-- profiles: read/update own row (insert happens via trigger)
create policy "profiles: select own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- emission_categories: public, read-only (anon read is used by the keep-alive ping)
create policy "emission_categories: read all" on public.emission_categories
  for select to anon, authenticated using (true);

-- receipts
create policy "receipts: select own" on public.receipts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "receipts: insert own" on public.receipts
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "receipts: update own" on public.receipts
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "receipts: delete own" on public.receipts
  for delete to authenticated using (user_id = (select auth.uid()));

-- line_items
create policy "line_items: select own" on public.line_items
  for select to authenticated using (user_id = (select auth.uid()));
create policy "line_items: insert own" on public.line_items
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "line_items: update own" on public.line_items
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "line_items: delete own" on public.line_items
  for delete to authenticated using (user_id = (select auth.uid()));

-- category_mappings: read own + global, write own only
create policy "category_mappings: select own or global" on public.category_mappings
  for select to authenticated using (user_id is null or user_id = (select auth.uid()));
create policy "category_mappings: insert own" on public.category_mappings
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "category_mappings: update own" on public.category_mappings
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "category_mappings: delete own" on public.category_mappings
  for delete to authenticated using (user_id = (select auth.uid()));

-- goals
create policy "goals: select own" on public.goals
  for select to authenticated using (user_id = (select auth.uid()));
create policy "goals: insert own" on public.goals
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "goals: update own" on public.goals
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "goals: delete own" on public.goals
  for delete to authenticated using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Privileges (explicit, least privilege). RLS decides *which rows*, grants
-- decide *which operations and columns* – e.g. clients cannot set
-- receipts.status on insert or create global category mappings.
-- -----------------------------------------------------------------------------

revoke all on
  public.profiles, public.emission_categories, public.receipts, public.line_items,
  public.category_mappings, public.goals, public.monthly_emissions
from anon, authenticated, service_role;

grant select, insert, update, delete on
  public.profiles, public.emission_categories, public.receipts, public.line_items,
  public.category_mappings, public.goals
to service_role;
grant select on public.monthly_emissions to service_role;

grant select on public.emission_categories to anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

grant select, delete on public.receipts to authenticated;
grant insert (file_path, source_type, merchant, purchased_at) on public.receipts to authenticated;
grant update (merchant, purchased_at, status) on public.receipts to authenticated;

grant select, delete on public.line_items to authenticated;
grant insert (receipt_id, raw_text, normalized_name, quantity, unit, price, category_id, co2e_kg)
  on public.line_items to authenticated;
grant update (normalized_name, quantity, unit, price, category_id, reviewed, co2e_kg)
  on public.line_items to authenticated;

grant select, delete on public.category_mappings to authenticated;
grant insert (normalized_name, category_id) on public.category_mappings to authenticated;
grant update (category_id) on public.category_mappings to authenticated;

grant select, insert (period, target_co2e_kg), update (target_co2e_kg), delete
  on public.goals to authenticated;

grant select on public.monthly_emissions to authenticated;

-- -----------------------------------------------------------------------------
-- Realtime: the UI follows receipt status changes
-- -----------------------------------------------------------------------------

alter publication supabase_realtime add table public.receipts;

-- -----------------------------------------------------------------------------
-- Storage: private bucket, files live under `<user_id>/...`
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf', 'text/csv']
);

create policy "receipts bucket: select own" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "receipts bucket: insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "receipts bucket: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
