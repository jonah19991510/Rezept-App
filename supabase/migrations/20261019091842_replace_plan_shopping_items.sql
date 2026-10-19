-- Phase 4: Einkaufsliste aus dem Wochenplan neu erstellen, in einer Transaktion.
-- Ersetzt alle Einträge mit source = 'plan'; von Hand angelegte Einträge (source = 'manual') bleiben.
-- p_items: [{ingredient_id, name, amount, unit}] (zusammengefasst vom Server, src/lib/domain/shopping.ts)
-- SECURITY INVOKER: RLS gilt.

create or replace function public.replace_plan_shopping_items(p_items jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  delete from public.shopping_list_items where user_id = v_uid and source = 'plan';

  insert into public.shopping_list_items (user_id, ingredient_id, name, amount, unit, checked, source)
  select
    v_uid,
    nullif(e ->> 'ingredient_id', '')::uuid,
    e ->> 'name',
    nullif(e ->> 'amount', '')::numeric,
    nullif(e ->> 'unit', ''),
    false,
    'plan'
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as t(e);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.replace_plan_shopping_items(jsonb) from public, anon;
grant execute on function public.replace_plan_shopping_items(jsonb) to authenticated;
