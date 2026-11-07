-- MVP scope: photo receipts only (CSV / PDF import postponed, see docs/decisions.md).
-- The `receipt_source` enum keeps 'csv' and 'pdf' for later.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
where id = 'receipts';

alter table public.receipts
  add constraint receipts_photo_only check (source_type = 'photo');
