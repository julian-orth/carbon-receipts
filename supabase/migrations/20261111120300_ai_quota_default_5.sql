-- The free tiers allow roughly 50–80 analyses per day in total (Gemini 20/day per model,
-- Groq 200K tokens/day), so 20 per user would let one person use up the whole day.
-- New profiles get 5; existing ones still on the old default of 20 are lowered too.
-- Custom values (e.g. the demo user's) stay untouched.
alter table public.profiles alter column daily_ai_quota set default 5;
update public.profiles set daily_ai_quota = 5 where daily_ai_quota = 20;
