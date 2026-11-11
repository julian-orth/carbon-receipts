-- =============================================================================
-- Two fixes from a security review (decision 036):
--   1. receipts.file_path must point into the owner's own storage folder.
--      The client sets file_path on insert and the edge function downloads it with the
--      service role, so without this check a user could have someone else's photo analysed
--      and read its line items.
--   2. The shared demo account cannot change its password, email or phone. Its credentials
--      are public (frontend env), so any visitor could otherwise lock everyone else out.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. file_path = '<user_id>/<file name>', no further folders, no '.' / '..' segments
-- ---------------------------------------------------------------------------

alter table public.receipts
  add constraint receipts_file_path_owner check (
    file_path is null
    or file_path ~ ('^' || user_id::text || '/[A-Za-z0-9][A-Za-z0-9._-]*$')
  );

-- ---------------------------------------------------------------------------
-- 2. Demo lock: accounts with app_metadata.demo = true keep their credentials.
--    app_metadata is admin-only, so users cannot remove the flag themselves.
--    To change the demo password, clear the flag in the same update (admin API or SQL).
-- ---------------------------------------------------------------------------

create function private.protect_demo_account()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce((old.raw_app_meta_data ->> 'demo')::boolean, false)
     and coalesce((new.raw_app_meta_data ->> 'demo')::boolean, false)
     and (
       new.encrypted_password is distinct from old.encrypted_password
       or new.email is distinct from old.email
       or new.email_change is distinct from old.email_change
       or new.phone is distinct from old.phone
       or new.phone_change is distinct from old.phone_change
     ) then
    raise exception 'The demo account cannot change its credentials'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

revoke all on function private.protect_demo_account() from public, anon, authenticated;

create trigger protect_demo_account
  before update on auth.users
  for each row execute function private.protect_demo_account();
