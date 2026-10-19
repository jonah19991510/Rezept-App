-- Phase 12: Rezept-Versionen beim Speichern und Kosten pro Rezept/Portion.

-- ---------------------------------------------------------------------------
-- Inhaltlicher Stand eines Rezepts als JSON (für recipe_versions.snapshot).
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
    ), '[]'::jsonb)
  )
  from public.recipes r
  where r.id = p_recipe_id;
$$;

-- Was als inhaltliche Änderung zählt: Portionen, Zutaten (ohne Name und berechnete Gramm), Schritte.
-- Titel und Beschreibung allein erzeugen keine neue Version.
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
    'steps', coalesce(p_snapshot -> 'steps', '[]'::jsonb)
  );
$$;

grant execute on function private.recipe_snapshot(uuid) to authenticated;
grant execute on function private.recipe_content(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- save_recipe mit Versionierung. Neue optionale Änderungsnotiz; alte Aufrufe mit drei Argumenten gehen weiter.
-- Neues Rezept: Version 1. Änderung am Inhalt: neue Version (current_version + 1).
-- Rezepte von vor Phase 12 bekommen beim ersten Bearbeiten ihren alten Stand als Ausgangsversion.
-- ---------------------------------------------------------------------------
drop function public.save_recipe(jsonb, jsonb, jsonb);

create function public.save_recipe(p_recipe jsonb, p_ingredients jsonb, p_steps jsonb, p_change_note text default null)
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
  v_current integer;
  v_latest jsonb;
  v_snapshot jsonb;
  v_note text := nullif(btrim(coalesce(p_change_note, '')), '');
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
-- Kosten pro Rezept und Portion aus den eigenen Preisen (ingredient_prices des Aufrufers).
-- Preis pro Gramm: Packung in Gramm umgerechnet (ml/cl über die Dichte, Stück über das Stückgewicht).
-- priced_count < ingredient_count: einzelne Zutaten ohne Preis (wird in der App offen angezeigt).
-- ---------------------------------------------------------------------------
create view public.recipe_costs
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
left join public.recipe_ingredients ri on ri.recipe_id = r.id
left join prices pr on pr.ingredient_id = ri.ingredient_id
group by r.id, r.servings;

revoke all on public.recipe_costs from anon;
grant select on public.recipe_costs to authenticated;
