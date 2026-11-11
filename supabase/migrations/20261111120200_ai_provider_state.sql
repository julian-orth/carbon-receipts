-- =============================================================================
-- Circuit breaker for the free-tier LLM providers. When a provider reports that its
-- (daily) quota is used up – a 429, or the rate-limit headers say 0 requests left –
-- the edge function stores until when. Until then the provider is skipped, so the
-- remaining quota is not hammered and users get an honest "quota used up until …".
-- Only the edge function (service_role) reads or writes it.
-- =============================================================================

create table public.ai_provider_state (
  provider text primary key,
  exhausted_until timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.ai_provider_state enable row level security;

revoke all on public.ai_provider_state from anon, authenticated, service_role;
grant select, insert, update, delete on public.ai_provider_state to service_role;
