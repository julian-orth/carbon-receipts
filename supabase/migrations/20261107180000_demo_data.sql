-- =============================================================================
-- Demo data: six months of confirmed receipts plus one receipt waiting for
-- review. Dates are relative to today, so the demo always looks current.
-- CO2e uses the same formula as the app: quantity × factor, rounded to 4 places.
--
--   select private.reset_demo_data('<demo user id>');
--
-- Only callable by postgres / service_role (e.g. SQL editor, pg_cron).
-- =============================================================================

create function private.reset_demo_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- [raw_text, category slug, quantity, unit, price]; older baskets are meatier,
  -- so the trend shows progress.
  v_baskets jsonb := '[
    [["Rinderhack 500g", "ground-beef", 0.5, "kg", 4.99], ["Rumpsteak", "beef", 0.4, "kg", 11.49], ["Gouda jung 400g", "cheese", 0.4, "kg", 3.29], ["H-Milch 3,5% 1L", "milk", 2, "l", 2.18], ["Kartoffeln 2kg", "potatoes", 2, "kg", 2.49], ["Bananen", "bananas", 1.1, "kg", 1.53]],
    [["Hähnchenbrust", "chicken", 0.6, "kg", 6.99], ["Bratwurst Thüringer", "sausage", 0.4, "kg", 3.79], ["Butter 250g", "butter", 0.25, "kg", 2.39], ["Basmati Reis 1kg", "rice", 1, "kg", 2.99], ["Tomaten", "tomatoes", 0.8, "kg", 2.39], ["Mineralwasser 6x1,5l", "mineral-water", 9, "l", 3.54]],
    [["Rinderhack 500g", "ground-beef", 0.5, "kg", 4.99], ["Lachs Filet TK", "fish-farmed", 0.25, "kg", 4.49], ["Sahne 200g", "cream", 0.2, "kg", 0.89], ["Spaghetti 500g", "pasta", 0.5, "kg", 1.29], ["Äpfel Elstar", "apples", 1.5, "kg", 2.99], ["Bier 20x0,5l", "beer", 10, "l", 16.99]],
    [["Haferdrink 1L", "oat-drink", 2, "l", 3.58], ["Tofu natur 400g", "tofu", 0.4, "kg", 2.29], ["Hähnchenbrust", "chicken", 0.4, "kg", 4.99], ["Vollkornbrot 750g", "bread", 0.75, "kg", 2.49], ["Paprika rot", "peppers", 0.5, "kg", 1.99], ["Joghurt natur 500g", "yogurt", 0.5, "kg", 0.99]],
    [["Veggie Burger 2 Stk", "veggie-patty", 0.23, "kg", 3.49], ["Haferdrink 1L", "oat-drink", 1, "l", 1.79], ["Linsen rot 500g", "legumes", 0.5, "kg", 1.89], ["Karotten 1kg", "carrots", 1, "kg", 1.19], ["Haferflocken 500g", "oats", 0.5, "kg", 0.89], ["Gouda jung 400g", "cheese", 0.4, "kg", 3.29]],
    [["Tofu natur 400g", "tofu", 0.4, "kg", 2.29], ["Spaghetti 500g", "pasta", 0.5, "kg", 1.29], ["Passierte Tomaten 500g", "tomato-products", 0.5, "kg", 0.79], ["Brokkoli", "broccoli", 0.5, "kg", 1.49], ["Haferdrink 1L", "oat-drink", 2, "l", 3.58], ["Kaffee gemahlen 500g", "coffee", 0.5, "kg", 5.99]]
  ]';
  v_merchants text[] := array['REWE', 'EDEKA', 'ALDI SÜD'];
  v_month int;
  v_slot int;
  v_date date;
  v_receipt uuid;
  v_basket jsonb;
begin
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'No profile for user %', p_user_id;
  end if;

  delete from public.receipts where user_id = p_user_id;
  delete from public.goals where user_id = p_user_id;
  delete from public.category_mappings where user_id = p_user_id;
  delete from public.ai_usage where user_id = p_user_id;

  insert into public.goals (user_id, period, target_co2e_kg) values (p_user_id, 'month', 45);

  for v_month in 0..5 loop
    for v_slot in 0..2 loop
      v_date := (date_trunc('month', current_date) - make_interval(months => v_month))::date + (v_slot * 9 + 1);
      continue when v_date > current_date;

      -- month 5 (oldest) → basket 0 (meaty); month 0 (current) → basket 5 (plant-based)
      v_basket := v_baskets -> ((5 - v_month + v_slot) % jsonb_array_length(v_baskets));

      insert into public.receipts (user_id, source_type, status, merchant, purchased_at, original_filename, created_at)
      values (p_user_id, 'photo', 'done', v_merchants[v_slot + 1], v_date, 'beispielbon.jpg', v_date)
      returning id into v_receipt;

      insert into public.line_items
        (receipt_id, user_id, raw_text, normalized_name, quantity, unit, price, category_id, confidence, reviewed, co2e_kg)
      select
        v_receipt,
        p_user_id,
        item ->> 0,
        lower(trim(regexp_replace(item ->> 0, '[^[:alpha:] ]|\d', ' ', 'g'))),
        (item ->> 2)::numeric,
        (item ->> 3)::public.emission_unit,
        (item ->> 4)::numeric,
        ec.id,
        0.95,
        true,
        round((item ->> 2)::numeric * ec.co2e_per_unit, 4)
      from jsonb_array_elements(v_basket) as item
      join public.emission_categories ec on ec.slug = item ->> 1;
    end loop;
  end loop;

  -- One fresh receipt waiting for review: an uncertain category and a missing quantity.
  insert into public.receipts (user_id, source_type, status, merchant, purchased_at, original_filename)
  values (p_user_id, 'photo', 'review', 'Wochenmarkt', current_date, 'markt.jpg')
  returning id into v_receipt;

  insert into public.line_items
    (receipt_id, user_id, raw_text, normalized_name, quantity, unit, price, category_id, confidence, reviewed, co2e_kg)
  values
    (v_receipt, p_user_id, 'Bergkäse am Stück', 'bergkäse am stück', 0.3, 'kg', 6.90,
      (select id from public.emission_categories where slug = 'cheese'), 0.92, false, round(0.3 * 5.7, 4)),
    (v_receipt, p_user_id, 'Barista Hafer 1L', 'barista hafer', 1, 'l', 2.49,
      (select id from public.emission_categories where slug = 'milk'), 0.45, false, 1.4),
    (v_receipt, p_user_id, 'Wildlachs geräuchert', 'wildlachs geräuchert', null, null, 4.99,
      (select id from public.emission_categories where slug = 'fish-wild'), 0.8, false, null);
end;
$$;

revoke execute on function private.reset_demo_data(uuid) from public, anon, authenticated;
