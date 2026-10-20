-- Selbst angelegte Zutaten löschen: Rechte, Cascade auf eigenen Preis/Vorrat, Sperren (Rezept, Einträge anderer).
-- Im Supabase SQL-Editor ausführen; bricht am Ende absichtlich ab („TESTERGEBNIS …“), alles wird zurückgerollt.
--
-- Erwartet (Lauf 20.10.2026):
--   B_deletes_A=0 | A_deletes_free=1 price_left=0 pantry_left=0 shopping_kept=1 | used=blocked(23503)
--   | shared=blocked(Die Zutat wird noch von anderen genutzt (Vorrat oder Preise).) | A_deletes_seed=0

do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  free uuid; used uuid; shared uuid; seed uuid; ra uuid;
  out text := '';
  n int;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'del-test-a@example.invalid', '{"display_name":"Del A"}', now(), now()),
         (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'del-test-b@example.invalid', '{}', now(), now());
  select id into seed from public.ingredients where source = 'seed' and external_id = 'zucker';

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.ingredients (name, kcal, food_group, diet, created_by, source) values ('Frei A', 1, 'other', 'vegan', a, 'user') returning id into free;
  insert into public.ingredients (name, kcal, food_group, diet, created_by, source) values ('Im Rezept A', 1, 'other', 'vegan', a, 'user') returning id into used;
  insert into public.ingredients (name, kcal, food_group, diet, created_by, source) values ('Bei B im Vorrat', 1, 'other', 'vegan', a, 'user') returning id into shared;
  insert into public.ingredient_prices (user_id, ingredient_id, price, package_amount, package_unit) values (a, free, 1, 100, 'g');
  insert into public.pantry_items (user_id, ingredient_id) values (a, free);
  insert into public.shopping_list_items (user_id, ingredient_id, name, source) values (a, free, 'Frei A', 'manual');
  insert into public.recipes (owner_id, title, servings) values (a, 'R', 1) returning id into ra;
  insert into public.recipe_ingredients (recipe_id, ingredient_id, grams) values (ra, used, 10);

  -- B darf A's Zutat nicht löschen; B hat eine von A's Zutaten im Vorrat
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  insert into public.pantry_items (user_id, ingredient_id) values (b, shared);
  delete from public.ingredients where id = free;
  get diagnostics n = row_count;
  out := 'B_deletes_A=' || n;

  -- A löscht eine unbenutzte eigene Zutat: eigener Preis und Vorrat gehen mit, Einkaufsliste behält den Namen
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  delete from public.ingredients where id = free;
  get diagnostics n = row_count;
  out := out || ' | A_deletes_free=' || n;
  select count(*) into n from public.ingredient_prices where ingredient_id = free;
  out := out || ' price_left=' || n;
  select count(*) into n from public.pantry_items where ingredient_id = free;
  out := out || ' pantry_left=' || n;
  select count(*) into n from public.shopping_list_items where user_id = a and name = 'Frei A' and ingredient_id is null;
  out := out || ' shopping_kept=' || n;

  begin
    delete from public.ingredients where id = used;
    out := out || ' | used=deleted?!';
  exception when foreign_key_violation then out := out || ' | used=blocked(23503)';
  end;
  begin
    delete from public.ingredients where id = shared;
    out := out || ' | shared=deleted?!';
  exception when raise_exception then out := out || ' | shared=blocked(' || sqlerrm || ')';
  end;
  delete from public.ingredients where id = seed;
  get diagnostics n = row_count;
  out := out || ' | A_deletes_seed=' || n;

  execute 'reset role';
  raise exception 'TESTERGEBNIS %', out;
end $$;

-- Zweiter Block (ab Migration …190000): aus Open Food Facts übernommene Zutaten darf der Nutzer löschen, nicht ändern.
-- Erwartet: B_deletes_A_off=0 | A_updates_off=0 | A_deletes_off_free=1 | off_used=blocked(23503)
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  off_free uuid; off_used uuid; rb uuid;
  out text := '';
  n int;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'off-test-a@example.invalid', '{"display_name":"Off A"}', now(), now()),
         (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'off-test-b@example.invalid', '{}', now(), now());
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.ingredients (name, kcal, food_group, diet, created_by, source, external_id) values ('OFF frei', 1, 'other', 'vegan', a, 'openfoodfacts', '4000000000101') returning id into off_free;
  insert into public.ingredients (name, kcal, food_group, diet, created_by, source, external_id) values ('OFF bei B', 1, 'other', 'vegan', a, 'openfoodfacts', '4000000000102') returning id into off_used;

  -- B nutzt eine davon im eigenen Rezept und darf A's Zutaten nicht löschen
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  insert into public.recipes (owner_id, title, servings) values (b, 'R B', 1) returning id into rb;
  insert into public.recipe_ingredients (recipe_id, ingredient_id, grams) values (rb, off_used, 10);
  delete from public.ingredients where id = off_free;
  get diagnostics n = row_count;
  out := 'B_deletes_A_off=' || n;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  update public.ingredients set kcal = 2 where id = off_free;
  get diagnostics n = row_count;
  out := out || ' | A_updates_off=' || n;
  delete from public.ingredients where id = off_free;
  get diagnostics n = row_count;
  out := out || ' | A_deletes_off_free=' || n;
  begin
    delete from public.ingredients where id = off_used;
    out := out || ' | off_used=deleted?!';
  exception when foreign_key_violation then out := out || ' | off_used=blocked(23503)';
  end;
  execute 'reset role';
  raise exception 'TESTERGEBNIS %', out;
end $$;
