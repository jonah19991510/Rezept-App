-- Phase 3: Woche im Wochenplan kopieren, in einer Transaktion.
-- p_replace = true: Einträge der Zielwoche vorher löschen; sonst hinten anhängen.
-- SECURITY INVOKER: RLS gilt, es werden nur eigene Einträge gelesen, gelöscht und angelegt.

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

  insert into public.meal_plan_entries (user_id, date, slot, recipe_id, servings, position)
  select v_uid, e.date + v_offset, e.slot, e.recipe_id, e.servings,
         e.position + case when p_replace then 0 else 100 end
  from public.meal_plan_entries e
  where e.user_id = v_uid and e.date between p_from_monday and p_from_monday + 6;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.copy_plan_week(date, date, boolean) from public, anon;
grant execute on function public.copy_plan_week(date, date, boolean) to authenticated;
