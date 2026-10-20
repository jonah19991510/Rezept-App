-- Phase 15: Cocktail-Bereich (Bar).
-- Nur additive Änderungen: Die Live-Version (ohne Bar) läuft auf derselben Datenbank weiter.
--   1. Verdünnung je Methode zentral in app_config
--   2. View recipe_alcohol: Alkoholgehalt pro Drink (% vol, ml und Gramm Alkohol, Volumen im Glas)
--   3. save_recipe speichert recipe_type und cocktail_details (gleiche Signatur, alte Aufrufe gehen weiter)
--   4. Versionen enthalten die Cocktail-Felder
--   5. get_shared_recipe liefert Cocktail-Felder und Alkoholgehalt für die geteilte Karte
--   6. Bar-Zutaten im Grundbestand

-- ---------------------------------------------------------------------------
-- 1. Verdünnung durch Eis je Methode (Anteil des Volumens, das als Schmelzwasser dazukommt)
-- ---------------------------------------------------------------------------
insert into public.app_config (key, value, description) values
  ('cocktail_dilution', '{"stirred": 0.20, "shaken": 0.25, "built": 0.10, "blended": 0.30}',
   'Cocktails: Verdünnung durch Eis je Methode (0,25 = +25 % Volumen). Ohne Methode: keine Verdünnung.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Alkoholgehalt pro Drink. Dieselbe Formel steht in src/lib/domain/cocktail.ts (mit Unit-Tests).
--    Volumen einer Zeile: ml/cl/EL/TL/Barlöffel/Dash über feste ml-Werte (wie UNIT_ML in units.ts),
--    Gramm nur bei Getränkezutaten (über die Dichte). Stück und Prise (Limettenspalte, Minze) zählen nicht.
--    Alkohol (ml) = Volumen × abv / 100, Gramm = ml × 0,789 (Dichte von Ethanol).
--    % vol = Alkohol / (Volumen × (1 + Verdünnung)).
-- ---------------------------------------------------------------------------
create view public.recipe_alcohol
with (security_invoker = true)
as
with cfg as (
  select coalesce((select value from public.app_config where key = 'cocktail_dilution'), '{}'::jsonb) as dilution
),
lines as (
  select
    ri.recipe_id,
    case
      when ri.amount is null or ri.unit is null then 0
      when ri.unit = 'ml' then ri.amount
      when ri.unit = 'cl' then ri.amount * 10
      when ri.unit = 'tbsp' then ri.amount * 15
      when ri.unit = 'tsp' then ri.amount * 5
      when ri.unit = 'barspoon' then ri.amount * 5
      when ri.unit = 'dash' then ri.amount * 0.6
      when ri.unit = 'g' and (i.abv is not null or i.food_group in ('spirits', 'liqueurs_wine', 'syrups_juices'))
        then ri.amount / coalesce(nullif(i.density_g_per_ml, 0), 1)
      else 0
    end as volume_ml,
    coalesce(i.abv, 0) as abv
  from public.recipe_ingredients ri
  join public.ingredients i on i.id = ri.ingredient_id
),
totals as (
  select
    r.id as recipe_id,
    r.servings,
    cd.method,
    coalesce(sum(l.volume_ml), 0) as volume_ml,
    coalesce(sum(l.volume_ml * l.abv / 100), 0) as alcohol_ml
  from public.recipes r
  left join public.cocktail_details cd on cd.recipe_id = r.id
  left join lines l on l.recipe_id = r.id
  where r.recipe_type = 'cocktail'
  group by r.id, r.servings, cd.method
),
diluted as (
  select
    t.*,
    coalesce((cfg.dilution ->> t.method::text)::numeric, 0) as dilution
  from totals t
  cross join cfg
)
select
  d.recipe_id,
  d.servings,
  d.method,
  d.dilution,
  round(d.volume_ml * (1 + d.dilution) / d.servings, 1) as drink_volume_ml,
  round(d.alcohol_ml / d.servings, 2) as alcohol_ml_per_drink,
  round(d.alcohol_ml * 0.789 / d.servings, 1) as alcohol_g_per_drink,
  case when d.volume_ml > 0 then round(d.alcohol_ml / (d.volume_ml * (1 + d.dilution)) * 100, 1) else 0 end as abv_percent
from diluted d;

revoke all on public.recipe_alcohol from anon;
grant select on public.recipe_alcohol to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Versionen: Cocktail-Felder gehören zum Inhalt (Methode ändert den Alkoholgehalt).
--    Bei Gerichten ist 'cocktail' null, alte Snapshots ohne den Schlüssel vergleichen sich gleich.
-- ---------------------------------------------------------------------------
create or replace function private.recipe_snapshot(p_recipe_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'title', r.title,
    'servings', r.servings,
    'ingredients', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'ingredient_id', ri.ingredient_id,
          'name', i.name,
          'amount', ri.amount,
          'unit', ri.unit,
          'grams', ri.grams,
          'note', ri.note,
          'step_position', ri.step_position
        ) order by ri.position
      )
      from public.recipe_ingredients ri
      join public.ingredients i on i.id = ri.ingredient_id
      where ri.recipe_id = r.id
    ), '[]'::jsonb),
    'steps', coalesce((
      select jsonb_agg(jsonb_build_object('text', s.text, 'timer_seconds', s.timer_seconds) order by s.position)
      from public.recipe_steps s
      where s.recipe_id = r.id
    ), '[]'::jsonb),
    'cocktail', (
      select jsonb_build_object('glass', cd.glass, 'method', cd.method, 'ice', cd.ice, 'garnish', cd.garnish)
      from public.cocktail_details cd
      where cd.recipe_id = r.id and r.recipe_type = 'cocktail'
    )
  )
  from public.recipes r
  where r.id = p_recipe_id;
$$;

create or replace function private.recipe_content(p_snapshot jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'servings', p_snapshot -> 'servings',
    'ingredients', coalesce((
      select jsonb_agg(e - 'name' - 'grams' order by t.ord)
      from jsonb_array_elements(coalesce(p_snapshot -> 'ingredients', '[]'::jsonb)) with ordinality as t(e, ord)
    ), '[]'::jsonb),
    'steps', coalesce(p_snapshot -> 'steps', '[]'::jsonb),
    'cocktail', nullif(p_snapshot -> 'cocktail', 'null'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. save_recipe: gleiche Signatur wie seit Phase 12.
--    p_recipe.recipe_type ('dish' | 'cocktail'): neu Standard 'dish'; beim Bearbeiten ohne Angabe bleibt der Typ
--    (so speichert die ältere App-Version und die Wiederherstellung einer Version weiter richtig).
--    p_recipe.cocktail ({glass, method, ice, garnish}): nur bei Cocktails; fehlt der Schlüssel, bleiben die
--    gespeicherten Cocktail-Felder unverändert. Wird ein Rezept zum Gericht, verschwinden sie.
-- ---------------------------------------------------------------------------
create or replace function public.save_recipe(p_recipe jsonb, p_ingredients jsonb, p_steps jsonb, p_change_note text default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_recipe ->> 'id', '')::uuid;
  v_tags text[] := coalesce(
    array(select jsonb_array_elements_text(coalesce(p_recipe -> 'tags', '[]'::jsonb))),
    '{}'
  );
  v_type public.recipe_type := nullif(p_recipe ->> 'recipe_type', '')::public.recipe_type;
  v_cocktail jsonb := case when jsonb_typeof(p_recipe -> 'cocktail') = 'object' then p_recipe -> 'cocktail' end;
  v_current integer;
  v_latest jsonb;
  v_snapshot jsonb;
  v_note text := nullif(btrim(coalesce(p_change_note, '')), '');
begin
  if v_id is null then
    insert into public.recipes (
      recipe_type, title, description, servings, prep_minutes, cook_minutes, category, tags, is_meal_prep, source_url
    ) values (
      coalesce(v_type, 'dish'),
      p_recipe ->> 'title',
      nullif(p_recipe ->> 'description', ''),
      (p_recipe ->> 'servings')::integer,
      nullif(p_recipe ->> 'prep_minutes', '')::integer,
      nullif(p_recipe ->> 'cook_minutes', '')::integer,
      nullif(p_recipe ->> 'category', '')::public.recipe_category,
      v_tags,
      coalesce((p_recipe ->> 'is_meal_prep')::boolean, false),
      nullif(p_recipe ->> 'source_url', '')
    )
    returning id, recipe_type into v_id, v_type;
  else
    select current_version into v_current from public.recipes where id = v_id and owner_id = (select auth.uid());
    if not found then
      raise exception 'Rezept nicht gefunden oder nicht deins.' using errcode = 'P0002';
    end if;

    -- Ausgangsversion für Rezepte ohne Versionen (angelegt vor Phase 12 oder kopiert)
    if not exists (select 1 from public.recipe_versions where recipe_id = v_id) then
      insert into public.recipe_versions (recipe_id, version, snapshot, change_note)
      values (v_id, v_current, private.recipe_snapshot(v_id), 'Ursprüngliche Fassung');
    end if;

    update public.recipes set
      recipe_type = coalesce(v_type, recipe_type),
      title = p_recipe ->> 'title',
      description = nullif(p_recipe ->> 'description', ''),
      servings = (p_recipe ->> 'servings')::integer,
      prep_minutes = nullif(p_recipe ->> 'prep_minutes', '')::integer,
      cook_minutes = nullif(p_recipe ->> 'cook_minutes', '')::integer,
      category = nullif(p_recipe ->> 'category', '')::public.recipe_category,
      tags = v_tags,
      is_meal_prep = coalesce((p_recipe ->> 'is_meal_prep')::boolean, false),
      source_url = nullif(p_recipe ->> 'source_url', '')
    where id = v_id and owner_id = (select auth.uid())
    returning recipe_type into v_type;

    delete from public.recipe_ingredients where recipe_id = v_id;
    delete from public.recipe_steps where recipe_id = v_id;
  end if;

  if v_type = 'cocktail' then
    if v_cocktail is not null then
      insert into public.cocktail_details (recipe_id, glass, method, ice, garnish)
      values (
        v_id,
        nullif(v_cocktail ->> 'glass', '')::public.glass,
        nullif(v_cocktail ->> 'method', '')::public.cocktail_method,
        nullif(btrim(coalesce(v_cocktail ->> 'ice', '')), ''),
        nullif(btrim(coalesce(v_cocktail ->> 'garnish', '')), '')
      )
      on conflict (recipe_id) do update set
        glass = excluded.glass,
        method = excluded.method,
        ice = excluded.ice,
        garnish = excluded.garnish;
    end if;
  else
    delete from public.cocktail_details where recipe_id = v_id;
  end if;

  insert into public.recipe_ingredients (recipe_id, ingredient_id, position, amount, unit, grams, note, step_position)
  select
    v_id,
    (e ->> 'ingredient_id')::uuid,
    (t.ord - 1)::integer,
    nullif(e ->> 'amount', '')::numeric,
    nullif(e ->> 'unit', '')::public.unit,
    nullif(e ->> 'grams', '')::numeric,
    nullif(e ->> 'note', ''),
    nullif(e ->> 'step_position', '')::integer
  from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb)) with ordinality as t(e, ord);

  insert into public.recipe_steps (recipe_id, position, text, timer_seconds)
  select
    v_id,
    t.ord::integer,
    e ->> 'text',
    nullif(e ->> 'timer_seconds', '')::integer
  from jsonb_array_elements(coalesce(p_steps, '[]'::jsonb)) with ordinality as t(e, ord);

  -- Versionen
  v_snapshot := private.recipe_snapshot(v_id);
  select snapshot into v_latest from public.recipe_versions where recipe_id = v_id order by version desc limit 1;
  if v_latest is null then
    insert into public.recipe_versions (recipe_id, version, snapshot, change_note)
    values (v_id, 1, v_snapshot, v_note);
  elsif private.recipe_content(v_latest) is distinct from private.recipe_content(v_snapshot) then
    select coalesce(max(version), 0) + 1 into v_current from public.recipe_versions where recipe_id = v_id;
    insert into public.recipe_versions (recipe_id, version, snapshot, change_note)
    values (v_id, v_current, v_snapshot, v_note);
    update public.recipes set current_version = v_current where id = v_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.save_recipe(jsonb, jsonb, jsonb, text) from public, anon;
grant execute on function public.save_recipe(jsonb, jsonb, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Geteilte Karte: zusätzlich Cocktail-Felder und Alkoholgehalt (bei Gerichten beides null).
--    Gleiche Felder wie bisher, die ältere App-Version ignoriert die neuen.
-- ---------------------------------------------------------------------------
create or replace function public.get_shared_recipe(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'title', r.title,
    'description', r.description,
    'recipe_type', r.recipe_type,
    'servings', r.servings,
    'prep_minutes', r.prep_minutes,
    'cook_minutes', r.cook_minutes,
    'category', r.category,
    'tags', r.tags,
    'is_meal_prep', r.is_meal_prep,
    'source_url', r.source_url,
    'image_url', r.image_url,
    'updated_at', r.updated_at,
    'author', p.display_name,
    'nutrition', (
      select jsonb_build_object(
        'kcal', n.kcal_per_serving,
        'protein', n.protein_per_serving,
        'carbs', n.carbs_per_serving,
        'fat', n.fat_per_serving,
        'fiber', n.fiber_per_serving
      )
      from public.recipe_nutrition n
      where n.recipe_id = r.id and n.kcal_per_serving is not null
    ),
    'cocktail', (
      select jsonb_build_object('glass', cd.glass, 'method', cd.method, 'ice', cd.ice, 'garnish', cd.garnish)
      from public.cocktail_details cd
      where cd.recipe_id = r.id and r.recipe_type = 'cocktail'
    ),
    'alcohol', (
      select jsonb_build_object(
        'abv_percent', a.abv_percent,
        'alcohol_g', a.alcohol_g_per_drink,
        'volume_ml', a.drink_volume_ml,
        'dilution', a.dilution
      )
      from public.recipe_alcohol a
      where a.recipe_id = r.id
    ),
    'ingredients', coalesce((
      select jsonb_agg(jsonb_build_object(
        'position', ri.position,
        'amount', ri.amount,
        'unit', ri.unit,
        'grams', ri.grams,
        'note', ri.note,
        'name', i.name
      ) order by ri.position)
      from public.recipe_ingredients ri
      join public.ingredients i on i.id = ri.ingredient_id
      where ri.recipe_id = r.id
    ), '[]'::jsonb),
    'steps', coalesce((
      select jsonb_agg(jsonb_build_object('position', s.position, 'text', s.text, 'timer_seconds', s.timer_seconds) order by s.position)
      from public.recipe_steps s
      where s.recipe_id = r.id
    ), '[]'::jsonb)
  )
  from public.recipes r
  left join public.profiles p on p.id = r.owner_id
  where p_token ~ '^[A-Za-z0-9_-]{22}$'
    and r.share_token = p_token;
$$;

revoke all on function public.get_shared_recipe(text) from public;
grant execute on function public.get_shared_recipe(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Bar-Zutaten im Grundbestand. Nährwerte pro 100 g (gerundete Richtwerte, angelehnt an USDA),
--    abv in % vol, Dichte in g/ml. Sodawasser, Tonic & Co. stehen bei Sirup/Säfte, damit sie in der Bar landen.
-- ---------------------------------------------------------------------------
insert into public.ingredients
  (external_id, name, kcal, protein, carbs, fat, fiber, sugar, food_group, diet,
   piece_weight_g, density_g_per_ml, abv, is_staple, source, created_by)
select
  v.external_id, v.name, v.kcal, v.protein, v.carbs, v.fat, v.fiber, v.sugar,
  v.food_group::public.food_group, v.diet::public.ingredient_diet,
  v.piece_weight_g, v.density_g_per_ml, v.abv, false, 'seed', null
from (values
  -- external_id, name, kcal, protein, carbs, fat, fiber, sugar, food_group, diet, piece_weight_g, density, abv
  ('wodka', 'Wodka', 231, 0, 0, 0, 0, 0, 'spirits', null, null, 0.95, 40),
  ('tequila', 'Tequila (Blanco)', 223, 0, 0, 0, 0, 0, 'spirits', null, null, 0.95, 38),
  ('rum-braun', 'Rum, braun', 231, 0, 0, 0, 0, 0, 'spirits', null, null, 0.95, 40),
  ('whisky', 'Whisky (Scotch)', 250, 0, 0, 0, 0, 0, 'spirits', null, null, 0.95, 40),
  ('bourbon', 'Bourbon Whiskey', 250, 0, 0, 0, 0, 0, 'spirits', null, null, 0.95, 40),
  ('cachaca', 'Cachaça', 231, 0, 0, 0, 0, 0, 'spirits', null, null, 0.95, 40),
  ('angostura', 'Angostura Bitter', 290, 0, 4, 0, 0, 4, 'spirits', null, null, 0.95, 44.7),
  ('triple-sec', 'Orangenlikör (Triple Sec)', 330, 0, 28, 0, 0, 28, 'liqueurs_wine', null, null, 1.04, 30),
  ('campari', 'Campari', 250, 0, 24, 0, 0, 24, 'liqueurs_wine', null, null, 1.05, 25),
  ('aperol', 'Aperol', 150, 0, 26, 0, 0, 26, 'liqueurs_wine', null, null, 1.05, 11),
  ('wermut-rot', 'Wermut, rot (süß)', 155, 0, 16, 0, 0, 16, 'liqueurs_wine', null, null, 1.04, 15),
  ('wermut-trocken', 'Wermut, trocken', 110, 0, 3, 0, 0, 3, 'liqueurs_wine', null, null, 1.0, 18),
  ('kaffeelikoer', 'Kaffeelikör', 330, 0, 46, 0, 0, 46, 'liqueurs_wine', null, null, 1.12, 20),
  ('prosecco', 'Prosecco', 75, 0.1, 1.5, 0, 0, 1.5, 'liqueurs_wine', null, null, 0.99, 11),
  ('zitronensaft', 'Zitronensaft', 22, 0.4, 6.9, 0.2, 0.3, 2.5, 'syrups_juices', null, null, 1.03, null),
  ('orangensaft', 'Orangensaft', 45, 0.7, 10.4, 0.2, 0.2, 8.4, 'syrups_juices', null, null, 1.04, null),
  ('cranberrysaft', 'Cranberry-Nektar', 46, 0, 12, 0.1, 0, 12, 'syrups_juices', null, null, 1.04, null),
  ('ananassaft', 'Ananassaft', 53, 0.4, 12.9, 0.1, 0.2, 10, 'syrups_juices', null, null, 1.05, null),
  ('grenadine', 'Grenadine-Sirup', 270, 0, 67, 0, 0, 67, 'syrups_juices', null, null, 1.3, null),
  ('sodawasser', 'Sodawasser', 0, 0, 0, 0, 0, 0, 'syrups_juices', null, null, 1.0, null),
  ('tonic', 'Tonic Water', 34, 0, 8.8, 0, 0, 8.8, 'syrups_juices', null, null, 1.03, null),
  ('ginger-beer', 'Ginger Beer', 40, 0, 10, 0, 0, 10, 'syrups_juices', null, null, 1.03, null),
  ('cola', 'Cola', 42, 0, 10.6, 0, 0, 10.6, 'syrups_juices', null, null, 1.04, null),
  ('minze', 'Minze, frisch', 70, 3.8, 8, 0.9, 8, 0, 'spices_sauces', null, null, null, null),
  ('eiweiss', 'Eiweiß (Hühnerei)', 48, 10.9, 0.7, 0.2, 0, 0.7, 'egg', null, 33, 1.03, null)
) as v(external_id, name, kcal, protein, carbs, fat, fiber, sugar, food_group, diet,
       piece_weight_g, density_g_per_ml, abv)
on conflict (source, external_id) do nothing;
