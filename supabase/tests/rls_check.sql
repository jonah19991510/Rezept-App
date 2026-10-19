-- RLS-, Rollen- und Cascade-Prüfung.
-- Im Supabase SQL-Editor ausführen. Alles läuft in EINER Transaktion, die am Ende
-- absichtlich mit einer Fehlermeldung abbricht: Dadurch wird alles zurückgerollt,
-- es bleiben keine Testnutzer oder Testdaten übrig.
-- Das Ergebnis steht in der Fehlermeldung „TESTERGEBNIS …“.
--
-- Erwartet:
--   profiles_by_trigger=2, settings_by_trigger=2, default_name_b=Neues Mitglied
--   B_sees_recipes=1 + Anzahl schon vorhandener öffentlicher Rezepte (z. B. 6 mit den 5 Beispielrezepten),
--   B_sees_priv_*=0, B_sees_favorites=0
--   B_updates_A=0, B_deletes_A=0, B_insert_as_A=blocked, B_adds_ingredient_to_A=blocked
--   B_role_change=blocked(42501), B_renames_self=1, B_renames_A=0
--   B_plans_private_A=blocked, B_plans_public_A=ok, B_creates_ingredient=ok
--   A_sees_recipes=2 + vorhandene öffentliche Rezepte, Makros/Tags plausibel
--   Phase 6: B_fork=owner_B,private,forked_from_pub,ingredients=2, B_forks_private_A=blocked,
--   B_unpublishes_A=0, A_sees_B_fork=0, profiles_mail_columns=0, A_unpublishes=1,
--   B_sees_unpublished=0, B_plan_entry_kept=1, B_copy_week_ok=0 (übersprungen, kein Fehler), B_fork_kept=1
--   after_delete_A_*=0 (Cascade), B_plan_entries_on_deleted_public_recipe=0, B_fork_after_delete_A=1 (forked_from=null)

do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  r_priv uuid;
  r_pub uuid;
  r_fork uuid;
  info text;
  out text := '';
  n int;
  t record;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-test-a@example.invalid', '{"display_name":"Test A"}', now(), now()),
         (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-test-b@example.invalid', '{}', now(), now());

  select count(*) into n from public.profiles where id in (a, b);
  out := out || 'profiles_by_trigger=' || n;
  select display_name into t from public.profiles where id = b;
  out := out || ' | default_name_b=' || t.display_name;
  select count(*) into n from public.user_settings where user_id in (a, b);
  out := out || ' | settings_by_trigger=' || n;

  insert into public.recipes (owner_id, title, servings, is_public) values (a, 'Privat A', 2, false) returning id into r_priv;
  insert into public.recipes (owner_id, title, servings, is_public) values (a, 'Öffentlich A', 1, true) returning id into r_pub;
  insert into public.recipe_ingredients (recipe_id, ingredient_id, grams)
    select r_priv, id, 200 from public.ingredients where external_id = 'haehnchenbrust';
  insert into public.recipe_ingredients (recipe_id, ingredient_id, grams)
    select r_pub, id, 300 from public.ingredients where external_id in ('tofu', 'brokkoli');
  insert into public.favorites (user_id, recipe_id) values (a, r_priv);

  -- als Nutzer B
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);

  select count(*) into n from public.recipes; out := out || ' | B_sees_recipes=' || n;
  select count(*) into n from public.recipe_ingredients where recipe_id = r_priv; out := out || ' | B_sees_priv_ingredients=' || n;
  select count(*) into n from public.recipe_nutrition where recipe_id = r_priv; out := out || ' | B_sees_priv_nutrition=' || n;
  select count(*) into n from public.favorites; out := out || ' | B_sees_favorites=' || n;
  update public.recipes set title = 'gehackt' where id = r_pub; get diagnostics n = row_count; out := out || ' | B_updates_A=' || n;
  delete from public.recipes where id = r_pub; get diagnostics n = row_count; out := out || ' | B_deletes_A=' || n;
  begin
    insert into public.recipes (owner_id, title) values (a, 'fremd');
    out := out || ' | B_insert_as_A=ALLOWED';
  exception when others then out := out || ' | B_insert_as_A=blocked';
  end;
  begin
    insert into public.recipe_ingredients (recipe_id, ingredient_id, grams) select r_pub, id, 1 from public.ingredients limit 1;
    out := out || ' | B_adds_ingredient_to_A=ALLOWED';
  exception when others then out := out || ' | B_adds_ingredient_to_A=blocked';
  end;
  begin
    update public.profiles set role = 'admin' where id = b;
    out := out || ' | B_role_change=ALLOWED';
  exception when others then out := out || ' | B_role_change=blocked(' || sqlstate || ')';
  end;
  update public.profiles set display_name = 'Neuer Name B' where id = b; get diagnostics n = row_count; out := out || ' | B_renames_self=' || n;
  update public.profiles set display_name = 'x' where id = a; get diagnostics n = row_count; out := out || ' | B_renames_A=' || n;
  begin
    insert into public.meal_plan_entries (date, slot, recipe_id) values (current_date, 'lunch', r_priv);
    out := out || ' | B_plans_private_A=ALLOWED';
  exception when others then out := out || ' | B_plans_private_A=blocked';
  end;
  insert into public.meal_plan_entries (date, slot, recipe_id) values (current_date, 'lunch', r_pub);
  out := out || ' | B_plans_public_A=ok';
  begin
    insert into public.ingredients (name, kcal) values ('Testzutat B', 10);
    out := out || ' | B_creates_ingredient=ok';
  exception when others then out := out || ' | B_creates_ingredient=FAILED(' || sqlerrm || ')';
  end;

  -- als Nutzer A
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.recipes; out := out || ' | A_sees_recipes=' || n;
  for t in select r.title, n2.kcal_per_serving, n2.protein_per_serving, n2.is_high_protein, n2.is_low_carb, n2.is_vegetarian, n2.is_vegan, n2.grams_by_food_group
           from public.recipes r join public.recipe_nutrition n2 on n2.recipe_id = r.id order by r.title loop
    out := out || ' | ' || t.title || ': kcal=' || t.kcal_per_serving || ' P=' || t.protein_per_serving || ' HP=' || t.is_high_protein || ' LC=' || t.is_low_carb || ' veg=' || t.is_vegetarian || ' vegan=' || t.is_vegan || ' groups=' || t.grams_by_food_group;
  end loop;

  -- Phase 6: Community (übernehmen, veröffentlichen, wieder privat machen)
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  r_fork := public.duplicate_recipe(r_pub);
  select case when owner_id = b then 'owner_B' else 'owner_FALSCH' end
         || case when is_public then ',PUBLIC' else ',private' end
         || case when forked_from_id = r_pub then ',forked_from_pub' else ',forked_from_FALSCH' end
         || ',ingredients=' || (select count(*) from public.recipe_ingredients where recipe_id = r_fork)
    into info from public.recipes where id = r_fork;
  out := out || ' | B_fork=' || info;
  begin
    perform public.duplicate_recipe(r_priv);
    out := out || ' | B_forks_private_A=ALLOWED';
  exception when others then out := out || ' | B_forks_private_A=blocked';
  end;
  update public.recipes set is_public = false where id = r_pub; get diagnostics n = row_count; out := out || ' | B_unpublishes_A=' || n;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.recipes where id = r_fork; out := out || ' | A_sees_B_fork=' || n;
  select count(*) into n from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name ilike '%mail%';
  out := out || ' | profiles_mail_columns=' || n;
  update public.recipes set is_public = false where id = r_pub; get diagnostics n = row_count; out := out || ' | A_unpublishes=' || n;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.recipes where id = r_pub; out := out || ' | B_sees_unpublished=' || n;
  select count(*) into n from public.meal_plan_entries where recipe_id = r_pub; out := out || ' | B_plan_entry_kept=' || n;
  begin
    n := public.copy_plan_week(date_trunc('week', current_date)::date, date_trunc('week', current_date)::date + 7, false);
    out := out || ' | B_copy_week_ok=' || n;
  exception when others then out := out || ' | B_copy_week=FAILED(' || sqlerrm || ')';
  end;
  select count(*) into n from public.recipes where id = r_fork; out := out || ' | B_fork_kept=' || n;

  -- Account-Löschung: Cascade
  execute 'reset role';
  delete from auth.users where id = a;
  select count(*) into n from public.recipes where owner_id = a; out := out || ' | after_delete_A_recipes=' || n;
  select count(*) into n from public.favorites where user_id = a; out := out || ' | after_delete_A_favs=' || n;
  select count(*) into n from public.meal_plan_entries where user_id = b; out := out || ' | B_plan_entries_on_deleted_public_recipe=' || n;
  select count(*) into n from public.profiles where id = a; out := out || ' | after_delete_A_profile=' || n;
  select count(*) into n from public.recipes where id = r_fork and forked_from_id is null;
  out := out || ' | B_fork_after_delete_A=' || n;

  raise exception 'TESTERGEBNIS (wird zurückgerollt): %', out;
end;
$$;
