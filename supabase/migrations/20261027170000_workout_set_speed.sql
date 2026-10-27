-- Sport & Gesundheit (27.10.2026): Geschwindigkeit bei Ausdauer-Sätzen (Laufband, Rad, Rudergerät).
-- Nur additiv: Spalte speed_kmh in workout_sets; sync_workout speichert sie mit, last_exercise_sets liefert sie mit.
-- Die laufende App schickt das Feld nicht (bleibt leer) und ignoriert die zusätzliche Spalte im Ergebnis.

alter table public.workout_sets
  add column speed_kmh numeric(4, 1) check (speed_kmh is null or speed_kmh between 0 and 99.9);

-- ---------------------------------------------------------------------------
-- Training speichern (wie 20261026150000_sport_workouts, dazu speed_kmh je Satz)
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

  insert into public.workout_sets (id, workout_exercise_id, position, kind, weight_kg, reps, seconds, distance_m, speed_kmh, done, done_at)
  select
    (s.value ->> 'id')::uuid, (x.value ->> 'id')::uuid, (s.ordinality - 1)::integer,
    coalesce(nullif(s.value ->> 'kind', ''), 'normal')::public.workout_set_kind,
    nullif(s.value ->> 'weight_kg', '')::numeric, nullif(s.value ->> 'reps', '')::integer,
    nullif(s.value ->> 'seconds', '')::integer, nullif(s.value ->> 'distance_m', '')::numeric,
    nullif(s.value ->> 'speed_kmh', '')::numeric,
    coalesce((s.value ->> 'done')::boolean, false), nullif(s.value ->> 'done_at', '')::timestamptz
  from jsonb_array_elements(coalesce(p_workout -> 'exercises', '[]'::jsonb)) as x(value),
    jsonb_array_elements(coalesce(x.value -> 'sets', '[]'::jsonb)) with ordinality as s(value, ordinality);

  return v_version;
end;
$$;

revoke all on function public.sync_workout(jsonb) from public, anon;
grant execute on function public.sync_workout(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Sätze vom letzten Mal, jetzt mit speed_kmh (andere Rückgabe → neu anlegen)
-- ---------------------------------------------------------------------------
drop function public.last_exercise_sets(uuid[], uuid);

create function public.last_exercise_sets(p_exercise_ids uuid[], p_exclude uuid default null)
returns table (
  exercise_id uuid,
  started_at timestamptz,
  set_index integer,
  weight_kg numeric,
  reps integer,
  seconds integer,
  distance_m numeric,
  speed_kmh numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with latest as (
    select distinct on (we.exercise_id) we.exercise_id, we.id as we_id, w.started_at
    from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where w.user_id = (select auth.uid())
      and w.ended_at is not null
      and (p_exclude is null or w.id <> p_exclude)
      and we.exercise_id = any (p_exercise_ids)
      and exists (select 1 from public.workout_sets s where s.workout_exercise_id = we.id and s.done and s.kind = 'normal')
    order by we.exercise_id, w.started_at desc
  )
  select l.exercise_id, l.started_at,
    (row_number() over (partition by l.exercise_id order by s.position) - 1)::integer,
    s.weight_kg, s.reps, s.seconds, s.distance_m, s.speed_kmh
  from latest l
  join public.workout_sets s on s.workout_exercise_id = l.we_id
  where s.done and s.kind = 'normal'
  order by l.exercise_id, s.position;
$$;

revoke all on function public.last_exercise_sets(uuid[], uuid) from public, anon;
grant execute on function public.last_exercise_sets(uuid[], uuid) to authenticated;
