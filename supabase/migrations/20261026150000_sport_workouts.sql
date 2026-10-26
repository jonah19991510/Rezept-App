-- Sport & Gesundheit, Phase S2 (26.10.2026): Trainings im Gym.
-- Nur additiv: neuer Typ, drei Tabellen, Funktionen.
--   1. workouts → workout_exercises → workout_sets (nur der eigene Nutzer)
--   2. sync_workout: das ganze Training als Stand vom Handy speichern (Training läuft offline weiter; das Handy schickt
--      seinen letzten Stand, sobald Netz da ist; ältere Stände als der gespeicherte werden ignoriert)
--   3. last_exercise_sets: die Sätze vom letzten Mal je Übung (hell im Training)
-- IDs von Trainings, Übungen und Sätzen erzeugt das Handy (offline), deshalb ohne Standardwert-Zwang.

create type public.workout_set_kind as enum ('warmup', 'normal');

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  plan_id uuid references public.training_plans (id) on delete set null,
  plan_day_id uuid references public.training_plan_days (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  started_at timestamptz not null,
  -- null = läuft noch
  ended_at timestamptz check (ended_at is null or ended_at >= started_at),
  note text check (note is null or char_length(note) <= 1000),
  -- Stand-Zähler des Handys: nur neuere Stände überschreiben
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workouts_user_started_idx on public.workouts (user_id, started_at desc);
create index workouts_plan_id_idx on public.workouts (plan_id);
create index workouts_plan_day_id_idx on public.workouts (plan_day_id);
-- Höchstens ein laufendes Training je Nutzer
create unique index workouts_one_active_idx on public.workouts (user_id) where ended_at is null;
create trigger workouts_set_updated_at
  before update on public.workouts
  for each row execute function private.set_updated_at();

create table public.workout_exercises (
  id uuid primary key,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position integer not null check (position >= 0),
  -- Vorgaben aus dem Plan (bzw. Standard bei neu hinzugefügten Übungen), zum Anzeigen
  reps_min integer check (reps_min is null or reps_min between 1 and 100),
  reps_max integer check (reps_max is null or reps_max between 1 and 100),
  target_seconds integer check (target_seconds is null or target_seconds between 1 and 36000),
  rest_seconds integer check (rest_seconds is null or rest_seconds between 0 and 900),
  warmup boolean not null default false,
  note text check (note is null or char_length(note) <= 200)
);
create index workout_exercises_workout_idx on public.workout_exercises (workout_id, position);
create index workout_exercises_exercise_idx on public.workout_exercises (exercise_id);

create table public.workout_sets (
  id uuid primary key,
  workout_exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  position integer not null check (position >= 0),
  kind public.workout_set_kind not null default 'normal',
  weight_kg numeric(6, 2) check (weight_kg is null or weight_kg between 0 and 1000),
  reps integer check (reps is null or reps between 0 and 1000),
  seconds integer check (seconds is null or seconds between 0 and 86400),
  distance_m numeric(9, 1) check (distance_m is null or distance_m between 0 and 1000000),
  done boolean not null default false,
  done_at timestamptz
);
create index workout_sets_exercise_idx on public.workout_sets (workout_exercise_id, position);

create or replace function private.owns_workout(p_workout_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.workouts where id = p_workout_id and user_id = (select auth.uid()));
$$;

create or replace function private.workout_of_exercise(p_workout_exercise_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select workout_id from public.workout_exercises where id = p_workout_exercise_id;
$$;

revoke all on function private.owns_workout(uuid) from public, anon;
revoke all on function private.workout_of_exercise(uuid) from public, anon;
grant execute on function private.owns_workout(uuid) to authenticated;
grant execute on function private.workout_of_exercise(uuid) to authenticated;

alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets enable row level security;

create policy "workouts_own" on public.workouts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "workout_exercises_own" on public.workout_exercises
  for all to authenticated
  using ((select private.owns_workout(workout_id)))
  with check ((select private.owns_workout(workout_id)));
create policy "workout_sets_own" on public.workout_sets
  for all to authenticated
  using ((select private.owns_workout(private.workout_of_exercise(workout_exercise_id))))
  with check ((select private.owns_workout(private.workout_of_exercise(workout_exercise_id))));

revoke all on public.workouts, public.workout_exercises, public.workout_sets from anon;
grant select, insert, update, delete on public.workouts, public.workout_exercises, public.workout_sets to authenticated;

-- ---------------------------------------------------------------------------
-- Training speichern: p_workout {id, plan_id, plan_day_id, title, started_at, ended_at, note, version,
--   exercises: [{id, exercise_id, reps_min, reps_max, target_seconds, rest_seconds, warmup, note,
--   sets: [{id, kind, weight_kg, reps, seconds, distance_m, done, done_at}]}]}
-- Gibt die gespeicherte Version zurück. Ist der gespeicherte Stand neuer, bleibt er (Rückgabe: seine Version).
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

  insert into public.workout_sets (id, workout_exercise_id, position, kind, weight_kg, reps, seconds, distance_m, done, done_at)
  select
    (s.value ->> 'id')::uuid, (x.value ->> 'id')::uuid, (s.ordinality - 1)::integer,
    coalesce(nullif(s.value ->> 'kind', ''), 'normal')::public.workout_set_kind,
    nullif(s.value ->> 'weight_kg', '')::numeric, nullif(s.value ->> 'reps', '')::integer,
    nullif(s.value ->> 'seconds', '')::integer, nullif(s.value ->> 'distance_m', '')::numeric,
    coalesce((s.value ->> 'done')::boolean, false), nullif(s.value ->> 'done_at', '')::timestamptz
  from jsonb_array_elements(coalesce(p_workout -> 'exercises', '[]'::jsonb)) as x(value),
    jsonb_array_elements(coalesce(x.value -> 'sets', '[]'::jsonb)) with ordinality as s(value, ordinality);

  return v_version;
end;
$$;

revoke all on function public.sync_workout(jsonb) from public, anon;
grant execute on function public.sync_workout(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Sätze vom letzten Mal: je Übung das letzte beendete Training (ohne p_exclude), nur erledigte Arbeitssätze
-- ---------------------------------------------------------------------------
create or replace function public.last_exercise_sets(p_exercise_ids uuid[], p_exclude uuid default null)
returns table (
  exercise_id uuid,
  started_at timestamptz,
  set_index integer,
  weight_kg numeric,
  reps integer,
  seconds integer,
  distance_m numeric
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
    s.weight_kg, s.reps, s.seconds, s.distance_m
  from latest l
  join public.workout_sets s on s.workout_exercise_id = l.we_id
  where s.done and s.kind = 'normal'
  order by l.exercise_id, s.position;
$$;

revoke all on function public.last_exercise_sets(uuid[], uuid) from public, anon;
grant execute on function public.last_exercise_sets(uuid[], uuid) to authenticated;
