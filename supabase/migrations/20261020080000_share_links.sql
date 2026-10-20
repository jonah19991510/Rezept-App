-- Phase 14: Teilen per Link.
-- Ein Rezept bekommt auf Wunsch einen zufälligen share_token. Ohne Login lesbar ist es dann NUR über
-- public.get_shared_recipe(token) (Security Definer, genau ein Rezept, ohne IDs und ohne E-Mail).
-- An der RLS von recipes ändert sich nichts: weiterhin kein anonymer Zugriff auf Tabellen.

-- Token: 22 Zeichen base64url (128 Bit aus gen_random_uuid, davon 122 zufällig)
alter table public.recipes
  add constraint recipes_share_token_format check (share_token is null or share_token ~ '^[A-Za-z0-9_-]{22}$');

-- ---------------------------------------------------------------------------
-- Link erzeugen (vorhandenen behalten) oder widerrufen. Nur der Owner (RLS + owner_id).
-- Gibt den Token zurück bzw. null nach dem Widerrufen.
-- ---------------------------------------------------------------------------
create or replace function public.set_recipe_share(p_recipe_id uuid, p_enabled boolean)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_token text;
begin
  update public.recipes
  set share_token = case
    when p_enabled then coalesce(
      share_token,
      translate(rtrim(encode(uuid_send(gen_random_uuid()), 'base64'), '='), '+/', '-_')
    )
    else null
  end
  where id = p_recipe_id and owner_id = (select auth.uid())
  returning share_token into v_token;

  if not found then
    raise exception 'Rezept nicht gefunden oder nicht deins.' using errcode = 'P0002';
  end if;
  return v_token;
end;
$$;

revoke all on function public.set_recipe_share(uuid, boolean) from public, anon;
grant execute on function public.set_recipe_share(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Geteiltes Rezept lesen (auch ohne Login). Liefert nur, was die Rezeptkarte braucht:
-- keine owner_id, keine Rezept-ID, keine E-Mail; als Autor nur der Anzeigename.
-- image_url ist ein interner Speicherpfad: die App gibt ihn nicht an den Browser weiter,
-- sondern liefert das Foto über /r/[token]/foto aus.
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
-- „In mein Rezeptbuch übernehmen“ von einer geteilten Karte (nur eingeloggt). Wie duplicate_recipe,
-- aber das Original darf privat sein: Zugriff nur mit gültigem Token. Die Kopie ist immer privat.
-- forked_from_id zeigt aufs Original; die Rezeptseite nennt es nur, wenn es lesbar ist.
-- Das Foto kopiert die App danach (src/lib/server/shared-recipes.ts).
-- ---------------------------------------------------------------------------
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
    is_meal_prep, is_public, image_url, source_url, forked_from_id
  ) values (
    v_uid, v_src.recipe_type, v_src.title, v_src.description, v_src.servings, v_src.prep_minutes,
    v_src.cook_minutes, v_src.category, v_src.tags, v_src.is_meal_prep, false, null, v_src.source_url,
    case when v_src.owner_id = v_uid then null else v_src.id end
  )
  returning id into v_new;

  insert into public.recipe_ingredients (recipe_id, ingredient_id, position, amount, unit, grams, note, step_position)
  select v_new, ingredient_id, position, amount, unit, grams, note, step_position
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
