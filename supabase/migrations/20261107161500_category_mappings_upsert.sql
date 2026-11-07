-- Review corrections are saved as an upsert on (user_id, normalized_name).
-- PostgREST's upsert updates every column in the payload, so `normalized_name`
-- needs an update grant as well (RLS still restricts it to the user's own rows).
grant update (normalized_name) on public.category_mappings to authenticated;
