-- Phase 7: Rezeptfotos in Supabase Storage.
--
-- Bucket „recipe-photos“ ist PRIVAT: Fotos privater Rezepte sind nicht über eine öffentliche URL abrufbar.
-- Die App liefert sie über die eigene Route /foto/… aus, die mit den Rechten des angemeldeten Nutzers lädt.
-- Pfad: <owner-id>/<rezept-id>/<foto-id>.webp (bzw. .jpg) plus Vorschaubild <foto-id>-klein.webp.
-- Die Fotos werden im Browser verkleinert und neu kodiert, dabei fallen EXIF-Daten (z. B. GPS) weg.
--
-- recipes.image_url enthält den Storage-Pfad des großen Fotos (nicht eine URL). Ein Check stellt sicher,
-- dass er im Ordner des Owners und des Rezepts liegt.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-photos', 'recipe-photos', false, 3145728, array['image/webp', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen: Pfad zerlegen ohne Fehler bei ungültigen UUIDs
-- ---------------------------------------------------------------------------
create or replace function private.photo_path_recipe_id(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
    then split_part(p_name, '/', 2)::uuid
  end;
$$;

-- Lesen: Foto gehört zu einem Rezept, das der Nutzer lesen darf (eigenes oder öffentliches),
-- und liegt im Ordner des Owners dieses Rezepts.
create or replace function private.can_read_recipe_photo(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.recipes r
    where r.id = private.photo_path_recipe_id(p_name)
      and r.owner_id::text = split_part(p_name, '/', 1)
      and (r.owner_id = (select auth.uid()) or r.is_public)
  );
$$;

-- Hochladen: nur in den eigenen Ordner und nur zu einem eigenen Rezept.
create or replace function private.can_write_recipe_photo(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select split_part(p_name, '/', 1) = (select auth.uid())::text
     and exists (
       select 1 from public.recipes r
       where r.id = private.photo_path_recipe_id(p_name)
         and r.owner_id = (select auth.uid())
     );
$$;

revoke all on function private.photo_path_recipe_id(text) from public, anon;
revoke all on function private.can_read_recipe_photo(text) from public, anon;
revoke all on function private.can_write_recipe_photo(text) from public, anon;
grant execute on function private.photo_path_recipe_id(text) to authenticated;
grant execute on function private.can_read_recipe_photo(text) to authenticated;
grant execute on function private.can_write_recipe_photo(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage-Policies (nur für diesen Bucket, kein anonymer Zugriff)
-- ---------------------------------------------------------------------------
create policy "recipe_photos_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'recipe-photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select private.can_read_recipe_photo(name))
    )
  );

create policy "recipe_photos_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recipe-photos' and (select private.can_write_recipe_photo(name)));

-- Kein UPDATE (Fotos werden nie überschrieben, sondern neu hochgeladen). Löschen nur im eigenen Ordner.
create policy "recipe_photos_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'recipe-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- recipes.image_url: nur Pfade im Ordner <owner>/<rezept>/
-- ---------------------------------------------------------------------------
alter table public.recipes
  add constraint recipes_image_path_check check (
    image_url is null
    or image_url ~ ('^' || owner_id::text || '/' || id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$')
  );

-- ---------------------------------------------------------------------------
-- duplicate_recipe: Foto-Pfad nicht mehr mitkopieren. Er läge im Ordner des Originals und wäre weg,
-- sobald das Original gelöscht oder (bei fremden Rezepten) privat wird. Die App kopiert die Datei
-- stattdessen in den eigenen Ordner und setzt den neuen Pfad (src/lib/server/photos.ts).
-- ---------------------------------------------------------------------------
create or replace function public.duplicate_recipe(p_recipe_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_src public.recipes%rowtype;
  v_new uuid;
  v_uid uuid := (select auth.uid());
begin
  -- RLS: nur eigene oder öffentliche Rezepte sind hier sichtbar
  select * into v_src from public.recipes where id = p_recipe_id;
  if not found then
    raise exception 'Rezept nicht gefunden.' using errcode = 'P0002';
  end if;

  insert into public.recipes (
    recipe_type, title, description, servings, prep_minutes, cook_minutes, category, tags,
    is_meal_prep, is_public, image_url, source_url, forked_from_id
  ) values (
    v_src.recipe_type,
    case when v_src.owner_id = v_uid then left(v_src.title || ' (Kopie)', 200) else v_src.title end,
    v_src.description, v_src.servings, v_src.prep_minutes, v_src.cook_minutes, v_src.category, v_src.tags,
    v_src.is_meal_prep, false, null, v_src.source_url,
    case when v_src.owner_id = v_uid then null else v_src.id end
  )
  returning id into v_new;

  insert into public.recipe_ingredients (recipe_id, ingredient_id, position, amount, unit, grams, note, step_position)
  select v_new, ingredient_id, position, amount, unit, grams, note, step_position
  from public.recipe_ingredients where recipe_id = p_recipe_id;

  insert into public.recipe_steps (recipe_id, position, text, timer_seconds)
  select v_new, position, text, timer_seconds
  from public.recipe_steps where recipe_id = p_recipe_id;

  insert into public.cocktail_details (recipe_id, glass, method, ice, garnish)
  select v_new, glass, method, ice, garnish
  from public.cocktail_details where recipe_id = p_recipe_id;

  return v_new;
end;
$$;

revoke all on function public.duplicate_recipe(uuid) from public, anon;
grant execute on function public.duplicate_recipe(uuid) to authenticated;
