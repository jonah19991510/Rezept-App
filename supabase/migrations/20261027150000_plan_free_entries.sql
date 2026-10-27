-- Wochenplan (27.10.2026): eigene Einträge ohne Rezept, z. B. „Restaurant“ oder „Essen bei den Eltern“.
-- Ein Eintrag hat jetzt entweder ein Rezept oder einen eigenen Titel. Eigene Einträge haben keine Nährwerte, keine
-- Kosten, kein Meal Prep und landen nicht auf der Einkaufsliste (das regelt die App, weil kein Rezept dran hängt).
-- Für die laufende Version der App ändert sich nichts, solange es keine eigenen Einträge gibt.

alter table public.meal_plan_entries
  alter column recipe_id drop not null,
  add column title text check (title is null or char_length(btrim(title)) between 1 and 80),
  -- genau eins von beidem: Rezept oder eigener Titel
  add constraint meal_plan_entries_recipe_or_title check ((recipe_id is null) = (title is not null)),
  -- Meal Prep und Reste gibt es nur mit Rezept
  add constraint meal_plan_entries_free_no_batch check (recipe_id is not null or (batch_id is null and not is_leftover));

-- RLS: Rezepte müssen weiter lesbar sein; eigene Einträge brauchen keins
drop policy "meal_plan_entries_own" on public.meal_plan_entries;
create policy "meal_plan_entries_own" on public.meal_plan_entries
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (recipe_id is null or (select private.can_read_recipe(recipe_id))));

-- Woche kopieren: eigene Einträge mitnehmen (gleiche Signatur und Rückgabe wie bisher)
create or replace function public.copy_plan_week(p_from_monday date, p_to_monday date, p_replace boolean)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_offset integer := p_to_monday - p_from_monday;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;
  if extract(isodow from p_from_monday) <> 1 or extract(isodow from p_to_monday) <> 1 then
    raise exception 'Wochen müssen an einem Montag beginnen.' using errcode = '22023';
  end if;
  if v_offset = 0 then
    raise exception 'Quell- und Zielwoche sind gleich.' using errcode = '22023';
  end if;

  if p_replace then
    delete from public.meal_plan_entries
    where user_id = v_uid and date between p_to_monday and p_to_monday + 6;
  end if;

  insert into public.meal_plan_entries (user_id, date, slot, recipe_id, title, servings, position)
  select v_uid, e.date + v_offset, e.slot, e.recipe_id, e.title, e.servings,
         e.position + case when p_replace then 0 else 100 end
  from public.meal_plan_entries e
  where e.user_id = v_uid
    and e.date between p_from_monday and p_from_monday + 6
    -- RLS des Aufrufers: nur eigene und (noch) öffentliche Rezepte sind sichtbar; eigene Einträge immer
    and (e.recipe_id is null or exists (select 1 from public.recipes r where r.id = e.recipe_id));

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.copy_plan_week(date, date, boolean) from public, anon;
grant execute on function public.copy_plan_week(date, date, boolean) to authenticated;
