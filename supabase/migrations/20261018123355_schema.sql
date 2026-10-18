-- Phase 1: komplettes Grundschema
-- Alle nutzerbezogenen Fremdschlüssel mit ON DELETE CASCADE (Account-Löschung),
-- forked_from_id mit ON DELETE SET NULL (Kopien anderer Nutzer bleiben erhalten).

create extension if not exists pg_trgm with schema extensions;

-- Schema für interne Hilfsfunktionen, das nicht über die API erreichbar ist
create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('user', 'admin');
create type public.recipe_type as enum ('dish', 'cocktail');
create type public.recipe_category as enum (
  'pasta', 'rice', 'bowl', 'soup', 'salad', 'casserole',
  'meat', 'fish', 'breakfast', 'snack', 'dessert', 'drink'
);
create type public.food_group as enum (
  'vegetables', 'fruit', 'meat', 'fish', 'dairy', 'egg', 'grains',
  'legumes', 'nuts_seeds', 'oils_fats', 'spices_sauces',
  'spirits', 'liqueurs_wine', 'syrups_juices', 'other'
);
create type public.ingredient_diet as enum ('vegan', 'vegetarian', 'none');
create type public.ingredient_source as enum ('seed', 'openfoodfacts', 'user');
create type public.unit as enum (
  'g', 'ml', 'cl', 'piece', 'tbsp', 'tsp', 'pinch', 'dash', 'barspoon'
);
create type public.meal_slot as enum ('breakfast', 'lunch', 'dinner', 'snack');
create type public.goal_type as enum ('default', 'training');
create type public.pantry_location as enum ('kitchen', 'bar');
create type public.shopping_source as enum ('plan', 'manual');
create type public.glass as enum ('tumbler', 'coupette', 'highball', 'martini', 'tiki', 'other');
create type public.cocktail_method as enum ('shaken', 'stirred', 'built', 'blended');

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen
-- ---------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 50),
  avatar_url text,
  role public.user_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Admin-Prüfung für Policies (security definer, damit keine RLS-Rekursion entsteht)
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;
grant execute on function private.is_admin() to authenticated;

-- Zweite Sicherung neben den Spaltenrechten: Nutzer können ihre Rolle nie selbst ändern.
-- Im SQL-Editor/Dashboard (ohne JWT) und mit dem Secret Key bleibt es möglich.
create or replace function private.protect_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and coalesce(auth.jwt() ->> 'role', '') in ('authenticated', 'anon') then
    raise exception 'Die Rolle kann nicht selbst geändert werden.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function private.protect_profile_role();

-- ---------------------------------------------------------------------------
-- app_config: zentrale Schwellenwerte (Änderungen nur per Migration)
-- ---------------------------------------------------------------------------
create table public.app_config (
  key text primary key,
  value jsonb not null,
  description text
);

insert into public.app_config (key, value, description) values
  ('high_protein_min_protein_g', '30', 'High Protein: mindestens so viele Gramm Protein pro Portion'),
  ('high_protein_min_kcal_share', '0.3', 'High Protein: oder mindestens dieser Anteil der kcal aus Protein'),
  ('low_carb_max_carbs_g', '20', 'Low Carb: höchstens so viele Gramm Kohlenhydrate pro Portion');

-- ---------------------------------------------------------------------------
-- ingredients: globale Zutatentabelle, Nährwerte pro 100 g
-- ---------------------------------------------------------------------------
create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  kcal numeric(7, 2) not null default 0 check (kcal >= 0),
  protein numeric(6, 2) not null default 0 check (protein >= 0),
  carbs numeric(6, 2) not null default 0 check (carbs >= 0),
  fat numeric(6, 2) not null default 0 check (fat >= 0),
  fiber numeric(6, 2) not null default 0 check (fiber >= 0),
  sugar numeric(6, 2) not null default 0 check (sugar >= 0),
  food_group public.food_group not null default 'other',
  diet public.ingredient_diet not null,
  piece_weight_g numeric(8, 2) check (piece_weight_g > 0),
  density_g_per_ml numeric(6, 3) check (density_g_per_ml > 0),
  abv numeric(5, 2) check (abv between 0 and 100),
  is_staple boolean not null default false,
  source public.ingredient_source not null default 'user',
  external_id text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (source, external_id)
);

create index ingredients_name_trgm_idx on public.ingredients
  using gin (name extensions.gin_trgm_ops);
create index ingredients_created_by_idx on public.ingredients (created_by);

-- diet aus der Zutatengruppe vorbelegen, wenn nicht angegeben (überschreibbar, z. B. Honig = vegetarisch)
create or replace function private.ingredients_default_diet()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.diet is null then
    new.diet := case
      when new.food_group in ('meat', 'fish', 'other') then 'none'::public.ingredient_diet
      when new.food_group in ('dairy', 'egg') then 'vegetarian'::public.ingredient_diet
      else 'vegan'::public.ingredient_diet
    end;
  end if;
  return new;
end;
$$;

create trigger ingredients_default_diet
  before insert on public.ingredients
  for each row execute function private.ingredients_default_diet();

-- ---------------------------------------------------------------------------
-- recipes und abhängige Tabellen
-- ---------------------------------------------------------------------------
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  recipe_type public.recipe_type not null default 'dish',
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text,
  servings integer not null default 2 check (servings between 1 and 100),
  prep_minutes integer check (prep_minutes >= 0),
  cook_minutes integer check (cook_minutes >= 0),
  category public.recipe_category,
  tags text[] not null default '{}',
  is_meal_prep boolean not null default false,
  is_public boolean not null default false,
  image_url text,
  source_url text,
  forked_from_id uuid references public.recipes (id) on delete set null,
  share_token text unique,
  current_version integer not null default 1 check (current_version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recipes_owner_id_idx on public.recipes (owner_id);
create index recipes_forked_from_id_idx on public.recipes (forked_from_id);
create index recipes_public_idx on public.recipes (is_public) where is_public;
create index recipes_title_trgm_idx on public.recipes using gin (title extensions.gin_trgm_ops);

create trigger recipes_set_updated_at
  before update on public.recipes
  for each row execute function private.set_updated_at();

create table public.cocktail_details (
  recipe_id uuid primary key references public.recipes (id) on delete cascade,
  glass public.glass,
  method public.cocktail_method,
  ice text,
  garnish text
);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  -- Zutat ist nicht löschbar, solange sie in einem Rezept verwendet wird
  ingredient_id uuid not null references public.ingredients (id) on delete restrict,
  position integer not null default 0,
  amount numeric(10, 2) check (amount > 0),
  unit public.unit,
  grams numeric(10, 2) check (grams >= 0),
  note text,
  step_position integer check (step_position >= 1)
);

create index recipe_ingredients_recipe_id_idx on public.recipe_ingredients (recipe_id);
create index recipe_ingredients_ingredient_id_idx on public.recipe_ingredients (ingredient_id);

create table public.recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  position integer not null check (position >= 1),
  text text not null check (char_length(btrim(text)) >= 1),
  timer_seconds integer check (timer_seconds > 0),
  constraint recipe_steps_position_unique unique (recipe_id, position) deferrable initially deferred
);

create table public.recipe_versions (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  version integer not null check (version >= 1),
  snapshot jsonb not null,
  change_note text,
  created_at timestamptz not null default now(),
  unique (recipe_id, version)
);

-- ---------------------------------------------------------------------------
-- Wochenplan, Ziele, Einstellungen
-- ---------------------------------------------------------------------------
create table public.meal_prep_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  cook_date date not null,
  servings_cooked numeric(6, 2) not null check (servings_cooked > 0),
  created_at timestamptz not null default now()
);

create index meal_prep_batches_user_id_idx on public.meal_prep_batches (user_id);
create index meal_prep_batches_recipe_id_idx on public.meal_prep_batches (recipe_id);

create table public.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  date date not null,
  slot public.meal_slot not null,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  servings numeric(6, 2) not null default 1 check (servings > 0),
  batch_id uuid references public.meal_prep_batches (id) on delete cascade,
  is_leftover boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index meal_plan_entries_user_date_idx on public.meal_plan_entries (user_id, date);
create index meal_plan_entries_recipe_id_idx on public.meal_plan_entries (recipe_id);
create index meal_plan_entries_batch_id_idx on public.meal_plan_entries (batch_id);

create table public.plan_days (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  date date not null,
  is_training_day boolean not null,
  primary key (user_id, date)
);

create table public.user_goals (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  goal_type public.goal_type not null,
  kcal integer check (kcal between 0 and 20000),
  protein numeric(6, 1) check (protein >= 0),
  carbs numeric(6, 1) check (carbs >= 0),
  fat numeric(6, 1) check (fat >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, goal_type)
);

create trigger user_goals_set_updated_at
  before update on public.user_goals
  for each row execute function private.set_updated_at();

create table public.user_settings (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  -- ISO-Wochentage: 1 = Montag … 7 = Sonntag
  training_weekdays smallint[] not null default '{}'
    check (training_weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  shopping_sort text not null default 'food_group' check (shopping_sort in ('food_group', 'name')),
  hide_staples boolean not null default true,
  long_not_cooked_weeks integer not null default 6 check (long_not_cooked_weeks between 1 and 104),
  updated_at timestamptz not null default now()
);

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Einkauf, Vorrat, Preise
-- ---------------------------------------------------------------------------
create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  ingredient_id uuid references public.ingredients (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  amount numeric(10, 2) check (amount > 0),
  unit text,
  checked boolean not null default false,
  source public.shopping_source not null default 'manual',
  created_at timestamptz not null default now()
);

create index shopping_list_items_user_id_idx on public.shopping_list_items (user_id);
create index shopping_list_items_ingredient_id_idx on public.shopping_list_items (ingredient_id);

create table public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  amount numeric(10, 2) check (amount > 0),
  unit text,
  location public.pantry_location not null default 'kitchen',
  expires_on date,
  updated_at timestamptz not null default now(),
  unique (user_id, ingredient_id, location)
);

create index pantry_items_ingredient_id_idx on public.pantry_items (ingredient_id);

create trigger pantry_items_set_updated_at
  before update on public.pantry_items
  for each row execute function private.set_updated_at();

create table public.ingredient_prices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  price numeric(10, 2) not null check (price >= 0),
  package_amount numeric(10, 2) not null check (package_amount > 0),
  package_unit public.unit not null default 'g',
  store text,
  updated_at timestamptz not null default now(),
  unique (user_id, ingredient_id)
);

create index ingredient_prices_ingredient_id_idx on public.ingredient_prices (ingredient_id);

create trigger ingredient_prices_set_updated_at
  before update on public.ingredient_prices
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Koch-Log, Favoriten
-- ---------------------------------------------------------------------------
create table public.cook_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  recipe_version integer,
  cooked_at timestamptz not null default now(),
  rating smallint check (rating between 1 and 5),
  note text,
  servings numeric(6, 2) check (servings > 0)
);

create index cook_logs_user_id_idx on public.cook_logs (user_id, cooked_at desc);
create index cook_logs_recipe_id_idx on public.cook_logs (recipe_id);

create table public.favorites (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

create index favorites_recipe_id_idx on public.favorites (recipe_id);

-- ---------------------------------------------------------------------------
-- Neuer Auth-User → Profil + Einstellungen anlegen
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  name_from_meta text := left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 50);
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(name_from_meta, ''), 'Neues Mitglied'));

  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
