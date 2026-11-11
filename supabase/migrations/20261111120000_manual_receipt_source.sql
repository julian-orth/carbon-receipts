-- =============================================================================
-- Receipts can be entered by hand (photo unreadable, or no photo at all). The new enum value
-- can only be used after this migration has committed, so everything that uses it is in the
-- next one.
-- =============================================================================

alter type public.receipt_source add value if not exists 'manual';
