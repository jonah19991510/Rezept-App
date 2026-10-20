-- Eigene Zutaten bearbeiten (Seite „Zutaten“): Ändert sich Dichte oder Stückgewicht einer Zutat, stimmen die
-- gespeicherten Gramm in recipe_ingredients nicht mehr. Ein Trigger rechnet sie für alle Rezeptzeilen mit dieser
-- Zutat neu (auch in Rezepten anderer, die die Zutat verwenden), mit denselben Regeln wie src/lib/domain/units.ts:
--   ml/cl/EL/TL/Dash/Barlöffel: Menge × ml-Wert × Dichte (ohne Dichte 1 g/ml)
--   Stück: Menge × Stückgewicht; ohne Stückgewicht bleibt die gespeicherte (manuelle) Angabe
--   g und Prise hängen nicht an der Zutat und bleiben unverändert
-- Rundung wie roundGrams: ab 10 g eine Nachkommastelle, darunter zwei.
-- Bearbeiten dürfen Nutzer weiterhin nur selbst angelegte Zutaten (Policy ingredients_update_own aus Phase 1).

create or replace function private.round_grams(p_grams numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case when p_grams >= 10 then round(p_grams, 1) else round(p_grams, 2) end;
$$;

create or replace function private.recompute_ingredient_grams()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.recipe_ingredients ri
  set grams = private.round_grams(
    case
      when ri.unit = 'piece' then ri.amount * new.piece_weight_g
      else ri.amount
        * case ri.unit
            when 'ml' then 1
            when 'cl' then 10
            when 'tbsp' then 15
            when 'tsp' then 5
            when 'dash' then 0.6
            when 'barspoon' then 5
          end
        * coalesce(nullif(new.density_g_per_ml, 0), 1)
    end
  )
  where ri.ingredient_id = new.id
    and ri.amount is not null
    and (
      ri.unit in ('ml', 'cl', 'tbsp', 'tsp', 'dash', 'barspoon')
      or (ri.unit = 'piece' and new.piece_weight_g is not null)
    );
  return null;
end;
$$;

revoke all on function private.recompute_ingredient_grams() from public, anon, authenticated;

create trigger ingredients_recompute_grams
  after update of density_g_per_ml, piece_weight_g on public.ingredients
  for each row
  when (
    old.density_g_per_ml is distinct from new.density_g_per_ml
    or old.piece_weight_g is distinct from new.piece_weight_g
  )
  execute function private.recompute_ingredient_grams();
