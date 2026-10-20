-- Selbst angelegte Zutaten löschen (Seite „Zutaten“). Löschen dürfen Nutzer nur eigene Zutaten mit Quelle „user“
-- (Policy ingredients_delete_own aus Phase 1). Steckt die Zutat in einem Rezept (auch bei anderen), sperrt der
-- Fremdschlüssel recipe_ingredients (ON DELETE RESTRICT). Vorrat und Preise hängen per Cascade an der Zutat:
-- eigene Einträge gehen mit, aber Einträge ANDERER Nutzer dürfen nicht still verschwinden. Dieser Trigger lehnt das
-- Löschen dann ab. Einkaufslisten behalten den Namen (ON DELETE SET NULL), dort geht nichts verloren.

create or replace function private.protect_shared_ingredient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.pantry_items where ingredient_id = old.id and user_id is distinct from old.created_by)
     or exists (select 1 from public.ingredient_prices where ingredient_id = old.id and user_id is distinct from old.created_by)
  then
    raise exception 'Die Zutat wird noch von anderen genutzt (Vorrat oder Preise).'
      using errcode = 'P0001', hint = 'shared_ingredient';
  end if;
  return old;
end;
$$;

revoke all on function private.protect_shared_ingredient() from public, anon, authenticated;

create trigger ingredients_protect_shared_delete
  before delete on public.ingredients
  for each row execute function private.protect_shared_ingredient();
