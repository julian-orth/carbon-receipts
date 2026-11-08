-- =============================================================================
-- Learn quantities, not only categories, and record where a quantity came from.
--
--   line_items.quantity_source
--     receipt   – printed on the receipt (weight line, pack size in the name)
--     learned   – from the user's mapping for this product
--     estimated – typical pack size suggested by the model (flagged for review)
--     user      – entered or confirmed in the review screen
--
--   category_mappings.quantity / unit
--     The amount the user confirmed for this product. Used only when the receipt
--     itself shows no amount, so weighed goods keep their printed weight.
-- =============================================================================

alter table public.line_items
  add column quantity_source text
    check (quantity_source in ('receipt', 'learned', 'estimated', 'user'));

-- Existing rows: an amount that is already there came from the receipt or the user.
update public.line_items
set quantity_source = case when reviewed then 'user' else 'receipt' end
where quantity is not null;

alter table public.category_mappings
  add column quantity numeric(12, 3) check (quantity > 0),
  add column unit public.emission_unit,
  add constraint category_mappings_amount_complete check ((quantity is null) = (unit is null));

grant insert (quantity_source) on public.line_items to authenticated;
grant update (quantity_source) on public.line_items to authenticated;
grant insert (quantity, unit) on public.category_mappings to authenticated;
grant update (quantity, unit) on public.category_mappings to authenticated;
