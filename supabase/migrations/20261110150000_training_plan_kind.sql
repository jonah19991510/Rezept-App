-- Sport & Gesundheit (10.11.2026): Trainingspläne bekommen eine Art (Krafttraining, Kraftausdauer, Ausdauer), nach
-- der die Planliste in Abschnitte gegliedert ist. Additiv: neue Spalte mit Standard „Krafttraining“, die laufende App
-- liest sie nicht. Bestehende Pläne, deren Übungen überwiegend zur Muskelgruppe „Ausdauer“ gehören (Laufband, Laufen …),
-- werden einmalig als Ausdauer eingetragen. save_training_plan und copy_training_plan übernehmen die Art; ohne Angabe
-- (alte App) bleibt sie beim Speichern unverändert.

create type public.training_plan_kind as enum ('strength', 'strength_endurance', 'cardio');

alter table public.training_plans
  add column kind public.training_plan_kind not null default 'strength';

-- Vorbelegung ohne „zuletzt geändert“ anzufassen (die Planliste ist danach sortiert)
alter table public.training_plans disable trigger training_plans_set_updated_at;
update public.training_plans p
set kind = 'cardio'
where (
  select count(*) filter (where e.muscle_group = 'cardio') * 2 > count(*) and count(*) > 0
  from public.training_plan_days d
  join public.training_plan_exercises x on x.day_id = d.id
  join public.exercises e on e.id = x.exercise_id
  where d.plan_id = p.id
);
alter table public.training_plans enable trigger training_plans_set_updated_at;

-- ---------------------------------------------------------------------------
-- Plan speichern: wie bisher, dazu die Art aus p_plan ->> 'kind' (fehlt sie, Standard bzw. unverändert)
-- ---------------------------------------------------------------------------
create or replace function public.save_training_plan(p_plan jsonb, p_days jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_plan ->> 'id', '')::uuid;
  v_day jsonb;
  v_day_id uuid;
  v_keep uuid[] := '{}';
  v_pos integer := 0;
begin
  if jsonb_typeof(p_days) <> 'array' or jsonb_array_length(p_days) = 0 then
    raise exception 'Ein Plan braucht mindestens einen Trainingstag.' using errcode = '22023';
  end if;

  if v_id is null then
    insert into public.training_plans (title, description, kind)
    values (
      btrim(p_plan ->> 'title'),
      nullif(btrim(coalesce(p_plan ->> 'description', '')), ''),
      coalesce(nullif(p_plan ->> 'kind', '')::public.training_plan_kind, 'strength')
    )
    returning id into v_id;
  else
    update public.training_plans
      set title = btrim(p_plan ->> 'title'),
          description = nullif(btrim(coalesce(p_plan ->> 'description', '')), ''),
          kind = coalesce(nullif(p_plan ->> 'kind', '')::public.training_plan_kind, kind)
      where id = v_id and owner_id = (select auth.uid());
    if not found then
      raise exception 'Plan nicht gefunden oder nicht deiner.' using errcode = 'P0002';
    end if;
  end if;

  -- IDs der Tage, die bleiben (nur solche, die wirklich zu diesem Plan gehören)
  select coalesce(array_agg(d.id), '{}') into v_keep
  from public.training_plan_days d
  where d.plan_id = v_id
    and d.id in (
      select nullif(e ->> 'id', '')::uuid from jsonb_array_elements(p_days) e where nullif(e ->> 'id', '') is not null
    );
  delete from public.training_plan_days where plan_id = v_id and not (id = any (v_keep));

  for v_day in select * from jsonb_array_elements(p_days) loop
    v_day_id := nullif(v_day ->> 'id', '')::uuid;
    if v_day_id is not null and v_day_id = any (v_keep) then
      update public.training_plan_days
        set position = v_pos, name = btrim(v_day ->> 'name'), focus = nullif(btrim(coalesce(v_day ->> 'focus', '')), '')
        where id = v_day_id;
      delete from public.training_plan_exercises where day_id = v_day_id;
    else
      insert into public.training_plan_days (plan_id, position, name, focus)
      values (v_id, v_pos, btrim(v_day ->> 'name'), nullif(btrim(coalesce(v_day ->> 'focus', '')), ''))
      returning id into v_day_id;
    end if;

    insert into public.training_plan_exercises (
      day_id, exercise_id, position, sets, reps_min, reps_max, target_seconds, rest_seconds, warmup, note
    )
    select
      v_day_id,
      (x.value ->> 'exercise_id')::uuid,
      (x.ordinality - 1)::integer,
      coalesce((x.value ->> 'sets')::integer, 3),
      nullif(x.value ->> 'reps_min', '')::integer,
      nullif(x.value ->> 'reps_max', '')::integer,
      nullif(x.value ->> 'target_seconds', '')::integer,
      nullif(x.value ->> 'rest_seconds', '')::integer,
      coalesce((x.value ->> 'warmup')::boolean, false),
      nullif(btrim(coalesce(x.value ->> 'note', '')), '')
    from jsonb_array_elements(coalesce(v_day -> 'exercises', '[]'::jsonb)) with ordinality as x(value, ordinality);

    v_pos := v_pos + 1;
  end loop;

  -- Änderungen an Tagen/Übungen sollen den Plan als „zuletzt geändert“ markieren
  update public.training_plans set updated_at = now() where id = v_id;
  return v_id;
end;
$$;

revoke all on function public.save_training_plan(jsonb, jsonb) from public, anon;
grant execute on function public.save_training_plan(jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Plan kopieren: wie bisher, die Kopie übernimmt die Art
-- ---------------------------------------------------------------------------
create or replace function public.copy_training_plan(p_plan_id uuid, p_title text default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_source public.training_plans;
  v_new uuid;
  v_day record;
  v_new_day uuid;
begin
  select * into v_source from public.training_plans where id = p_plan_id;
  if not found then
    raise exception 'Plan nicht gefunden.' using errcode = 'P0002';
  end if;

  insert into public.training_plans (title, description, kind, forked_from_id)
  values (
    left(coalesce(nullif(btrim(p_title), ''), v_source.title), 100),
    v_source.description,
    v_source.kind,
    case when v_source.owner_id <> (select auth.uid()) then v_source.id end
  )
  returning id into v_new;

  for v_day in select * from public.training_plan_days where plan_id = p_plan_id order by position loop
    insert into public.training_plan_days (plan_id, position, name, focus)
    values (v_new, v_day.position, v_day.name, v_day.focus)
    returning id into v_new_day;

    insert into public.training_plan_exercises (
      day_id, exercise_id, position, sets, reps_min, reps_max, target_seconds, rest_seconds, warmup, note
    )
    select v_new_day, exercise_id, position, sets, reps_min, reps_max, target_seconds, rest_seconds, warmup, note
    from public.training_plan_exercises where day_id = v_day.id;
  end loop;

  return v_new;
end;
$$;

revoke all on function public.copy_training_plan(uuid, text) from public, anon;
grant execute on function public.copy_training_plan(uuid, text) to authenticated;
