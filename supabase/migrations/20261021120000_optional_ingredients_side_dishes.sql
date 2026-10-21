-- Optionale Zutaten und Beilagen (Wunsch des Nutzers, 21.10.2026).
-- Nur additive Änderungen: Die Live-Version (ohne diese Felder) läuft auf derselben Datenbank weiter.
--   1. recipe_ingredients.is_optional: optionale Zutat (zählt nicht in Nährwerten, Kosten, Alkohol, Einkauf)
--   2. recipes.side_dishes: Beilagen als Vorschläge (gehören nicht zum Rezept, z. B. Spätzle zum Gulasch)
--   3. save_recipe speichert beides (gleiche Signatur; fehlt side_dishes, bleiben die gespeicherten)
--   4. Versionen: is_optional gehört zum Inhalt (nur gesetzt, wenn true: alte Snapshots vergleichen sich gleich)
--   5. Kopieren (duplicate_recipe, fork_shared_recipe) übernimmt beides
--   6. Views recipe_nutrition, recipe_costs, recipe_alcohol ohne optionale Zutaten
--   7. get_shared_recipe liefert is_optional je Zeile und side_dishes

-- ---------------------------------------------------------------------------
-- 1. + 2. Spalten
-- ---------------------------------------------------------------------------
alter table public.recipe_ingredients
  add column is_optional boolean not null default false;

alter table public.recipes
  add column side_dishes text[] not null default '{}'
    constraint recipes_side_dishes_max check (cardinality(side_dishes) <= 20);

-- ---------------------------------------------------------------------------
-- 3. save_recipe: wie in Phase 15, dazu is_optional je Zutat und side_dishes.
--    p_recipe.side_dishes (Array von Texten): fehlt der Schlüssel, bleiben die gespeicherten Beilagen
--    (so speichern die ältere App-Version und die Wiederherstellung einer Version weiter richtig).
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
  v_sides text[] := case
    when jsonb_typeof(p_recipe -> 'side_dishes') = 'array' then coalesce(
      array(
        select btrim(s) from jsonb_array_elements_text(p_recipe -> 'side_dishes') as s
        where btrim(s) <> ''
      ),
      '{}'
    )
  end;
  v_type public.recipe_type := nullif(p_recipe ->> 'recipe_type', '')::public.recipe_type;
  v_cocktail jsonb := case when jsonb_typeof(p_recipe -> 'cocktail') = 'object' then p_recipe -> 'cocktail' end;
  v_current integer;
  v_latest jsonb;
  v_snapshot jsonb;
  v_note text := nullif(btrim(coalesce(p_change_note, '')), '');
begin
  if v_id is null then
    insert into public.recipes (
      recipe_type, title, description, servings, prep_minutes, cook_minutes, category, tags, is_meal_prep, source_url,
      side_dishes
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
      nullif(p_recipe ->> 'source_url', ''),
      coalesce(v_sides, '{}')
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
      source_url = nullif(p_recipe ->> 'source_url', ''),
      side_dishes = coalesce(v_sides, side_dishes)
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

  insert into public.recipe_ingredients (recipe_id, ingredient_id, position, amount, unit, grams, note, step_position, is_optional)
  select
    v_id,
    (e ->> 'ingredient_id')::uuid,
    (t.ord - 1)::integer,
    nullif(e ->> 'amount', '')::numeric,
    nullif(e ->> 'unit', '')::public.unit,
    nullif(e ->> 'grams', '')::numeric,
    nullif(e ->> 'note', ''),
    nullif(e ->> 'step_position', '')::integer,
    coalesce((e ->> 'is_optional')::boolean, false)
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
-- 4. Versionen: 'is_optional' nur, wenn true. So bleiben alte Snapshots (ohne den Schlüssel) inhaltlich gleich
--    und das nächste Speichern erzeugt keine überflüssige Version.
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
        ) || case when ri.is_optional then '{"is_optional": true}'::jsonb else '{}'::jsonb end
        order by ri.position
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

-- ---------------------------------------------------------------------------
-- 5. Kopieren: wie bisher (Foto kopiert die App), dazu is_optional und side_dishes.
-- ---------------------------------------------------------------------------
create or replace function public.duplicate_recipe(p_recipe_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_src public.recipes%rowtype;
  v_new uuid;
  v_uid uuid := (select auth.uid());
begin
  -- RLS: nur eigene oder öffentliche Rezepte sind hier sichtbar
  select * into v_src from public.recipes where id = p_recipe_id;
  if not found then
    raise exception 'Rezept nicht gefunden.' using errcode = 'P0002';
  end if;

  insert into public.recipes (
    recipe_type, title, description, servings, prep_minutes, cook_minutes, category, tags,
    is_meal_prep, is_public, image_url, source_url, forked_from_id, side_dishes
  ) values (
    v_src.recipe_type,
    case when v_src.owner_id = v_uid then left(v_src.title || ' (Kopie)', 200) else v_src.title end,
    v_src.description, v_src.servings, v_src.prep_minutes, v_src.cook_minutes, v_src.category, v_src.tags,
    v_src.is_meal_prep, false, null, v_src.source_url,
    case when v_src.owner_id = v_uid then null else v_src.id end,
    v_src.side_dishes
  )
  returning id into v_new;

  insert into public.recipe_ingredients (recipe_id, ingredient_id, position, amount, unit, grams, note, step_position, is_optional)
  select v_new, ingredient_id, position, amount, unit, grams, note, step_position, is_optional
  from public.recipe_ingredients where recipe_id = p_recipe_id;

  insert into public.recipe_steps (recipe_id, position, text, timer_seconds)
  select v_new, position, text, timer_seconds
  from public.recipe_steps where recipe_id = p_recipe_id;

  insert into public.cocktail_details (recipe_id, glass, method, ice, garnish)
  select v_new, glass, method, ice, garnish
  from public.cocktail_details where recipe_id = p_recipe_id;

  return v_new;
end;
$$;

revoke all on function public.duplicate_recipe(uuid) from public, anon;
grant execute on function public.duplicate_recipe(uuid) to authenticated;

create or replace function public.fork_shared_recipe(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_src public.recipes%rowtype;
  v_new uuid;
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  select * into v_src from public.recipes
  where p_token ~ '^[A-Za-z0-9_-]{22}$' and share_token = p_token;
  if not found then
    raise exception 'Link ungültig oder widerrufen.' using errcode = 'P0002';
  end if;

  insert into public.recipes (
    owner_id, recipe_type, title, description, servings, prep_minutes, cook_minutes, category, tags,
    is_meal_prep, is_public, image_url, source_url, forked_from_id, side_dishes
  ) values (
    v_uid, v_src.recipe_type, v_src.title, v_src.description, v_src.servings, v_src.prep_minutes,
    v_src.cook_minutes, v_src.category, v_src.tags, v_src.is_meal_prep, false, null, v_src.source_url,
    case when v_src.owner_id = v_uid then null else v_src.id end,
    v_src.side_dishes
  )
  returning id into v_new;

  insert into public.recipe_ingredients (recipe_id, ingredient_id, position, amount, unit, grams, note, step_position, is_optional)
  select v_new, ingredient_id, position, amount, unit, grams, note, step_position, is_optional
  from public.recipe_ingredients where recipe_id = v_src.id;

  insert into public.recipe_steps (recipe_id, position, text, timer_seconds)
  select v_new, position, text, timer_seconds
  from public.recipe_steps where recipe_id = v_src.id;

  insert into public.cocktail_details (recipe_id, glass, method, ice, garnish)
  select v_new, glass, method, ice, garnish
  from public.cocktail_details where recipe_id = v_src.id;

  return v_new;
end;
$$;

revoke all on function public.fork_shared_recipe(text) from public, anon;
grant execute on function public.fork_shared_recipe(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Views ohne optionale Zutaten (gleiche Spalten wie bisher; dieselbe Regel in nutrition.ts/cocktail.ts)
-- ---------------------------------------------------------------------------
create or replace view public.recipe_nutrition
with (security_invoker = true)
as
with cfg as (
  select
    coalesce((select (value #>> '{}')::numeric from public.app_config where key = 'high_protein_min_protein_g'), 30) as hp_min_g,
    coalesce((select (value #>> '{}')::numeric from public.app_config where key = 'high_protein_min_kcal_share'), 0.3) as hp_min_share,
    coalesce((select (value #>> '{}')::numeric from public.app_config where key = 'low_carb_max_carbs_g'), 20) as lc_max_g
),
totals as (
  select
    r.id as recipe_id,
    r.servings,
    count(ri.id) as ingredient_count,
    coalesce(sum(coalesce(ri.grams, 0)), 0) as grams_total,
    coalesce(sum(coalesce(ri.grams, 0) * i.kcal / 100), 0) as kcal_total,
    coalesce(sum(coalesce(ri.grams, 0) * i.protein / 100), 0) as protein_total,
    coalesce(sum(coalesce(ri.grams, 0) * i.carbs / 100), 0) as carbs_total,
    coalesce(sum(coalesce(ri.grams, 0) * i.fat / 100), 0) as fat_total,
    coalesce(sum(coalesce(ri.grams, 0) * i.fiber / 100), 0) as fiber_total,
    coalesce(sum(coalesce(ri.grams, 0) * i.sugar / 100), 0) as sugar_total,
    coalesce(bool_and(i.diet = 'vegan'), false) as all_vegan,
    coalesce(bool_and(i.diet in ('vegan', 'vegetarian')), false) as all_vegetarian
  from public.recipes r
  left join public.recipe_ingredients ri on ri.recipe_id = r.id and not ri.is_optional
  left join public.ingredients i on i.id = ri.ingredient_id
  group by r.id, r.servings
),
groups as (
  select
    x.recipe_id,
    jsonb_object_agg(x.food_group, round(x.grams, 1)) as grams_by_food_group
  from (
    select ri.recipe_id, i.food_group, sum(coalesce(ri.grams, 0)) as grams
    from public.recipe_ingredients ri
    join public.ingredients i on i.id = ri.ingredient_id
    where not ri.is_optional
    group by ri.recipe_id, i.food_group
  ) x
  group by x.recipe_id
),
per_serving as (
  select
    t.*,
    t.kcal_total / t.servings as kcal_per_serving,
    t.protein_total / t.servings as protein_per_serving,
    t.carbs_total / t.servings as carbs_per_serving,
    t.fat_total / t.servings as fat_per_serving,
    t.fiber_total / t.servings as fiber_per_serving,
    t.sugar_total / t.servings as sugar_per_serving
  from totals t
)
select
  p.recipe_id,
  p.servings,
  p.ingredient_count::integer as ingredient_count,
  round(p.grams_total, 1) as grams_total,
  round(p.kcal_total, 1) as kcal_total,
  round(p.protein_total, 1) as protein_total,
  round(p.carbs_total, 1) as carbs_total,
  round(p.fat_total, 1) as fat_total,
  round(p.fiber_total, 1) as fiber_total,
  round(p.sugar_total, 1) as sugar_total,
  round(p.kcal_per_serving, 1) as kcal_per_serving,
  round(p.protein_per_serving, 1) as protein_per_serving,
  round(p.carbs_per_serving, 1) as carbs_per_serving,
  round(p.fat_per_serving, 1) as fat_per_serving,
  round(p.fiber_per_serving, 1) as fiber_per_serving,
  round(p.sugar_per_serving, 1) as sugar_per_serving,
  coalesce(g.grams_by_food_group, '{}'::jsonb) as grams_by_food_group,
  (
    p.ingredient_count > 0
    and (
      p.protein_per_serving >= cfg.hp_min_g
      or (p.kcal_per_serving > 0 and (p.protein_per_serving * 4) / p.kcal_per_serving >= cfg.hp_min_share)
    )
  ) as is_high_protein,
  (p.ingredient_count > 0 and p.carbs_per_serving <= cfg.lc_max_g) as is_low_carb,
  (p.ingredient_count > 0 and p.all_vegetarian) as is_vegetarian,
  (p.ingredient_count > 0 and p.all_vegan) as is_vegan
from per_serving p
cross join cfg
left join groups g on g.recipe_id = p.recipe_id;

create or replace view public.recipe_costs
with (security_invoker = true)
as
with prices as (
  select
    p.ingredient_id,
    p.price / nullif(
      case p.package_unit
        when 'g' then p.package_amount
        when 'ml' then p.package_amount * coalesce(i.density_g_per_ml, 1)
        when 'cl' then p.package_amount * 10 * coalesce(i.density_g_per_ml, 1)
        when 'piece' then p.package_amount * i.piece_weight_g
      end,
      0
    ) as price_per_gram
  from public.ingredient_prices p
  join public.ingredients i on i.id = p.ingredient_id
  where p.user_id = (select auth.uid())
)
select
  r.id as recipe_id,
  r.servings,
  count(ri.id)::integer as ingredient_count,
  (count(ri.id) filter (where ri.grams is not null and pr.price_per_gram is not null))::integer as priced_count,
  round(coalesce(sum(ri.grams * pr.price_per_gram), 0), 2) as cost_total,
  round(coalesce(sum(ri.grams * pr.price_per_gram), 0) / r.servings, 2) as cost_per_serving
from public.recipes r
left join public.recipe_ingredients ri on ri.recipe_id = r.id and not ri.is_optional
left join prices pr on pr.ingredient_id = ri.ingredient_id
group by r.id, r.servings;

create or replace view public.recipe_alcohol
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
  where not ri.is_optional
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

-- ---------------------------------------------------------------------------
-- 7. Geteilte Karte: is_optional je Zeile und side_dishes (die ältere App-Version ignoriert beides).
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
    'side_dishes', to_jsonb(r.side_dishes),
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
        'name', i.name,
        'is_optional', ri.is_optional
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
