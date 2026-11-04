-- Sport & Gesundheit (04.11.2026): optionale durchschnittliche Herzfrequenz bei Ausdauer-Sätzen.
-- Nur additiv: Spalte avg_heart_rate in workout_sets; sync_workout speichert sie mit. Die laufende App schickt das Feld
-- nicht (bleibt leer). last_exercise_sets bleibt unverändert: Die Herzfrequenz wird nie vom letzten Mal übernommen.

alter table public.workout_sets
  add column avg_heart_rate smallint check (avg_heart_rate is null or avg_heart_rate between 30 and 250);

-- ---------------------------------------------------------------------------
-- Training speichern (wie 20261027170000_workout_set_speed, dazu avg_heart_rate je Satz)
-- ---------------------------------------------------------------------------
create or replace function public.sync_workout(p_workout jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := (p_workout ->> 'id')::uuid;
  v_version integer := coalesce((p_workout ->> 'version')::integer, 0);
  v_stored integer;
  v_plan uuid := nullif(p_workout ->> 'plan_id', '')::uuid;
  v_day uuid := nullif(p_workout ->> 'plan_day_id', '')::uuid;
begin
  -- Plan oder Tag inzwischen gelöscht bzw. nicht lesbar: Verweis weglassen statt Fehler
  if v_plan is not null and not exists (select 1 from public.training_plans where id = v_plan) then
    v_plan := null;
  end if;
  if v_day is not null and not exists (select 1 from public.training_plan_days where id = v_day) then
    v_day := null;
  end if;

  select version into v_stored from public.workouts where id = v_id;
  if found and v_stored >= v_version then
    return v_stored;
  end if;

  if not found then
    insert into public.workouts (id, plan_id, plan_day_id, title, started_at, ended_at, note, version)
    values (
      v_id, v_plan, v_day, btrim(p_workout ->> 'title'), (p_workout ->> 'started_at')::timestamptz,
      nullif(p_workout ->> 'ended_at', '')::timestamptz, nullif(btrim(coalesce(p_workout ->> 'note', '')), ''), v_version
    );
  else
    update public.workouts set
      plan_id = v_plan,
      plan_day_id = v_day,
      title = btrim(p_workout ->> 'title'),
      started_at = (p_workout ->> 'started_at')::timestamptz,
      ended_at = nullif(p_workout ->> 'ended_at', '')::timestamptz,
      note = nullif(btrim(coalesce(p_workout ->> 'note', '')), ''),
      version = v_version
    where id = v_id;
    delete from public.workout_exercises where workout_id = v_id;
  end if;

  insert into public.workout_exercises (id, workout_id, exercise_id, position, reps_min, reps_max, target_seconds, rest_seconds, warmup, note)
  select
    (x.value ->> 'id')::uuid, v_id, (x.value ->> 'exercise_id')::uuid, (x.ordinality - 1)::integer,
    nullif(x.value ->> 'reps_min', '')::integer, nullif(x.value ->> 'reps_max', '')::integer,
    nullif(x.value ->> 'target_seconds', '')::integer, nullif(x.value ->> 'rest_seconds', '')::integer,
    coalesce((x.value ->> 'warmup')::boolean, false), nullif(btrim(coalesce(x.value ->> 'note', '')), '')
  from jsonb_array_elements(coalesce(p_workout -> 'exercises', '[]'::jsonb)) with ordinality as x(value, ordinality);

  insert into public.workout_sets (id, workout_exercise_id, position, kind, weight_kg, reps, seconds, distance_m, speed_kmh, avg_heart_rate, done, done_at)
  select
    (s.value ->> 'id')::uuid, (x.value ->> 'id')::uuid, (s.ordinality - 1)::integer,
    coalesce(nullif(s.value ->> 'kind', ''), 'normal')::public.workout_set_kind,
    nullif(s.value ->> 'weight_kg', '')::numeric, nullif(s.value ->> 'reps', '')::integer,
    nullif(s.value ->> 'seconds', '')::integer, nullif(s.value ->> 'distance_m', '')::numeric,
    nullif(s.value ->> 'speed_kmh', '')::numeric, nullif(s.value ->> 'avg_heart_rate', '')::smallint,
    coalesce((s.value ->> 'done')::boolean, false), nullif(s.value ->> 'done_at', '')::timestamptz
  from jsonb_array_elements(coalesce(p_workout -> 'exercises', '[]'::jsonb)) as x(value),
    jsonb_array_elements(coalesce(x.value -> 'sets', '[]'::jsonb)) with ordinality as s(value, ordinality);

  return v_version;
end;
$$;

revoke all on function public.sync_workout(jsonb) from public, anon;
grant execute on function public.sync_workout(jsonb) to authenticated;
