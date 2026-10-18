-- Beispielrezepte für den ersten Admin anlegen (einmalig, im Supabase SQL-Editor ausführen).
-- Voraussetzung: Du hast dich per SQL zum Admin gemacht (siehe README, Schritt „Admin werden“).
-- Das Skript ist wiederholbar: Rezepte, die es beim Admin schon gibt (gleicher Titel), werden übersprungen.
-- Mengen in g sind direkt eingetragen; bei Stück/EL/TL steht das umgerechnete Gewicht in "grams".

do $$
declare
  v_owner uuid;
  v_recipe uuid;
begin
  select id into v_owner
  from public.profiles
  where role = 'admin'
  order by created_at
  limit 1;

  if v_owner is null then
    raise exception 'Kein Admin gefunden. Mach dich zuerst per SQL zum Admin (README).';
  end if;

  -- 1) Spaghetti Bolognese -------------------------------------------------
  if not exists (select 1 from public.recipes where owner_id = v_owner and title = 'Spaghetti Bolognese') then
    insert into public.recipes (owner_id, title, description, servings, prep_minutes, cook_minutes, category, tags, is_meal_prep, is_public)
    values (v_owner, 'Spaghetti Bolognese', 'Der Klassiker mit viel Gemüse in der Sauce.', 4, 15, 45, 'pasta', '{Klassiker}', true, true)
    returning id into v_recipe;

    insert into public.recipe_ingredients (recipe_id, ingredient_id, position, amount, unit, grams, note, step_position)
    select v_recipe, i.id, x.pos, x.amount, x.unit::public.unit, x.grams, x.note, x.step
    from (values
      (1, 'rinderhack', 500, 'g', 500, null, 2),
      (2, 'zwiebel', 1, 'piece', 80, 'fein gewürfelt', 1),
      (3, 'karotte', 1, 'piece', 70, 'fein gewürfelt', 1),
      (4, 'knoblauch', 2, 'piece', 8, 'Zehen, gehackt', 1),
      (5, 'olivenoel', 1, 'tbsp', 14, null, 1),
      (6, 'tomatenmark', 2, 'tbsp', 33, null, 2),
      (7, 'tomaten-dose', 800, 'g', 800, null, 3),
      (8, 'spaghetti', 400, 'g', 400, null, 4),
      (9, 'parmesan', 40, 'g', 40, 'frisch gerieben', 5),
      (10, 'salz', 1, 'pinch', 0.5, null, 3),
      (11, 'pfeffer', 1, 'pinch', 0.3, null, 3)
    ) as x(pos, ext, amount, unit, grams, note, step)
    join public.ingredients i on i.source = 'seed' and i.external_id = x.ext;

    insert into public.recipe_steps (recipe_id, position, text, timer_seconds) values
      (v_recipe, 1, 'Öl in einem großen Topf erhitzen. Zwiebel, Karotte und Knoblauch darin 5 Minuten glasig anschwitzen.', 300),
      (v_recipe, 2, 'Hackfleisch zugeben und krümelig braten, bis es Farbe hat. Tomatenmark einrühren und 1 Minute mitrösten.', null),
      (v_recipe, 3, 'Tomaten zugeben, salzen, pfeffern und bei kleiner Hitze ca. 30–40 Minuten köcheln lassen.', 2100),
      (v_recipe, 4, 'In der Zwischenzeit die Spaghetti in Salzwasser nach Packungsangabe al dente kochen (ca. 9 Minuten).', 540),
      (v_recipe, 5, 'Spaghetti abgießen, mit der Sauce mischen und mit Parmesan servieren.', null);
  end if;

  -- 2) Hähnchen-Reis-Bowl mit Brokkoli ------------------------------------
  if not exists (select 1 from public.recipes where owner_id = v_owner and title = 'Hähnchen-Reis-Bowl mit Brokkoli') then
    insert into public.recipes (owner_id, title, description, servings, prep_minutes, cook_minutes, category, tags, is_meal_prep, is_public)
    values (v_owner, 'Hähnchen-Reis-Bowl mit Brokkoli', 'Schnelle Protein-Bowl, ideal zum Vorkochen.', 2, 10, 20, 'bowl', '{Schnell}', true, true)
    returning id into v_recipe;

    insert into public.recipe_ingredients (recipe_id, ingredient_id, position, amount, unit, grams, note, step_position)
    select v_recipe, i.id, x.pos, x.amount, x.unit::public.unit, x.grams, x.note, x.step
    from (values
      (1, 'basmati', 150, 'g', 150, null, 1),
      (2, 'haehnchenbrust', 300, 'g', 300, 'in Würfeln', 2),
      (3, 'rapsoel', 1, 'tbsp', 14, null, 2),
      (4, 'knoblauch', 1, 'piece', 4, 'Zehe, gehackt', 2),
      (5, 'brokkoli', 300, 'g', 300, 'in Röschen', 3),
      (6, 'sojasauce', 2, 'tbsp', 35, null, 3),
      (7, 'fruehlingszwiebel', 2, 'piece', 30, 'in Ringen', 4)
    ) as x(pos, ext, amount, unit, grams, note, step)
    join public.ingredients i on i.source = 'seed' and i.external_id = x.ext;

    insert into public.recipe_steps (recipe_id, position, text, timer_seconds) values
      (v_recipe, 1, 'Reis nach Packungsangabe garen, etwa 12 Minuten.', 720),
      (v_recipe, 2, 'Öl in einer Pfanne erhitzen, Hähnchen mit Knoblauch rundherum 6–8 Minuten braten.', 480),
      (v_recipe, 3, 'Brokkoli zugeben, mit Sojasauce ablöschen und zugedeckt 4 Minuten dünsten.', 240),
      (v_recipe, 4, 'Reis auf Schüsseln verteilen, Hähnchen und Brokkoli darauf geben, mit Frühlingszwiebeln bestreuen.', null);
  end if;

  -- 3) Rote-Linsen-Dal (vegan) --------------------------------------------
  if not exists (select 1 from public.recipes where owner_id = v_owner and title = 'Rote-Linsen-Dal') then
    insert into public.recipes (owner_id, title, description, servings, prep_minutes, cook_minutes, category, tags, is_meal_prep, is_public)
    values (v_owner, 'Rote-Linsen-Dal', 'Cremiges Dal mit Spinat und Zitrone.', 4, 10, 25, 'soup', '{Wohlfühlessen}', true, true)
    returning id into v_recipe;

    insert into public.recipe_ingredients (recipe_id, ingredient_id, position, amount, unit, grams, note, step_position)
    select v_recipe, i.id, x.pos, x.amount, x.unit::public.unit, x.grams, x.note, x.step
    from (values
      (1, 'rapsoel', 1, 'tbsp', 14, null, 1),
      (2, 'zwiebel', 1, 'piece', 80, 'gewürfelt', 1),
      (3, 'knoblauch', 2, 'piece', 8, 'Zehen, gehackt', 1),
      (4, 'rote-linsen', 250, 'g', 250, 'gewaschen', 2),
      (5, 'tomaten-dose', 400, 'g', 400, null, 2),
      (6, 'gemuesebruehe', 750, 'ml', 750, null, 2),
      (7, 'spinat', 150, 'g', 150, null, 3),
      (8, 'zitrone', 0.5, 'piece', 50, 'Saft', 3),
      (9, 'salz', 1, 'pinch', 0.5, null, 3)
    ) as x(pos, ext, amount, unit, grams, note, step)
    join public.ingredients i on i.source = 'seed' and i.external_id = x.ext;

    insert into public.recipe_steps (recipe_id, position, text, timer_seconds) values
      (v_recipe, 1, 'Öl erhitzen, Zwiebel und Knoblauch 3 Minuten anschwitzen.', 180),
      (v_recipe, 2, 'Linsen, Tomaten und Brühe zugeben, aufkochen und ca. 20 Minuten köcheln, bis die Linsen zerfallen.', 1200),
      (v_recipe, 3, 'Spinat unterrühren, bis er zusammenfällt. Mit Zitronensaft und Salz abschmecken.', null);
  end if;

  -- 4) Overnight Oats mit Skyr und Beeren --------------------------------
  if not exists (select 1 from public.recipes where owner_id = v_owner and title = 'Overnight Oats mit Skyr und Beeren') then
    insert into public.recipes (owner_id, title, description, servings, prep_minutes, cook_minutes, category, tags, is_meal_prep, is_public)
    values (v_owner, 'Overnight Oats mit Skyr und Beeren', 'Am Abend vorbereitet, morgens fertig.', 1, 5, 0, 'breakfast', '{Ohne Kochen}', true, true)
    returning id into v_recipe;

    insert into public.recipe_ingredients (recipe_id, ingredient_id, position, amount, unit, grams, note, step_position)
    select v_recipe, i.id, x.pos, x.amount, x.unit::public.unit, x.grams, x.note, x.step
    from (values
      (1, 'haferflocken', 50, 'g', 50, null, 1),
      (2, 'chiasamen', 1, 'tbsp', 10, null, 1),
      (3, 'skyr', 150, 'g', 150, null, 1),
      (4, 'milch', 100, 'ml', 103, null, 1),
      (5, 'honig', 1, 'tsp', 7, null, 1),
      (6, 'beeren-tk', 100, 'g', 100, null, 2)
    ) as x(pos, ext, amount, unit, grams, note, step)
    join public.ingredients i on i.source = 'seed' and i.external_id = x.ext;

    insert into public.recipe_steps (recipe_id, position, text, timer_seconds) values
      (v_recipe, 1, 'Haferflocken, Chiasamen, Skyr, Milch und Honig in einem Glas verrühren.', null),
      (v_recipe, 2, 'Beeren darauf geben, abdecken und über Nacht (mindestens 4 Std.) in den Kühlschrank stellen.', null);
  end if;

  -- 5) Shakshuka mit Feta -------------------------------------------------
  if not exists (select 1 from public.recipes where owner_id = v_owner and title = 'Shakshuka mit Feta') then
    insert into public.recipes (owner_id, title, description, servings, prep_minutes, cook_minutes, category, tags, is_meal_prep, is_public)
    values (v_owner, 'Shakshuka mit Feta', 'Eier in würziger Tomaten-Paprika-Sauce.', 2, 10, 20, 'breakfast', '{Brunch}', false, true)
    returning id into v_recipe;

    insert into public.recipe_ingredients (recipe_id, ingredient_id, position, amount, unit, grams, note, step_position)
    select v_recipe, i.id, x.pos, x.amount, x.unit::public.unit, x.grams, x.note, x.step
    from (values
      (1, 'olivenoel', 1, 'tbsp', 14, null, 1),
      (2, 'zwiebel', 1, 'piece', 80, 'gewürfelt', 1),
      (3, 'paprika-rot', 1, 'piece', 160, 'in Streifen', 1),
      (4, 'knoblauch', 2, 'piece', 8, 'Zehen, gehackt', 1),
      (5, 'paprikapulver', 1, 'tsp', 2.3, null, 2),
      (6, 'tomaten-dose', 400, 'g', 400, null, 2),
      (7, 'salz', 1, 'pinch', 0.5, null, 2),
      (8, 'ei', 4, 'piece', 232, null, 3),
      (9, 'feta', 60, 'g', 60, 'zerbröselt', 4)
    ) as x(pos, ext, amount, unit, grams, note, step)
    join public.ingredients i on i.source = 'seed' and i.external_id = x.ext;

    insert into public.recipe_steps (recipe_id, position, text, timer_seconds) values
      (v_recipe, 1, 'Öl in einer Pfanne erhitzen, Zwiebel, Paprika und Knoblauch 5 Minuten weich braten.', 300),
      (v_recipe, 2, 'Paprikapulver kurz mitrösten, Tomaten zugeben, salzen und 10 Minuten einköcheln lassen.', 600),
      (v_recipe, 3, 'Vier Mulden in die Sauce drücken, Eier hineinschlagen und zugedeckt 6–8 Minuten stocken lassen.', 420),
      (v_recipe, 4, 'Mit Feta bestreuen und direkt aus der Pfanne servieren.', null);
  end if;
end;
$$;

-- Kontrolle: Makros pro Portion und Auto-Tags der Beispielrezepte
select r.title, n.kcal_per_serving, n.protein_per_serving, n.carbs_per_serving, n.fat_per_serving,
       n.is_high_protein, n.is_low_carb, n.is_vegetarian, n.is_vegan
from public.recipes r
join public.recipe_nutrition n on n.recipe_id = r.id
where r.owner_id = (select id from public.profiles where role = 'admin' order by created_at limit 1)
order by r.created_at;
