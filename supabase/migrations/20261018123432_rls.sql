-- Phase 1: Row Level Security auf jeder Tabelle, ohne Ausnahme.
-- auth.uid() steht immer in (select …), damit Postgres es nur einmal pro Abfrage auswertet.

alter table public.profiles enable row level security;
alter table public.app_config enable row level security;
alter table public.ingredients enable row level security;
alter table public.recipes enable row level security;
alter table public.cocktail_details enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_steps enable row level security;
alter table public.recipe_versions enable row level security;
alter table public.meal_prep_batches enable row level security;
alter table public.meal_plan_entries enable row level security;
alter table public.plan_days enable row level security;
alter table public.user_goals enable row level security;
alter table public.user_settings enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.pantry_items enable row level security;
alter table public.ingredient_prices enable row level security;
alter table public.cook_logs enable row level security;
alter table public.favorites enable row level security;

-- ---------------------------------------------------------------------------
-- Tabellenrechte explizit setzen (RLS entscheidet dann zeilenweise)
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.app_config to anon;

-- profiles: kein INSERT/DELETE durch Nutzer (Trigger bzw. Cascade), UPDATE nur ohne role
revoke insert, update, delete on public.profiles from authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

-- app_config: nur lesen
revoke insert, update, delete on public.app_config from authenticated;

-- user_settings: Zeile entsteht per Trigger, kein Löschen durch Nutzer
revoke delete on public.user_settings from authenticated;

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen für Rezept-Rechte (security definer, damit Policies auf
-- Kindtabellen nicht erneut die RLS von recipes auswerten müssen)
-- ---------------------------------------------------------------------------
create or replace function private.owns_recipe(p_recipe_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.recipes
    where id = p_recipe_id and owner_id = (select auth.uid())
  );
$$;

create or replace function private.can_read_recipe(p_recipe_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.recipes
    where id = p_recipe_id
      and (owner_id = (select auth.uid()) or is_public)
  );
$$;

grant execute on function private.owns_recipe(uuid) to authenticated;
grant execute on function private.can_read_recipe(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- profiles: alle Eingeloggten sehen Anzeigenamen, jeder bearbeitet nur sich selbst
-- (E-Mail-Adressen liegen nur in auth.users und sind hier nie sichtbar)
-- ---------------------------------------------------------------------------
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- app_config: alle lesen
-- ---------------------------------------------------------------------------
create policy "app_config_select_all" on public.app_config
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- ingredients: alle Eingeloggten lesen und legen an; eigene Einträge korrigieren
-- ---------------------------------------------------------------------------
create policy "ingredients_select_authenticated" on public.ingredients
  for select to authenticated using (true);

create policy "ingredients_insert_authenticated" on public.ingredients
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and source in ('user', 'openfoodfacts')
  );

create policy "ingredients_update_own" on public.ingredients
  for update to authenticated
  using (created_by = (select auth.uid()) and source = 'user')
  with check (created_by = (select auth.uid()) and source = 'user');

create policy "ingredients_delete_own" on public.ingredients
  for delete to authenticated
  using (created_by = (select auth.uid()) and source = 'user');

-- ---------------------------------------------------------------------------
-- recipes: privat nur Owner; öffentlich lesbar für Eingeloggte; schreiben nur Owner.
-- Kein anonymer Zugriff (Share-Links kommen in Phase 14 über eine Security-Definer-Funktion).
-- ---------------------------------------------------------------------------
create policy "recipes_select_own_or_public" on public.recipes
  for select to authenticated
  using (owner_id = (select auth.uid()) or is_public);

create policy "recipes_insert_own" on public.recipes
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "recipes_update_own" on public.recipes
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "recipes_delete_own" on public.recipes
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Kindtabellen: lesen wie das Rezept, schreiben nur der Owner des Rezepts
create policy "cocktail_details_select" on public.cocktail_details
  for select to authenticated using ((select private.can_read_recipe(recipe_id)));
create policy "cocktail_details_write" on public.cocktail_details
  for all to authenticated
  using ((select private.owns_recipe(recipe_id)))
  with check ((select private.owns_recipe(recipe_id)));

create policy "recipe_ingredients_select" on public.recipe_ingredients
  for select to authenticated using ((select private.can_read_recipe(recipe_id)));
create policy "recipe_ingredients_write" on public.recipe_ingredients
  for all to authenticated
  using ((select private.owns_recipe(recipe_id)))
  with check ((select private.owns_recipe(recipe_id)));

create policy "recipe_steps_select" on public.recipe_steps
  for select to authenticated using ((select private.can_read_recipe(recipe_id)));
create policy "recipe_steps_write" on public.recipe_steps
  for all to authenticated
  using ((select private.owns_recipe(recipe_id)))
  with check ((select private.owns_recipe(recipe_id)));

-- Versionen: nur der Owner des Rezepts
create policy "recipe_versions_own" on public.recipe_versions
  for all to authenticated
  using ((select private.owns_recipe(recipe_id)))
  with check ((select private.owns_recipe(recipe_id)));

-- ---------------------------------------------------------------------------
-- Nutzereigene Tabellen: nur der eigene Nutzer.
-- Wo ein Rezept referenziert wird, muss es für den Nutzer lesbar sein.
-- ---------------------------------------------------------------------------
create policy "meal_prep_batches_own" on public.meal_prep_batches
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select private.can_read_recipe(recipe_id)));

create policy "meal_plan_entries_own" on public.meal_plan_entries
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select private.can_read_recipe(recipe_id)));

create policy "plan_days_own" on public.plan_days
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "user_goals_own" on public.user_goals
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "user_settings_select_own" on public.user_settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy "user_settings_insert_own" on public.user_settings
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "user_settings_update_own" on public.user_settings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "shopping_list_items_own" on public.shopping_list_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "pantry_items_own" on public.pantry_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "ingredient_prices_own" on public.ingredient_prices
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "cook_logs_own" on public.cook_logs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select private.can_read_recipe(recipe_id)));

create policy "favorites_own" on public.favorites
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select private.can_read_recipe(recipe_id)));
