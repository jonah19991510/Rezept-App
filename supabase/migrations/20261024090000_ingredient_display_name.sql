-- Vorrat im neuen Design (24.10.2026): kurzer Anzeigename für Zutaten. Open-Food-Facts-Namen sind oft lang
-- („Bio Staudensellerie Klasse II (Edeka)“). Ist display_name leer, kürzt die App solche Namen selbst
-- (src/lib/domain/ingredient-name.ts); die Spalte hält nur Korrekturen von Hand. Additiv, ohne Datenumbau.
alter table public.ingredients
  add column display_name text check (display_name is null or char_length(btrim(display_name)) between 1 and 60);

-- Ändern über eine schmale Funktion statt über die Update-Policy: Open-Food-Facts-Zutaten und der Grundbestand
-- bleiben sonst gesperrt (ingredients_update_own), hier geht nur dieses eine Feld. Erlaubt für selbst angelegte
-- Zutaten und für Zutaten, die man selbst nutzt (in eigenen Rezepten oder im eigenen Vorrat). Der Kurzname gilt
-- für alle Nutzer gleich. Leerer Text setzt ihn zurück (dann wieder automatisch).
create or replace function public.set_ingredient_display_name(p_ingredient_id uuid, p_display_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.ingredients i
    where i.id = p_ingredient_id
      and (
        i.created_by = v_uid
        or exists (
          select 1
          from public.recipe_ingredients ri
          join public.recipes r on r.id = ri.recipe_id
          where ri.ingredient_id = i.id and r.owner_id = v_uid
        )
        or exists (select 1 from public.pantry_items p where p.ingredient_id = i.id and p.user_id = v_uid)
      )
  ) then
    raise exception 'Diese Zutat kannst du nicht umbenennen' using errcode = '42501';
  end if;

  update public.ingredients
  set display_name = nullif(btrim(p_display_name), '')
  where id = p_ingredient_id;
end;
$$;

revoke all on function public.set_ingredient_display_name(uuid, text) from public, anon;
grant execute on function public.set_ingredient_display_name(uuid, text) to authenticated;
