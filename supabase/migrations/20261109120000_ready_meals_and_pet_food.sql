-- =============================================================================
-- Ready meals (per portion) and pet food (per kg).
--
-- Ready meals: ifeu 2020, Tabelle 6 – dishes "fertig zubereitet auf dem Teller",
--   kg CO2e per portion, including kitchen processes for a 4-person household.
--   Industrial ready meals differ in processing and packaging; these values are
--   the closest published German reference. Unit `piece` = one portion.
-- Pet food: Nos Gestes Climat (ADEME / beta.gouv.fr), cat food average
--   2.5 kg CO2e/kg (dry 1.5, premium/wet 4.5), based on "The global environmental
--   paw print of pet food" (2020). No per-kg value for dog food is published there.
-- =============================================================================

alter table public.emission_categories drop constraint emission_categories_category_group_check;
alter table public.emission_categories add constraint emission_categories_category_group_check
  check (category_group in (
    'fruit_vegetables', 'dairy_eggs', 'meat_fish', 'plant_protein',
    'staples', 'fats_sweets', 'beverages', 'ready_meals', 'pet', 'fuel', 'other'
  ));

insert into public.emission_categories
  (slug, label, category_group, unit, co2e_per_unit, source, source_url)
values
  ('ready-meal-beef',       'Fertiggericht mit Rind (Portion)',     'ready_meals', 'piece', 2.6, 'ifeu 2020, Tab. 6 Gericht 3 – Rindergulasch, pro Portion', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('ready-meal-meat',       'Fertiggericht mit Fleisch (Portion)',  'ready_meals', 'piece', 1.6, 'ifeu 2020, Tab. 6 Gericht 2 – Lasagne, pro Portion', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('ready-meal-fish',       'Fertiggericht mit Fisch (Portion)',    'ready_meals', 'piece', 0.6, 'ifeu 2020, Tab. 6 Gericht 4 – Seelachsfilet mit Blumenkohl und Couscous, pro Portion', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('ready-meal-vegetarian', 'Fertiggericht vegetarisch (Portion)',  'ready_meals', 'piece', 1.0, 'ifeu 2020, Tab. 6 Gericht 5 – Reis-Gemüse-Auflauf, pro Portion', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('ready-meal-vegan',      'Fertiggericht vegan (Portion)',        'ready_meals', 'piece', 0.9, 'ifeu 2020, Tab. 6 Gericht 7 – Sojabolognese mit Reis, pro Portion', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'),
  ('pet-food',              'Tiernahrung',                          'pet',         'kg',    2.5, 'Nos Gestes Climat (ADEME), Katzenfutter Mittelwert 2,5 kg CO2e/kg (Trocken 1,5 / Premium-Nass 4,5), nach „The global environmental paw print of pet food“ (2020)', 'https://nosgestesclimat.fr/en/documentation/divers/animaux-domestiques/empreinte/chats/alimentation/empreinte-nourriture')
on conflict (slug) do update set
  label          = excluded.label,
  category_group = excluded.category_group,
  unit           = excluded.unit,
  co2e_per_unit  = excluded.co2e_per_unit,
  source         = excluded.source,
  source_url     = excluded.source_url;
