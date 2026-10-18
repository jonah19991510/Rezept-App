-- Die "for all"-Policies auf den Rezept-Kindtabellen galten auch für SELECT und
-- überschnitten sich dort mit den eigenen Lese-Policies (Advisor: multiple_permissive_policies).
-- Ersetzt durch getrennte INSERT/UPDATE/DELETE-Policies. Die Rechte bleiben gleich.

drop policy "cocktail_details_write" on public.cocktail_details;
create policy "cocktail_details_insert" on public.cocktail_details
  for insert to authenticated with check ((select private.owns_recipe(recipe_id)));
create policy "cocktail_details_update" on public.cocktail_details
  for update to authenticated
  using ((select private.owns_recipe(recipe_id)))
  with check ((select private.owns_recipe(recipe_id)));
create policy "cocktail_details_delete" on public.cocktail_details
  for delete to authenticated using ((select private.owns_recipe(recipe_id)));

drop policy "recipe_ingredients_write" on public.recipe_ingredients;
create policy "recipe_ingredients_insert" on public.recipe_ingredients
  for insert to authenticated with check ((select private.owns_recipe(recipe_id)));
create policy "recipe_ingredients_update" on public.recipe_ingredients
  for update to authenticated
  using ((select private.owns_recipe(recipe_id)))
  with check ((select private.owns_recipe(recipe_id)));
create policy "recipe_ingredients_delete" on public.recipe_ingredients
  for delete to authenticated using ((select private.owns_recipe(recipe_id)));

drop policy "recipe_steps_write" on public.recipe_steps;
create policy "recipe_steps_insert" on public.recipe_steps
  for insert to authenticated with check ((select private.owns_recipe(recipe_id)));
create policy "recipe_steps_update" on public.recipe_steps
  for update to authenticated
  using ((select private.owns_recipe(recipe_id)))
  with check ((select private.owns_recipe(recipe_id)));
create policy "recipe_steps_delete" on public.recipe_steps
  for delete to authenticated using ((select private.owns_recipe(recipe_id)));
