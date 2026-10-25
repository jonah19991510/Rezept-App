-- Rezept-Editor (25.10.2026): Timer je Schritt „Aus dem Text“ | „Eigener“ | „Keiner“.
-- Neue Spalte recipe_steps.timer_from_text (Standard true = Zeitangaben im Text sind im Kochmodus antippbar).
--   Aus dem Text: timer_from_text = true,  timer_seconds = null
--   Eigener:      timer_seconds gesetzt (der Kochmodus zeigt dann nur diesen Timer)
--   Keiner:       timer_from_text = false, timer_seconds = null
-- Additiv: Die alte App-Version schickt den Schlüssel nicht mit und speichert weiter (Standard true).

alter table public.recipe_steps
  add column timer_from_text boolean not null default true;

comment on column public.recipe_steps.timer_from_text is
  'Zeitangaben im Schritttext sind im Kochmodus antippbare Timer (false = „Keiner“). Ohne Wirkung, wenn timer_seconds gesetzt ist.';

-- ---------------------------------------------------------------------------
-- 1. Speichern: timer_from_text aus p_steps (fehlt der Schlüssel, gilt true)
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
      recipe_type, title, description, servings, prep_minutes, cook_minutes, category, category_name, tags, is_meal_prep, source_url,
      side_dishes
    ) values (
      coalesce(v_type, 'dish'),
      p_recipe ->> 'title',
      nullif(p_recipe ->> 'description', ''),
      (p_recipe ->> 'servings')::integer,
      nullif(p_recipe ->> 'prep_minutes', '')::integer,
      nullif(p_recipe ->> 'cook_minutes', '')::integer,
      case when p_recipe ? 'category_name' then private.category_key(nullif(btrim(p_recipe ->> 'category_name'), ''))
        else nullif(p_recipe ->> 'category', '')::public.recipe_category end,
      case when p_recipe ? 'category_name' then nullif(btrim(p_recipe ->> 'category_name'), '') end,
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
      category = case when p_recipe ? 'category_name' then private.category_key(nullif(btrim(p_recipe ->> 'category_name'), ''))
        else nullif(p_recipe ->> 'category', '')::public.recipe_category end,
      category_name = case when p_recipe ? 'category_name' then nullif(btrim(p_recipe ->> 'category_name'), '') else category_name end,
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

  insert into public.recipe_steps (recipe_id, position, text, timer_seconds, timer_from_text)
  select
    v_id,
    t.ord::integer,
    e ->> 'text',
    nullif(e ->> 'timer_seconds', '')::integer,
    coalesce((e ->> 'timer_from_text')::boolean, true)
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
-- 2. Versionen: 'timer_from_text' nur, wenn false. So bleiben alte Snapshots inhaltlich gleich
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
      select jsonb_agg(
        jsonb_build_object('text', s.text, 'timer_seconds', s.timer_seconds)
        || case when s.timer_from_text then '{}'::jsonb else '{"timer_from_text": false}'::jsonb end
        order by s.position
      )
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
-- 3. Kopieren (Duplizieren, Übernehmen per Link): timer_from_text mitnehmen
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
    recipe_type, title, description, servings, prep_minutes, cook_minutes, category, category_name, tags,
    is_meal_prep, is_public, image_url, source_url, forked_from_id, side_dishes
  ) values (
    v_src.recipe_type,
    case when v_src.owner_id = v_uid then left(v_src.title || ' (Kopie)', 200) else v_src.title end,
    v_src.description, v_src.servings, v_src.prep_minutes, v_src.cook_minutes, v_src.category, v_src.category_name, v_src.tags,
    v_src.is_meal_prep, false, null, v_src.source_url,
    case when v_src.owner_id = v_uid then null else v_src.id end,
    v_src.side_dishes
  )
  returning id into v_new;

  insert into public.recipe_ingredients (recipe_id, ingredient_id, position, amount, unit, grams, note, step_position, is_optional)
  select v_new, ingredient_id, position, amount, unit, grams, note, step_position, is_optional
  from public.recipe_ingredients where recipe_id = p_recipe_id;

  insert into public.recipe_steps (recipe_id, position, text, timer_seconds, timer_from_text)
  select v_new, position, text, timer_seconds, timer_from_text
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
    owner_id, recipe_type, title, description, servings, prep_minutes, cook_minutes, category, category_name, tags,
    is_meal_prep, is_public, image_url, source_url, forked_from_id, side_dishes
  ) values (
    v_uid, v_src.recipe_type, v_src.title, v_src.description, v_src.servings, v_src.prep_minutes,
    v_src.cook_minutes, v_src.category, v_src.category_name, v_src.tags, v_src.is_meal_prep, false, null, v_src.source_url,
    case when v_src.owner_id = v_uid then null else v_src.id end,
    v_src.side_dishes
  )
  returning id into v_new;

  insert into public.recipe_ingredients (recipe_id, ingredient_id, position, amount, unit, grams, note, step_position, is_optional)
  select v_new, ingredient_id, position, amount, unit, grams, note, step_position, is_optional
  from public.recipe_ingredients where recipe_id = v_src.id;

  insert into public.recipe_steps (recipe_id, position, text, timer_seconds, timer_from_text)
  select v_new, position, text, timer_seconds, timer_from_text
  from public.recipe_steps where recipe_id = v_src.id;

  insert into public.cocktail_details (recipe_id, glass, method, ice, garnish)
  select v_new, glass, method, ice, garnish
  from public.cocktail_details where recipe_id = v_src.id;

  return v_new;
end;
$$;

revoke all on function public.fork_shared_recipe(text) from public, anon;
grant execute on function public.fork_shared_recipe(text) to authenticated;
