-- Eigene Kategorien je Nutzer (Wunsch des Nutzers, 24.10.2026): in den Einstellungen anlegen, umbenennen, löschen.
-- Nur additive Änderungen, weil die Live-Version (feste Liste, Spalte recipes.category als Enum) auf derselben
-- Datenbank weiterläuft:
--   1. Tabelle recipe_categories (Liste je Nutzer, Reihenfolge), RLS, Cascade
--   2. recipes.category_name (Text): der angezeigte Kategoriename. Die alte Enum-Spalte bleibt; ein Trigger hält
--      beide synchron (alte App schreibt category → Name nach Standard-Bezeichnung; neue App schreibt
--      category_name → Enum, wenn der Name einer Standard-Kategorie entspricht, sonst leer)
--   3. Standardliste (11 Küchen-Kategorien, ohne „Getränk“, das nur Cocktails hatten) für alle bisherigen und
--      neuen Nutzer
--   4. save_recipe, duplicate_recipe, fork_shared_recipe, get_shared_recipe kennen category_name
--   5. rename_recipe_category / delete_recipe_category: Umbenennen bzw. Löschen mit Verschieben der eigenen Rezepte

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen: Standard-Bezeichnung ↔ Enum
-- ---------------------------------------------------------------------------
create or replace function private.category_label(p_category public.recipe_category)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_category::text
    when 'pasta' then 'Pasta'
    when 'rice' then 'Reis'
    when 'bowl' then 'Bowl'
    when 'soup' then 'Suppe/Eintopf'
    when 'salad' then 'Salat'
    when 'casserole' then 'Auflauf'
    when 'meat' then 'Fleischgericht'
    when 'fish' then 'Fisch'
    when 'breakfast' then 'Frühstück'
    when 'snack' then 'Snack'
    when 'dessert' then 'Dessert'
    when 'drink' then 'Getränk'
  end;
$$;

create or replace function private.category_key(p_name text)
returns public.recipe_category
language sql
immutable
set search_path = ''
as $$
  select case lower(btrim(p_name))
    when 'pasta' then 'pasta'::public.recipe_category
    when 'reis' then 'rice'::public.recipe_category
    when 'bowl' then 'bowl'::public.recipe_category
    when 'suppe/eintopf' then 'soup'::public.recipe_category
    when 'salat' then 'salad'::public.recipe_category
    when 'auflauf' then 'casserole'::public.recipe_category
    when 'fleischgericht' then 'meat'::public.recipe_category
    when 'fisch' then 'fish'::public.recipe_category
    when 'frühstück' then 'breakfast'::public.recipe_category
    when 'snack' then 'snack'::public.recipe_category
    when 'dessert' then 'dessert'::public.recipe_category
    when 'getränk' then 'drink'::public.recipe_category
  end;
$$;

-- save_recipe (security invoker) und der Trigger rufen sie mit den Rechten des Nutzers auf
revoke all on function private.category_label(public.recipe_category) from public, anon;
revoke all on function private.category_key(text) from public, anon;
grant execute on function private.category_label(public.recipe_category) to authenticated;
grant execute on function private.category_key(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 1. Liste je Nutzer
-- ---------------------------------------------------------------------------
create table public.recipe_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40 and name = btrim(name)),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index recipe_categories_user_name_idx on public.recipe_categories (user_id, lower(name));

alter table public.recipe_categories enable row level security;

create policy "recipe_categories_own" on public.recipe_categories
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.recipe_categories to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Kategoriename am Rezept, synchron mit der alten Enum-Spalte
-- ---------------------------------------------------------------------------
alter table public.recipes
  add column category_name text check (category_name is null or (char_length(category_name) between 1 and 40 and category_name = btrim(category_name)));

create or replace function private.sync_recipe_category()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.recipe_type = 'cocktail' then
    -- Cocktails haben keine Kategorie zum Verwalten (die alte App setzt „Getränk“)
    new.category_name := null;
  elsif tg_op = 'INSERT' then
    if new.category_name is null then
      new.category_name := private.category_label(new.category);
    else
      new.category := private.category_key(new.category_name);
    end if;
  elsif new.category_name is distinct from old.category_name then
    new.category := private.category_key(new.category_name);
  elsif new.category is distinct from old.category then
    new.category_name := private.category_label(new.category);
  end if;
  -- Sammel-Updates (Umbenennen, Löschen mit Verschieben, Rückfüllung) lassen „zuletzt geändert“ stehen
  -- (recipes_set_updated_at läuft alphabetisch vorher und hat updated_at schon gesetzt)
  if tg_op = 'UPDATE' and current_setting('app.category_bulk', true) = 'on' then
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_recipe_category() from public, anon, authenticated;

create trigger recipes_sync_category
  before insert or update of category, category_name, recipe_type on public.recipes
  for each row execute function private.sync_recipe_category();

-- Bestehende Küchen-Rezepte: Name nach Standard-Bezeichnung (updated_at bleibt)
-- (für die Sitzung gesetzt und gleich zurückgesetzt: der SQL Editor führt Anweisungen evtl. einzeln aus)
select set_config('app.category_bulk', 'on', false);
update public.recipes set category_name = private.category_label(category) where recipe_type = 'dish' and category is not null;
select set_config('app.category_bulk', 'off', false);

-- ---------------------------------------------------------------------------
-- 3. Standardliste für bisherige und neue Nutzer
-- ---------------------------------------------------------------------------
create or replace function private.seed_recipe_categories(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.recipe_categories (user_id, name, position)
  select p_user_id, d.name, d.position
  from (values
  ('Pasta', 1),
  ('Reis', 2),
  ('Bowl', 3),
  ('Suppe/Eintopf', 4),
  ('Salat', 5),
  ('Auflauf', 6),
  ('Fleischgericht', 7),
  ('Fisch', 8),
  ('Frühstück', 9),
  ('Snack', 10),
  ('Dessert', 11)
  ) as d (name, position)
  on conflict do nothing;
$$;

revoke all on function private.seed_recipe_categories(uuid) from public, anon, authenticated;

select private.seed_recipe_categories(id) from public.profiles;

-- Kategorien, die in eigenen Rezepten stehen, aber nicht in der Liste (gibt es nach der Umstellung nicht; zur Sicherheit)
insert into public.recipe_categories (user_id, name, position)
select distinct r.owner_id, r.category_name, 100
from public.recipes r
where r.category_name is not null and r.recipe_type = 'dish'
on conflict do nothing;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  name_from_meta text := left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 50);
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(name_from_meta, ''), 'Neues Mitglied'));

  insert into public.user_settings (user_id) values (new.id);
  perform private.seed_recipe_categories(new.id);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Funktionen wie in …20261021120000, dazu category_name
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
    'category_name', r.category_name,
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

-- ---------------------------------------------------------------------------
-- 5. Umbenennen und Löschen: eigene Küchen-Rezepte ziehen mit
-- ---------------------------------------------------------------------------
create or replace function public.rename_recipe_category(p_id uuid, p_name text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_old text;
  v_new text := btrim(coalesce(p_name, ''));
begin
  select name into v_old from public.recipe_categories where id = p_id and user_id = v_uid;
  if not found then
    raise exception 'Kategorie nicht gefunden.' using errcode = 'P0002';
  end if;
  if v_new = v_old then
    return;
  end if;
  update public.recipe_categories set name = v_new where id = p_id and user_id = v_uid;
  perform set_config('app.category_bulk', 'on', true);
  update public.recipes set category_name = v_new
  where owner_id = v_uid and recipe_type = 'dish' and category_name = v_old;
end;
$$;

revoke all on function public.rename_recipe_category(uuid, text) from public, anon;
grant execute on function public.rename_recipe_category(uuid, text) to authenticated;

-- p_move_to: Name einer anderen eigenen Kategorie oder leer (Rezepte ohne Kategorie)
create or replace function public.delete_recipe_category(p_id uuid, p_move_to text default null)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_old text;
  v_target text := nullif(btrim(coalesce(p_move_to, '')), '');
  v_moved integer;
begin
  select name into v_old from public.recipe_categories where id = p_id and user_id = v_uid;
  if not found then
    raise exception 'Kategorie nicht gefunden.' using errcode = 'P0002';
  end if;
  if v_target is not null then
    select name into v_target from public.recipe_categories
    where user_id = v_uid and lower(name) = lower(v_target) and id <> p_id;
    if not found then
      raise exception 'Zielkategorie nicht gefunden.' using errcode = 'P0002';
    end if;
  end if;
  perform set_config('app.category_bulk', 'on', true);
  update public.recipes set category_name = v_target
  where owner_id = v_uid and recipe_type = 'dish' and category_name = v_old;
  get diagnostics v_moved = row_count;
  delete from public.recipe_categories where id = p_id and user_id = v_uid;
  return v_moved;
end;
$$;

revoke all on function public.delete_recipe_category(uuid, text) from public, anon;
grant execute on function public.delete_recipe_category(uuid, text) to authenticated;
