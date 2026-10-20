-- Eigene Zutaten bearbeiten: Rechte und Neuberechnung der Gramm (Trigger ingredients_recompute_grams).
-- Im Supabase SQL-Editor ausführen; bricht am Ende absichtlich ab („TESTERGEBNIS …“), alles wird zurückgerollt.
--
-- Erwartet (Lauf 20.10.2026):
--   B_updates_A=0 | A_updates_own=1 | before: piece=240.00 ml=100.00 tbsp=45.00 g=50.00 pinch=1.00
--   | after: piece=300.00 ml=50.00 tbsp=22.50 g=50.00 pinch=1.00, B_line_after=25.00
--   | pw_removed: piece=300.00, A_updates_seed=0, A_updates_off=0, B_updates_A_again=0

do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  ing uuid; off uuid; seed uuid;
  ra uuid; rb uuid;
  out text := '';
  pre text;
  n int;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ing-test-a@example.invalid', '{"display_name":"Zutat A"}', now(), now()),
         (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ing-test-b@example.invalid', '{}', now(), now());
  select id into seed from public.ingredients where source = 'seed' and external_id = 'zucker';

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.ingredients (name, kcal, food_group, diet, created_by, source)
    values ('Testzutat A', 100, 'other', 'vegan', a, 'user') returning id into ing;
  insert into public.ingredients (name, kcal, food_group, diet, created_by, source, external_id)
    values ('OFF-Test', 100, 'other', 'vegan', a, 'openfoodfacts', '4000000000001') returning id into off;
  insert into public.recipes (owner_id, title, servings) values (a, 'Rezept A', 2) returning id into ra;
  insert into public.recipe_ingredients (recipe_id, ingredient_id, position, amount, unit, grams) values
    (ra, ing, 0, 2, 'piece', 240), (ra, ing, 1, 100, 'ml', 100), (ra, ing, 2, 3, 'tbsp', 45),
    (ra, ing, 3, 50, 'g', 50), (ra, ing, 4, 2, 'pinch', 1);

  -- B verwendet A's Zutat in einem eigenen Rezept und darf sie nicht ändern
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  insert into public.recipes (owner_id, title, servings) values (b, 'Rezept B', 1) returning id into rb;
  insert into public.recipe_ingredients (recipe_id, ingredient_id, position, amount, unit, grams) values (rb, ing, 0, 5, 'cl', 50);
  update public.ingredients set density_g_per_ml = 2 where id = ing;
  get diagnostics n = row_count;
  out := 'B_updates_A=' || n;

  -- A ändert Dichte und Stückgewicht: Gramm werden neu gerechnet (auch bei B)
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select string_agg(unit::text || '=' || grams, ' ' order by position) into pre from public.recipe_ingredients where recipe_id = ra;
  update public.ingredients set density_g_per_ml = 0.5, piece_weight_g = 150 where id = ing;
  get diagnostics n = row_count;
  out := out || ' | A_updates_own=' || n || ' | before: ' || pre;
  select string_agg(unit::text || '=' || grams, ' ' order by position) into pre from public.recipe_ingredients where recipe_id = ra;
  out := out || ' | after: ' || pre;

  execute 'reset role';
  select grams::text into pre from public.recipe_ingredients where recipe_id = rb;
  out := out || ', B_line_after=' || pre;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);

  -- Stückgewicht entfernt: die letzte Gramm-Angabe bleibt
  update public.ingredients set piece_weight_g = null where id = ing;
  select grams::text into pre from public.recipe_ingredients where recipe_id = ra and unit = 'piece';
  out := out || ' | pw_removed: piece=' || pre;

  -- Grundbestand und Open-Food-Facts-Zutaten sind nicht änderbar
  update public.ingredients set density_g_per_ml = 3 where id = seed;
  get diagnostics n = row_count;
  out := out || ', A_updates_seed=' || n;
  update public.ingredients set density_g_per_ml = 3 where id = off;
  get diagnostics n = row_count;
  out := out || ', A_updates_off=' || n;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  update public.ingredients set name = 'gekapert' where id = ing;
  get diagnostics n = row_count;
  out := out || ', B_updates_A_again=' || n;

  execute 'reset role';
  raise exception 'TESTERGEBNIS %', out;
end $$;
