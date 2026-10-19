-- Phase 2: Funktionen für Rezepte und Zutatensuche.
-- Alle Funktionen laufen als SECURITY INVOKER: Es gelten die RLS-Regeln des aufrufenden Nutzers.

-- ---------------------------------------------------------------------------
-- Rezept anlegen oder ändern, inklusive Zutaten und Schritten, in EINER Transaktion.
-- p_recipe: {id?, title, description, servings, prep_minutes, cook_minutes, category, tags[], is_meal_prep, source_url}
-- p_ingredients: [{ingredient_id, amount, unit, grams, note, step_position}] in Anzeigereihenfolge
-- p_steps: [{text, timer_seconds}] in Reihenfolge
-- Die Gramm-Werte normalisiert der Server vorher (src/lib/domain/units.ts).
-- ---------------------------------------------------------------------------
create or replace function public.save_recipe(p_recipe jsonb, p_ingredients jsonb, p_steps jsonb)
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
begin
  if v_id is null then
    insert into public.recipes (
      title, description, servings, prep_minutes, cook_minutes, category, tags, is_meal_prep, source_url
    ) values (
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
    returning id into v_id;
  else
    update public.recipes set
      title = p_recipe ->> 'title',
      description = nullif(p_recipe ->> 'description', ''),
      servings = (p_recipe ->> 'servings')::integer,
      prep_minutes = nullif(p_recipe ->> 'prep_minutes', '')::integer,
      cook_minutes = nullif(p_recipe ->> 'cook_minutes', '')::integer,
      category = nullif(p_recipe ->> 'category', '')::public.recipe_category,
      tags = v_tags,
      is_meal_prep = coalesce((p_recipe ->> 'is_meal_prep')::boolean, false),
      source_url = nullif(p_recipe ->> 'source_url', '')
    where id = v_id and owner_id = (select auth.uid());

    if not found then
      raise exception 'Rezept nicht gefunden oder nicht deins.' using errcode = 'P0002';
    end if;

    delete from public.recipe_ingredients where recipe_id = v_id;
    delete from public.recipe_steps where recipe_id = v_id;
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

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rezept kopieren (eigenes duplizieren oder öffentliches übernehmen).
-- Bei fremden Rezepten wird forked_from_id gesetzt. Die Kopie ist immer privat.
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
    is_meal_prep, is_public, image_url, source_url, forked_from_id
  ) values (
    v_src.recipe_type,
    case when v_src.owner_id = v_uid then left(v_src.title || ' (Kopie)', 200) else v_src.title end,
    v_src.description, v_src.servings, v_src.prep_minutes, v_src.cook_minutes, v_src.category, v_src.tags,
    v_src.is_meal_prep, false, v_src.image_url, v_src.source_url,
    case when v_src.owner_id = v_uid then null else v_src.id end
  )
  returning id into v_new;

  insert into public.recipe_ingredients (recipe_id, ingredient_id, position, amount, unit, grams, note, step_position)
  select v_new, ingredient_id, position, amount, unit, grams, note, step_position
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

-- ---------------------------------------------------------------------------
-- Zutatensuche: exakte Treffer zuerst, dann Wortanfang, dann Ähnlichkeit.
-- ---------------------------------------------------------------------------
create or replace function public.search_ingredients(p_query text, p_limit integer default 12)
returns setof public.ingredients
language sql
stable
security invoker
set search_path = ''
as $$
  select i.*
  from public.ingredients i
  where length(btrim(p_query)) > 0
    and (
      strpos(lower(i.name), lower(btrim(p_query))) > 0
      or extensions.similarity(i.name, btrim(p_query)) > 0.3
    )
  order by
    lower(i.name) = lower(btrim(p_query)) desc,
    lower(i.name) like lower(btrim(p_query)) || '%' desc,
    i.source = 'seed' desc,
    extensions.similarity(i.name, btrim(p_query)) desc,
    length(i.name)
  limit least(greatest(coalesce(p_limit, 12), 1), 50);
$$;

revoke all on function public.save_recipe(jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.duplicate_recipe(uuid) from public, anon;
revoke all on function public.search_ingredients(text, integer) from public, anon;
grant execute on function public.save_recipe(jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.duplicate_recipe(uuid) to authenticated;
grant execute on function public.search_ingredients(text, integer) to authenticated;
