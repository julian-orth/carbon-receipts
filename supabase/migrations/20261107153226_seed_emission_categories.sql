-- =============================================================================
-- Emission categories (reference data, needed in every environment → migration,
-- not seed.sql). Idempotent: re-running updates values by slug.
--
-- Sources
--   ifeu 2020: Reinhardt, Gärtner, Wagner – "Ökologische Fußabdrücke von
--     Lebensmitteln und Gerichten in Deutschland", ifeu Heidelberg 2020.
--     CO2 footprints "an der Supermarktkasse" in Germany, reference year 2019,
--     kg CO2e per kg food, conventional production, average variants.
--     Beverages and milk: the study reports per kg; stored per litre
--     (density ≈ 1 kg/l).
--   BAFU 2026: Bundesamt für Umwelt (CH), Faktenblatt "CO2-Emissionsfaktoren des
--     Treibhausgasinventars der Schweiz", Januar 2026. Fossil CO2 from direct
--     combustion only (no upstream emissions).
-- =============================================================================

alter table public.emission_categories
  add column category_group text not null default 'other'
    check (category_group in (
      'fruit_vegetables', 'dairy_eggs', 'meat_fish', 'plant_protein',
      'staples', 'fats_sweets', 'beverages', 'fuel', 'other'
    ));

comment on column public.emission_categories.category_group is
  'Coarse grouping for the dashboard and for the LLM prompt.';

insert into public.emission_categories
  (slug, label, category_group, unit, co2e_per_unit, source, source_url)
values
  -- Obst & Gemüse – ifeu 2020, Tabelle 1
  ('apples',            'Äpfel',                      'fruit_vegetables', 'kg', 0.3, 'ifeu 2020, Tab. 1 Nr. 5 – Apfel, Durchschnitt', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('bananas',           'Bananen',                    'fruit_vegetables', 'kg', 0.6, 'ifeu 2020, Tab. 1 Nr. 14 – Banane', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('citrus',            'Orangen & Zitrusfrüchte',    'fruit_vegetables', 'kg', 0.3, 'ifeu 2020, Tab. 1 Nr. 50 – Orange / Apfelsine', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('grapes',            'Trauben',                    'fruit_vegetables', 'kg', 0.4, 'ifeu 2020, Tab. 1 Nr. 81 – Trauben, frisch, Durchschnitt', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('berries',           'Beeren',                     'fruit_vegetables', 'kg', 0.3, 'ifeu 2020, Tab. 1 Nr. 28 – Erdbeeren, frisch, Durchschnitt', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('avocados',          'Avocados',                   'fruit_vegetables', 'kg', 0.6, 'ifeu 2020, Tab. 1 Nr. 11 – Avocado, Durchschnitt', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('pineapple',         'Ananas',                     'fruit_vegetables', 'kg', 0.9, 'ifeu 2020, Tab. 1 Nr. 1 – Ananas, frisch, gemäß realem Transport-Durchschnitt', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('tomatoes',          'Tomaten',                    'fruit_vegetables', 'kg', 0.8, 'ifeu 2020, Tab. 1 Nr. 71 – Tomaten, frisch, Durchschnitt', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('cucumbers',         'Gurken',                     'fruit_vegetables', 'kg', 0.4, 'ifeu 2020, Tab. 1 Nr. 63 – Salatgurke, ohne Plastikfolienverpackung', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('peppers',           'Paprika',                    'fruit_vegetables', 'kg', 0.6, 'ifeu 2020, Tab. 1 Nr. 51 – Paprika', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('potatoes',          'Kartoffeln',                 'fruit_vegetables', 'kg', 0.2, 'ifeu 2020, Tab. 1 Nr. 38 – Kartoffeln, frisch', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('carrots',           'Karotten',                   'fruit_vegetables', 'kg', 0.1, 'ifeu 2020, Tab. 1 Nr. 37 – Karotten', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('onions',            'Zwiebeln & Lauch',           'fruit_vegetables', 'kg', 0.2, 'ifeu 2020, Tab. 1 Nr. 86 – Zwiebeln', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('cabbage',           'Kohl',                       'fruit_vegetables', 'kg', 0.1, 'ifeu 2020, Tab. 1 Nr. 84 – Weißkohl', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('broccoli',          'Brokkoli & Blumenkohl',      'fruit_vegetables', 'kg', 0.3, 'ifeu 2020, Tab. 1 Nr. 19 – Brokkoli, frisch', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('salad',             'Salat',                      'fruit_vegetables', 'kg', 0.4, 'ifeu 2020, Tab. 1 Nr. 66 – Salatmischung, gewaschen', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('mushrooms',         'Pilze',                      'fruit_vegetables', 'kg', 1.3, 'ifeu 2020, Tab. 1 Nr. 21 – Champignons, frisch', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('zucchini',          'Zucchini & Kürbis',          'fruit_vegetables', 'kg', 0.2, 'ifeu 2020, Tab. 1 Nr. 85 – Zucchini', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('frozen-vegetables', 'Tiefkühlgemüse',             'fruit_vegetables', 'kg', 0.7, 'ifeu 2020, Tab. 1 Nr. 20 – Brokkoli, gefroren (Referenzprodukt)', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('canned-vegetables', 'Gemüsekonserven',            'fruit_vegetables', 'kg', 1.3, 'ifeu 2020, Tab. 1 Nr. 18 – Bohnen, Dose (Referenzprodukt)', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('tomato-products',   'Passierte Tomaten',          'fruit_vegetables', 'kg', 1.6, 'ifeu 2020, Tab. 1 Nr. 77 – Tomaten, passiert, Verbundkarton', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('legumes',           'Hülsenfrüchte, getrocknet',  'plant_protein',    'kg', 1.2, 'ifeu 2020, Tab. 1 Nr. 46 – Linsen, getrocknet', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),

  -- Milchprodukte & Eier – ifeu 2020, Tabelle 2
  ('butter',            'Butter',                     'dairy_eggs',       'kg', 9.0, 'ifeu 2020, Tab. 2 Nr. 1 – Butter', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('eggs',              'Eier',                       'dairy_eggs',       'piece', 0.18, 'ifeu 2020, Tab. 2 Nr. 3 – Ei (3,0 kg CO2e/kg) × 60 g pro Ei (Annahme)', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('yogurt',            'Joghurt',                    'dairy_eggs',       'kg', 1.7, 'ifeu 2020, Tab. 2 Nr. 4 – Joghurt, natur', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('cheese',            'Käse',                       'dairy_eggs',       'kg', 5.7, 'ifeu 2020, Tab. 2 Nr. 8 – Käse, Durchschnitt', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('cream-cheese',      'Frischkäse',                 'dairy_eggs',       'kg', 5.5, 'ifeu 2020, Tab. 2 Nr. 10 – Käse, Frischkäse', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('quark',             'Quark',                      'dairy_eggs',       'kg', 3.3, 'ifeu 2020, Tab. 2 Nr. 25 – Quark, 40 % Fett', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('cream',             'Sahne',                      'dairy_eggs',       'kg', 4.2, 'ifeu 2020, Tab. 2 Nr. 29 – Sahne', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('milk',              'Milch',                      'dairy_eggs',       'l',  1.4, 'ifeu 2020, Tab. 2 Nr. 16 – Milch, ESL, Vollmilch, Verbundkarton (pro kg, Dichte ≈ 1)', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('oat-drink',         'Haferdrink',                 'plant_protein',    'l',  0.3, 'ifeu 2020, Tab. 2 Nr. 22 – Milch-Ersatz, Haferdrink (pro kg, Dichte ≈ 1)', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('soy-drink',         'Sojadrink',                  'plant_protein',    'l',  0.4, 'ifeu 2020, Tab. 2 Nr. 24 – Milch-Ersatz, Sojadrink (pro kg, Dichte ≈ 1)', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),

  -- Fleisch, Fisch & Alternativen – ifeu 2020, Tabelle 3
  ('beef',              'Rindfleisch',                'meat_fish',        'kg', 13.6, 'ifeu 2020, Tab. 3 Nr. 14 – Rindfleisch, Durchschnitt', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('ground-beef',       'Rinderhackfleisch',          'meat_fish',        'kg', 9.2, 'ifeu 2020, Tab. 3 Nr. 16 – Rinder-Hackfleisch', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('pork',              'Schweinefleisch',            'meat_fish',        'kg', 4.6, 'ifeu 2020, Tab. 3 Nr. 19 – Schweinefleisch, Durchschnitt', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('chicken',           'Geflügel',                   'meat_fish',        'kg', 5.5, 'ifeu 2020, Tab. 3 Nr. 9 – Hähnchen, Durchschnitt', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('sausage',           'Wurst',                      'meat_fish',        'kg', 2.9, 'ifeu 2020, Tab. 3 Nr. 27 – Wurst, Bratwurst, Thüringer Rostbratwurst', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('beef-cold-cuts',    'Rinder-Aufschnitt',          'meat_fish',        'kg', 7.9, 'ifeu 2020, Tab. 3 Nr. 29 – Wurstaufschnitt vom Rind', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('fish-wild',         'Fisch, Wildfang',            'meat_fish',        'kg', 4.0, 'ifeu 2020, Tab. 3 Nr. 7 – Fisch, Wildfang, frisch', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('fish-frozen',       'Fisch, tiefgekühlt',         'meat_fish',        'kg', 2.4, 'ifeu 2020, Tab. 3 Nr. 3 – Fisch, Wildfang, Massenware, gefroren', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('fish-farmed',       'Fisch, Aquakultur',          'meat_fish',        'kg', 5.1, 'ifeu 2020, Tab. 3 Nr. 5 – Fisch, Aquakultur', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('shrimp',            'Garnelen',                   'meat_fish',        'kg', 12.5, 'ifeu 2020, Tab. 3 Nr. 6 – Fisch, Garnelen, gefroren', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('tofu',              'Tofu & Tempeh',              'plant_protein',    'kg', 1.0, 'ifeu 2020, Tab. 3 Nr. 25 – Tofu', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('veggie-patty',      'Veggie-Burger & Bratlinge',  'plant_protein',    'kg', 1.1, 'ifeu 2020, Tab. 3 Nr. 1 – Bratling/Veggieburger/Patty auf Sojabasis', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('veggie-sausage',    'Vegane Wurst',               'plant_protein',    'kg', 1.7, 'ifeu 2020, Tab. 3 Nr. 28 – Wurst-Ersatz, vegane Bratwurst', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),

  -- Grundnahrungsmittel, Fette & Süßes – ifeu 2020, Tabelle 4
  ('bread',             'Brot',                       'staples',          'kg', 0.6, 'ifeu 2020, Tab. 4 Nr. 1 – Brot, Mischbrot', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('bread-rolls',       'Brötchen & Weißbrot',        'staples',          'kg', 0.7, 'ifeu 2020, Tab. 4 Nr. 3 – Brötchen, Weißbrot', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('pastries',          'Kuchen & Feingebäck',        'fats_sweets',      'kg', 1.6, 'ifeu 2020, Tab. 4 Nr. 8 – Feinbackwaren', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('oats',              'Haferflocken & Müsli',       'staples',          'kg', 0.6, 'ifeu 2020, Tab. 4 Nr. 10 – Haferflocken', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('pasta',             'Nudeln',                     'staples',          'kg', 0.7, 'ifeu 2020, Tab. 4 Nr. 16 – Nudeln', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('rice',              'Reis',                       'staples',          'kg', 3.1, 'ifeu 2020, Tab. 4 Nr. 22 – Reis', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('fries',             'Pommes (TK)',                'staples',          'kg', 0.7, 'ifeu 2020, Tab. 4 Nr. 20 – Pommes, tiefgekühlt', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('nuts',              'Nüsse',                      'plant_protein',    'kg', 0.9, 'ifeu 2020, Tab. 4 Nr. 26 – Walnüsse, in Schale', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('chocolate',         'Schokolade',                 'fats_sweets',      'kg', 4.1, 'ifeu 2020, Tab. 4 Nr. 23 – Vollmilchschokolade, Tafel, 35 % Kakaogehalt', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('sugar',             'Zucker',                     'fats_sweets',      'kg', 0.7, 'ifeu 2020, Tab. 4 Nr. 27 – Zucker, Rübenzucker', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('honey',             'Honig',                      'fats_sweets',      'kg', 2.0, 'ifeu 2020, Tab. 4 Nr. 11 – Honig, Glas', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('margarine',         'Margarine',                  'fats_sweets',      'kg', 2.8, 'ifeu 2020, Tab. 4 Nr. 14 – Margarine, vollfett', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('olive-oil',         'Olivenöl',                   'fats_sweets',      'kg', 3.2, 'ifeu 2020, Tab. 4 Nr. 18 – Olivenöl, Glaseinwegflasche', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('vegetable-oil',     'Raps- & Sonnenblumenöl',     'fats_sweets',      'kg', 3.3, 'ifeu 2020, Tab. 4 Nr. 21 – Rapsöl, Glaseinwegflasche', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),

  -- Getränke – ifeu 2020, Tabelle 5 (pro kg, Dichte ≈ 1 → pro Liter)
  ('coffee',            'Kaffee',                     'beverages',        'kg', 5.6, 'ifeu 2020, Tab. 5 Nr. 3 – Kaffee, Pulver', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('cocoa',             'Kakaopulver',                'beverages',        'kg', 5.0, 'ifeu 2020, Tab. 5 Nr. 4 – Kakao, Pulver', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('beer',              'Bier',                       'beverages',        'l',  0.9, 'ifeu 2020, Tab. 5 Nr. 1 – Bier, 0,5 L-Glasmehrwegflasche (pro kg, Dichte ≈ 1)', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('wine',              'Wein',                       'beverages',        'l',  1.0, 'ifeu 2020, Tab. 5 Nr. 11 – Wein, 0,75 L-Glaseinwegflasche (pro kg, Dichte ≈ 1)', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('soft-drinks',       'Limonade & Softdrinks',      'beverages',        'l',  0.4, 'ifeu 2020, Tab. 5 Nr. 5 – Orangenlimonade, 0,75 L-Einwegplastikflasche (pro kg, Dichte ≈ 1)', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('mineral-water',     'Mineralwasser',              'beverages',        'l',  0.2, 'ifeu 2020, Tab. 5 Nr. 6 – Mineralwasser, 0,7 L-Glasmehrwegflasche (pro kg, Dichte ≈ 1)', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('orange-juice',      'Orangensaft',                'beverages',        'l',  0.7, 'ifeu 2020, Tab. 5 Nr. 7 – Saft, Orangensaft, 1,0 L-Verbundkarton (pro kg, Dichte ≈ 1)', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('apple-juice',       'Apfelsaft & andere Säfte',   'beverages',        'l',  0.4, 'ifeu 2020, Tab. 5 Nr. 9 – Saft, Apfelsaft, 1,0 L-Verbundkarton (pro kg, Dichte ≈ 1)', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),

  -- Kraftstoffe – BAFU 2026 (nur direkte Verbrennung)
  ('petrol',            'Benzin',                     'fuel',             'l',  2.32, 'BAFU, Faktenblatt CO2-Emissionsfaktoren des THG-Inventars der Schweiz, Jan. 2026 – Benzin, 2,32 t CO2/m³ (nur Verbrennung)', 'https://www.bafu.admin.ch/dam/de/sd-web/NlGIhzJ8OW0t/CO2_Emissionsfaktoren_THG_Inventar.pdf'),
  ('diesel',            'Diesel',                     'fuel',             'l',  2.62, 'BAFU, Faktenblatt CO2-Emissionsfaktoren des THG-Inventars der Schweiz, Jan. 2026 – Diesel, 2,62 t CO2/m³ (nur Verbrennung)', 'https://www.bafu.admin.ch/dam/de/sd-web/NlGIhzJ8OW0t/CO2_Emissionsfaktoren_THG_Inventar.pdf')
on conflict (slug) do update set
  label          = excluded.label,
  category_group = excluded.category_group,
  unit           = excluded.unit,
  co2e_per_unit  = excluded.co2e_per_unit,
  source         = excluded.source,
  source_url     = excluded.source_url;
