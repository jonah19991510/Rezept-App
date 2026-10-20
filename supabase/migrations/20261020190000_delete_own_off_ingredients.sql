-- Seite „Zutaten“: Nutzer dürfen auch Zutaten löschen, die sie selbst aus Open Food Facts übernommen haben
-- (nicht nur selbst erstellte). Ändern bleibt bei Open-Food-Facts-Zutaten gesperrt (ingredients_update_own).
-- Sicher, weil das Löschen weiterhin scheitert, solange die Zutat in irgendeinem Rezept steckt (Fremdschlüssel
-- recipe_ingredients, ON DELETE RESTRICT) oder andere sie im Vorrat bzw. mit Preis haben (Trigger
-- ingredients_protect_shared_delete). Wer den Barcode später wieder übernimmt, bekommt die Zutat neu angelegt.

drop policy "ingredients_delete_own" on public.ingredients;

create policy "ingredients_delete_own" on public.ingredients
  for delete to authenticated
  using (created_by = (select auth.uid()) and source in ('user', 'openfoodfacts'));
