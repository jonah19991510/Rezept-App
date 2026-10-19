-- Phase 9: Dichtewerte für die Cup-Umrechnung (amerikanische Rezepte) und fehlende Backzutaten.
-- density_g_per_ml = Gramm pro Milliliter, wie die Zutat üblicherweise abgemessen wird
-- (Mehl locker gelöffelt, Käse gerieben, Nüsse ganz, Blattgemüse locker). 1 cup = 240 ml.
-- Nährwerte pro 100 g, gerundete Richtwerte (angelehnt an BLS/USDA), Kohlenhydrate ohne Ballaststoffe.

-- Dichten für vorhandene Grundbestands-Zutaten
update public.ingredients i
set density_g_per_ml = v.density
from (values
  ('parmesan', 0.40),          -- gerieben
  ('gouda', 0.45),             -- gerieben
  ('feta', 0.60),              -- zerbröselt
  ('mandeln', 0.60),
  ('walnuesse', 0.48),
  ('beeren-tk', 0.60),
  ('spinat', 0.12),            -- frisch, locker
  ('rucola', 0.09),
  ('brokkoli', 0.38),          -- Röschen
  ('kichererbsen-dose', 0.68),
  ('kidneybohnen-dose', 0.75),
  ('penne', 0.42)              -- trocken
) as v(external_id, density)
where i.source = 'seed' and i.external_id = v.external_id and i.density_g_per_ml is null;

-- Fehlende Backzutaten und Milchprodukte (für Import und Umrechner)
insert into public.ingredients
  (external_id, name, kcal, protein, carbs, fat, fiber, sugar, food_group, diet,
   piece_weight_g, density_g_per_ml, abv, is_staple, source, created_by)
select
  v.external_id, v.name, v.kcal, v.protein, v.carbs, v.fat, v.fiber, v.sugar,
  v.food_group::public.food_group, v.diet::public.ingredient_diet,
  v.piece_weight_g, v.density_g_per_ml, null, v.is_staple, 'seed', null
from (values
  -- external_id, name, kcal, protein, carbs, fat, fiber, sugar, food_group, diet, piece_weight_g, density, staple
  ('puderzucker', 'Puderzucker', 398, 0, 99.8, 0, 0, 99.8, 'other', 'vegan', null, 0.56, false),
  ('brauner-zucker', 'Brauner Zucker', 380, 0.1, 98.0, 0, 0, 97.0, 'other', 'vegan', null, 0.85, false),
  ('vanillezucker', 'Vanillezucker', 395, 0, 98.0, 0, 0, 98.0, 'other', 'vegan', 8, 0.85, false),
  ('kakao', 'Kakaopulver, stark entölt', 355, 20.0, 11.0, 11.0, 30.0, 1.0, 'other', 'vegan', null, 0.45, false),
  ('speisestaerke', 'Speisestärke', 351, 0.3, 87.0, 0.1, 0.9, 0, 'grains', 'vegan', null, 0.55, false),
  ('backpulver', 'Backpulver', 92, 0, 23.0, 0, 0, 0, 'other', 'vegan', 15, 0.90, true),
  ('dinkelmehl-630', 'Dinkelmehl Type 630', 344, 12.0, 67.0, 1.8, 4.5, 0.6, 'grains', 'vegan', null, 0.53, false),
  ('vollkornmehl', 'Weizenvollkornmehl', 330, 12.0, 60.0, 2.4, 10.0, 0.5, 'grains', 'vegan', null, 0.51, false),
  ('joghurt', 'Naturjoghurt 3,5 %', 66, 3.8, 4.7, 3.5, 0, 4.7, 'dairy', null, null, 1.03, false),
  ('frischkaese', 'Frischkäse, Doppelrahmstufe', 260, 5.5, 3.3, 24.5, 0, 3.3, 'dairy', null, null, 0.98, false),
  ('saure-sahne', 'Saure Sahne 10 %', 115, 3.0, 3.9, 10.0, 0, 3.9, 'dairy', null, null, 1.00, false),
  ('kokosmilch', 'Kokosmilch', 180, 1.8, 3.0, 18.0, 0, 2.5, 'other', 'vegan', null, 0.98, false),
  ('rosinen', 'Rosinen', 299, 3.1, 66.0, 0.5, 3.7, 59.0, 'fruit', 'vegan', null, 0.65, false)
) as v(external_id, name, kcal, protein, carbs, fat, fiber, sugar, food_group, diet, piece_weight_g, density_g_per_ml, is_staple)
on conflict (source, external_id) do nothing;
