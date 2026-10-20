-- Phase 15: Prüfung Cocktail-Bereich (save_recipe mit Cocktail-Feldern, Alkoholgehalt, Versionen, Teilen, RLS, Cascade).
-- Im Supabase SQL-Editor ausführen. Läuft in EINER Transaktion und bricht am Ende absichtlich ab
-- („TESTERGEBNIS …“), dadurch wird alles zurückgerollt.
--
-- Erwartet:
--   seed_new=6, type=cocktail,coupette,shaken,ice=null,Limettenrad
--   shaken: vol=137.5 abv=17.5 g=18.9 ml=24.00 dil=0.25   (Minze in g zählt nicht zum Volumen)
--   v1_cocktail=shaken, stirred: v=2 abv=18.2, old_call: type=cocktail,method=stirred,v=2,
--   two_drinks: vol=132.0 g=18.9 abv=18.2, dish: details=0 alcohol_rows=0, dish_old_call=dish
--   B_sees_details=0, B_sees_alcohol=0, shared: type=cocktail,method=stirred,abv=18.2,g=18.9
--   anon_alcohol=denied, after_delete_A: details=0 recipes=0

do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  rum uuid; lime uuid; syrup uuid; mint uuid;
  c uuid; d uuid; tok text; j jsonb;
  ings jsonb;
  out text := '';
  n int; t record;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bar-test-a@example.invalid', '{"display_name":"Bar A"}', now(), now()),
         (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bar-test-b@example.invalid', '{}', now(), now());
  select id into rum from public.ingredients where source = 'seed' and external_id = 'rum-weiss';
  select id into lime from public.ingredients where source = 'seed' and external_id = 'limettensaft';
  select id into syrup from public.ingredients where source = 'seed' and external_id = 'zuckersirup';
  select id into mint from public.ingredients where source = 'seed' and external_id = 'minze';
  select count(*) into n from public.ingredients
    where source = 'seed' and external_id in ('wodka', 'tequila', 'angostura', 'sodawasser', 'minze', 'eiweiss');
  out := 'seed_new=' || n;

  ings := jsonb_build_array(
    jsonb_build_object('ingredient_id', rum, 'amount', 6, 'unit', 'cl', 'grams', 57),
    jsonb_build_object('ingredient_id', lime, 'amount', 3, 'unit', 'cl', 'grams', 30.9),
    jsonb_build_object('ingredient_id', syrup, 'amount', 2, 'unit', 'cl', 'grams', 24.6),
    jsonb_build_object('ingredient_id', mint, 'amount', 5, 'unit', 'g', 'grams', 5));

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);

  c := public.save_recipe(
    jsonb_build_object('title', 'Daiquiri', 'servings', 1, 'recipe_type', 'cocktail', 'category', 'drink', 'tags', '[]'::jsonb,
      'cocktail', jsonb_build_object('glass', 'coupette', 'method', 'shaken', 'ice', ' ', 'garnish', 'Limettenrad')),
    ings, jsonb_build_array(jsonb_build_object('text', 'Alles auf Eis shaken.')), null);
  select r.recipe_type, cd.glass, cd.method, cd.ice, cd.garnish into t
    from public.recipes r join public.cocktail_details cd on cd.recipe_id = r.id where r.id = c;
  out := out || ' | type=' || t.recipe_type || ',' || t.glass || ',' || t.method || ',ice=' || coalesce(t.ice, 'null') || ',' || t.garnish;
  select * into t from public.recipe_alcohol where recipe_id = c;
  out := out || ' | shaken: vol=' || t.drink_volume_ml || ' abv=' || t.abv_percent || ' g=' || t.alcohol_g_per_drink
    || ' ml=' || t.alcohol_ml_per_drink || ' dil=' || t.dilution;
  select snapshot -> 'cocktail' ->> 'method' into tok from public.recipe_versions where recipe_id = c and version = 1;
  out := out || ' | v1_cocktail=' || coalesce(tok, 'null');

  -- Methode ändern: neue Version, anderer Alkoholgehalt
  perform public.save_recipe(
    jsonb_build_object('id', c, 'title', 'Daiquiri', 'servings', 1, 'recipe_type', 'cocktail', 'category', 'drink',
      'cocktail', jsonb_build_object('glass', 'coupette', 'method', 'stirred', 'garnish', 'Limettenrad')),
    ings, jsonb_build_array(jsonb_build_object('text', 'Alles auf Eis shaken.')), 'gerührt');
  select r.current_version, a2.abv_percent into t from public.recipes r join public.recipe_alcohol a2 on a2.recipe_id = r.id where r.id = c;
  out := out || ' | stirred: v=' || t.current_version || ' abv=' || t.abv_percent;

  -- Aufruf wie die ältere App-Version / Wiederherstellung: ohne recipe_type und ohne cocktail
  perform public.save_recipe(
    jsonb_build_object('id', c, 'title', 'Daiquiri', 'servings', 1, 'category', 'drink'),
    ings, jsonb_build_array(jsonb_build_object('text', 'Alles auf Eis shaken.')), null);
  select r.recipe_type, cd.method, r.current_version into t
    from public.recipes r join public.cocktail_details cd on cd.recipe_id = r.id where r.id = c;
  out := out || ' | old_call: type=' || t.recipe_type || ',method=' || t.method || ',v=' || t.current_version;

  -- Zwei Drinks aus der doppelten Menge (alles × 2, servings 2): pro Drink gleich
  perform public.save_recipe(
    jsonb_build_object('id', c, 'title', 'Daiquiri', 'servings', 2),
    (select jsonb_agg(e || jsonb_build_object('amount', (e ->> 'amount')::numeric * 2)) from jsonb_array_elements(ings) e),
    '[]'::jsonb, null);
  select * into t from public.recipe_alcohol where recipe_id = c;
  out := out || ' | two_drinks: vol=' || t.drink_volume_ml || ' g=' || t.alcohol_g_per_drink || ' abv=' || t.abv_percent;

  -- Gericht: keine Cocktail-Felder, keine Alkohol-Zeile; ohne recipe_type bleibt es Gericht
  d := public.save_recipe(
    jsonb_build_object('title', 'Rumtopf-Test', 'servings', 2, 'cocktail', jsonb_build_object('method', 'shaken')),
    ings, '[]'::jsonb, null);
  select count(*) into n from public.cocktail_details where recipe_id = d;
  out := out || ' | dish: details=' || n;
  select count(*) into n from public.recipe_alcohol where recipe_id = d;
  out := out || ' alcohol_rows=' || n;
  perform public.save_recipe(jsonb_build_object('id', d, 'title', 'Rumtopf-Test', 'servings', 2), ings, '[]'::jsonb, null);
  select recipe_type::text into tok from public.recipes where id = d;
  out := out || ' | dish_old_call=' || tok;

  tok := public.set_recipe_share(c, true);

  -- Nutzer B sieht private Cocktail-Daten nicht
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.cocktail_details where recipe_id = c;
  out := out || ' | B_sees_details=' || n;
  select count(*) into n from public.recipe_alcohol where recipe_id = c;
  out := out || ', B_sees_alcohol=' || n;

  -- Geteilte Karte ohne Login
  execute 'reset role';
  execute 'set local role anon';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  j := public.get_shared_recipe(tok);
  out := out || ' | shared: type=' || (j ->> 'recipe_type') || ',method=' || (j -> 'cocktail' ->> 'method')
    || ',abv=' || (j -> 'alcohol' ->> 'abv_percent') || ',g=' || (j -> 'alcohol' ->> 'alcohol_g');
  begin
    select count(*) into n from public.recipe_alcohol;
    out := out || ' | anon_alcohol=' || n;
  exception when insufficient_privilege then
    out := out || ' | anon_alcohol=denied';
  end;
  execute 'reset role';

  -- Account-Löschung: alles weg
  delete from auth.users where id = a;
  select count(*) into n from public.cocktail_details where recipe_id = c;
  out := out || ' | after_delete_A: details=' || n;
  select count(*) into n from public.recipes where owner_id = a;
  out := out || ' recipes=' || n;

  raise exception 'TESTERGEBNIS %', out;
end $$;
