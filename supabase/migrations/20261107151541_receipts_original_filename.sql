-- Keep the user's file name for display in the receipts list.
alter table public.receipts
  add column original_filename text check (char_length(original_filename) <= 255);

grant insert (original_filename) on public.receipts to authenticated;
