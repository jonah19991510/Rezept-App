-- Sport & Gesundheit, Phase S1 (26.10.2026): Übungsdatenbank und Trainingspläne mit Trainingstagen.
-- Nur additiv: neue Typen, Tabellen und Funktionen; bestehende Tabellen bleiben unverändert.
--   1. exercises: gemeinsame Übungsdatenbank wie ingredients (Grundbestand + eigene Übungen, alle lesen)
--   2. training_plans → training_plan_days → training_plan_exercises (privat bzw. öffentlich wie Rezepte)
--   3. save_training_plan: Plan mit Tagen und Übungen atomar speichern (Tage behalten ihre ID)
--   4. copy_training_plan: Plan kopieren (eigener: duplizieren; öffentlicher: übernehmen, ab Phase S4)
--   5. Grundbestand: 120 gängige Übungen auf Deutsch

create type public.muscle_group as enum (
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'core',
  'quads', 'hamstrings', 'glutes', 'adductors', 'calves', 'full_body', 'cardio'
);
create type public.exercise_equipment as enum (
  'barbell', 'dumbbell', 'ez_bar', 'machine', 'smith_machine', 'cable', 'bodyweight', 'kettlebell', 'band', 'other'
);
-- Wie ein Satz erfasst wird: Gewicht × Wdh., Körpergewicht (Wdh., Zusatzgewicht optional), Zeit, Strecke + Zeit
create type public.exercise_tracking as enum ('weight_reps', 'bodyweight_reps', 'time', 'distance_time');

-- ---------------------------------------------------------------------------
-- Übungen
-- ---------------------------------------------------------------------------
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  muscle_group public.muscle_group not null,
  secondary_muscles public.muscle_group[] not null default '{}',
  equipment public.exercise_equipment not null,
  tracking public.exercise_tracking not null default 'weight_reps',
  -- null = Grundbestand; eigene Übungen bleiben nach dem Löschen des Accounts erhalten (wie Zutaten)
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index exercises_seed_name_idx on public.exercises (lower(name)) where created_by is null;
create unique index exercises_own_name_idx on public.exercises (created_by, lower(name)) where created_by is not null;
create index exercises_created_by_idx on public.exercises (created_by);

alter table public.exercises enable row level security;
create policy "exercises_select_authenticated" on public.exercises
  for select to authenticated using (true);
create policy "exercises_insert_own" on public.exercises
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "exercises_update_own" on public.exercises
  for update to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));
create policy "exercises_delete_own" on public.exercises
  for delete to authenticated using (created_by = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Trainingspläne
-- ---------------------------------------------------------------------------
create table public.training_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  description text check (description is null or char_length(description) <= 1000),
  is_public boolean not null default false,
  -- „ausgeblendet“: nicht genutzte Pläne, unten in der Liste zugeklappt
  is_archived boolean not null default false,
  forked_from_id uuid references public.training_plans (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index training_plans_owner_id_idx on public.training_plans (owner_id);
create index training_plans_public_idx on public.training_plans (is_public) where is_public;
create index training_plans_forked_from_idx on public.training_plans (forked_from_id);
create trigger training_plans_set_updated_at
  before update on public.training_plans
  for each row execute function private.set_updated_at();

create table public.training_plan_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.training_plans (id) on delete cascade,
  position integer not null check (position >= 0),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  focus text check (focus is null or char_length(focus) <= 60)
);
create index training_plan_days_plan_id_idx on public.training_plan_days (plan_id, position);

create table public.training_plan_exercises (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.training_plan_days (id) on delete cascade,
  -- Übungen in Plänen lassen sich nicht löschen
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position integer not null check (position >= 0),
  sets integer not null default 3 check (sets between 1 and 20),
  reps_min integer check (reps_min is null or reps_min between 1 and 100),
  reps_max integer check (reps_max is null or reps_max between 1 and 100),
  target_seconds integer check (target_seconds is null or target_seconds between 1 and 36000),
  rest_seconds integer check (rest_seconds is null or rest_seconds between 0 and 900),
  warmup boolean not null default false,
  note text check (note is null or char_length(note) <= 200),
  check (reps_min is null or reps_max is null or reps_max >= reps_min)
);
create index training_plan_exercises_day_id_idx on public.training_plan_exercises (day_id, position);
create index training_plan_exercises_exercise_id_idx on public.training_plan_exercises (exercise_id);

-- Rechte-Hilfen wie bei Rezepten (security definer, damit Policies der Kindtabellen nicht erneut RLS auswerten)
create or replace function private.owns_training_plan(p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.training_plans where id = p_plan_id and owner_id = (select auth.uid()));
$$;

create or replace function private.can_read_training_plan(p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.training_plans
    where id = p_plan_id and (owner_id = (select auth.uid()) or is_public)
  );
$$;

create or replace function private.training_day_plan(p_day_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select plan_id from public.training_plan_days where id = p_day_id;
$$;

revoke all on function private.owns_training_plan(uuid) from public, anon;
revoke all on function private.can_read_training_plan(uuid) from public, anon;
revoke all on function private.training_day_plan(uuid) from public, anon;
grant execute on function private.owns_training_plan(uuid) to authenticated;
grant execute on function private.can_read_training_plan(uuid) to authenticated;
grant execute on function private.training_day_plan(uuid) to authenticated;

alter table public.training_plans enable row level security;
alter table public.training_plan_days enable row level security;
alter table public.training_plan_exercises enable row level security;

create policy "training_plans_select_own_or_public" on public.training_plans
  for select to authenticated using (owner_id = (select auth.uid()) or is_public);
create policy "training_plans_insert_own" on public.training_plans
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "training_plans_update_own" on public.training_plans
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "training_plans_delete_own" on public.training_plans
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "training_plan_days_select" on public.training_plan_days
  for select to authenticated using ((select private.can_read_training_plan(plan_id)));
create policy "training_plan_days_write" on public.training_plan_days
  for all to authenticated
  using ((select private.owns_training_plan(plan_id)))
  with check ((select private.owns_training_plan(plan_id)));

create policy "training_plan_exercises_select" on public.training_plan_exercises
  for select to authenticated using ((select private.can_read_training_plan(private.training_day_plan(day_id))));
create policy "training_plan_exercises_write" on public.training_plan_exercises
  for all to authenticated
  using ((select private.owns_training_plan(private.training_day_plan(day_id))))
  with check ((select private.owns_training_plan(private.training_day_plan(day_id))));

revoke all on public.exercises, public.training_plans, public.training_plan_days, public.training_plan_exercises from anon;
grant select, insert, update, delete on public.exercises, public.training_plans, public.training_plan_days,
  public.training_plan_exercises to authenticated;

-- ---------------------------------------------------------------------------
-- Plan speichern: p_plan {id?, title, description}, p_days [{id?, name, focus, exercises: [{exercise_id, sets, …}]}]
-- Tage mit ID werden aktualisiert (spätere Trainings verweisen darauf), fehlende gelöscht, neue angelegt.
-- Die Übungen eines Tages werden ersetzt.
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
    insert into public.training_plans (title, description)
    values (btrim(p_plan ->> 'title'), nullif(btrim(coalesce(p_plan ->> 'description', '')), ''))
    returning id into v_id;
  else
    update public.training_plans
      set title = btrim(p_plan ->> 'title'),
          description = nullif(btrim(coalesce(p_plan ->> 'description', '')), '')
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
-- Plan kopieren (lesbar = eigener oder öffentlicher). Eigene Kopien privat; fremde merken sich das Original.
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

  insert into public.training_plans (title, description, forked_from_id)
  values (
    left(coalesce(nullif(btrim(p_title), ''), v_source.title), 100),
    v_source.description,
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

-- ---------------------------------------------------------------------------
-- Grundbestand an Übungen
-- ---------------------------------------------------------------------------
insert into public.exercises (name, muscle_group, secondary_muscles, equipment, tracking, created_by)
select v.name, v.muscle::public.muscle_group, v.secondary::public.muscle_group[], v.equipment::public.exercise_equipment,
  v.tracking::public.exercise_tracking, null
from (values
  -- Brust
  ('Bankdrücken (Langhantel)', 'chest', '{triceps,shoulders}', 'barbell', 'weight_reps'),
  ('Schrägbankdrücken (Langhantel)', 'chest', '{shoulders,triceps}', 'barbell', 'weight_reps'),
  ('Negativbankdrücken (Langhantel)', 'chest', '{triceps}', 'barbell', 'weight_reps'),
  ('Bankdrücken (Kurzhantel)', 'chest', '{triceps,shoulders}', 'dumbbell', 'weight_reps'),
  ('Schrägbankdrücken (Kurzhantel)', 'chest', '{shoulders,triceps}', 'dumbbell', 'weight_reps'),
  ('Bankdrücken (Smith-Maschine)', 'chest', '{triceps,shoulders}', 'smith_machine', 'weight_reps'),
  ('Brustpresse (Maschine)', 'chest', '{triceps,shoulders}', 'machine', 'weight_reps'),
  ('Schrägbankpresse (Maschine)', 'chest', '{shoulders,triceps}', 'machine', 'weight_reps'),
  ('Fliegende (Kurzhantel)', 'chest', '{}', 'dumbbell', 'weight_reps'),
  ('Schrägbank-Fliegende (Kurzhantel)', 'chest', '{shoulders}', 'dumbbell', 'weight_reps'),
  ('Butterfly (Maschine)', 'chest', '{}', 'machine', 'weight_reps'),
  ('Cable Crossover', 'chest', '{shoulders}', 'cable', 'weight_reps'),
  ('Cable Fly von unten', 'chest', '{shoulders}', 'cable', 'weight_reps'),
  ('Liegestütz', 'chest', '{triceps,shoulders,core}', 'bodyweight', 'bodyweight_reps'),
  ('Dips (Brust)', 'chest', '{triceps,shoulders}', 'bodyweight', 'bodyweight_reps'),
  -- Rücken
  ('Klimmzug', 'back', '{biceps,forearms}', 'bodyweight', 'bodyweight_reps'),
  ('Klimmzug im Untergriff (Chin-up)', 'back', '{biceps}', 'bodyweight', 'bodyweight_reps'),
  ('Klimmzug (Maschine, unterstützt)', 'back', '{biceps}', 'machine', 'weight_reps'),
  ('Latzug (breit)', 'back', '{biceps}', 'cable', 'weight_reps'),
  ('Latzug (eng)', 'back', '{biceps}', 'cable', 'weight_reps'),
  ('Latzug im Untergriff', 'back', '{biceps}', 'cable', 'weight_reps'),
  ('Latzug (Maschine)', 'back', '{biceps}', 'machine', 'weight_reps'),
  ('Langhantelrudern', 'back', '{biceps,forearms}', 'barbell', 'weight_reps'),
  ('Kurzhantelrudern (einarmig)', 'back', '{biceps}', 'dumbbell', 'weight_reps'),
  ('Brustgestütztes Rudern (Kurzhantel)', 'back', '{biceps}', 'dumbbell', 'weight_reps'),
  ('Kabelrudern (sitzend)', 'back', '{biceps}', 'cable', 'weight_reps'),
  ('Rudern (Maschine)', 'back', '{biceps}', 'machine', 'weight_reps'),
  ('T-Bar-Rudern', 'back', '{biceps}', 'barbell', 'weight_reps'),
  ('Überzüge am Kabel (Straight-Arm Pulldown)', 'back', '{}', 'cable', 'weight_reps'),
  ('Umgekehrtes Rudern (Inverted Row)', 'back', '{biceps}', 'bodyweight', 'bodyweight_reps'),
  ('Kreuzheben', 'back', '{hamstrings,glutes,forearms}', 'barbell', 'weight_reps'),
  ('Rack Pulls', 'back', '{glutes,forearms}', 'barbell', 'weight_reps'),
  ('Rückenstrecker (Hyperextension)', 'back', '{glutes,hamstrings}', 'bodyweight', 'bodyweight_reps'),
  ('Shrugs (Kurzhantel)', 'back', '{forearms}', 'dumbbell', 'weight_reps'),
  ('Shrugs (Langhantel)', 'back', '{forearms}', 'barbell', 'weight_reps'),
  -- Schultern
  ('Schulterdrücken (Langhantel, stehend)', 'shoulders', '{triceps,core}', 'barbell', 'weight_reps'),
  ('Schulterdrücken (Kurzhantel)', 'shoulders', '{triceps}', 'dumbbell', 'weight_reps'),
  ('Schulterdrücken (Maschine)', 'shoulders', '{triceps}', 'machine', 'weight_reps'),
  ('Schulterdrücken (Smith-Maschine)', 'shoulders', '{triceps}', 'smith_machine', 'weight_reps'),
  ('Arnold Press', 'shoulders', '{triceps}', 'dumbbell', 'weight_reps'),
  ('Seitheben (Kurzhantel)', 'shoulders', '{}', 'dumbbell', 'weight_reps'),
  ('Seitheben (Kabel)', 'shoulders', '{}', 'cable', 'weight_reps'),
  ('Seitheben (Maschine)', 'shoulders', '{}', 'machine', 'weight_reps'),
  ('Frontheben (Kurzhantel)', 'shoulders', '{}', 'dumbbell', 'weight_reps'),
  ('Vorgebeugtes Seitheben (Kurzhantel)', 'shoulders', '{back}', 'dumbbell', 'weight_reps'),
  ('Reverse Butterfly (Maschine)', 'shoulders', '{back}', 'machine', 'weight_reps'),
  ('Face Pulls', 'shoulders', '{back}', 'cable', 'weight_reps'),
  ('Aufrechtes Rudern (Langhantel)', 'shoulders', '{back}', 'barbell', 'weight_reps'),
  -- Bizeps
  ('Langhantelcurls', 'biceps', '{forearms}', 'barbell', 'weight_reps'),
  ('SZ-Curls', 'biceps', '{forearms}', 'ez_bar', 'weight_reps'),
  ('Kurzhantelcurls', 'biceps', '{forearms}', 'dumbbell', 'weight_reps'),
  ('Hammercurls', 'biceps', '{forearms}', 'dumbbell', 'weight_reps'),
  ('Schrägbankcurls (Kurzhantel)', 'biceps', '{}', 'dumbbell', 'weight_reps'),
  ('Konzentrationscurls', 'biceps', '{}', 'dumbbell', 'weight_reps'),
  ('Scottcurls (SZ-Stange)', 'biceps', '{}', 'ez_bar', 'weight_reps'),
  ('Bizepscurls (Maschine)', 'biceps', '{}', 'machine', 'weight_reps'),
  ('Kabelcurls', 'biceps', '{forearms}', 'cable', 'weight_reps'),
  -- Trizeps
  ('Trizepsdrücken am Kabel (Seil)', 'triceps', '{}', 'cable', 'weight_reps'),
  ('Trizepsdrücken am Kabel (Stange)', 'triceps', '{}', 'cable', 'weight_reps'),
  ('Überkopf-Trizepsdrücken (Kabel)', 'triceps', '{}', 'cable', 'weight_reps'),
  ('Überkopf-Trizepsdrücken (Kurzhantel)', 'triceps', '{}', 'dumbbell', 'weight_reps'),
  ('French Press (SZ-Stange)', 'triceps', '{}', 'ez_bar', 'weight_reps'),
  ('Enges Bankdrücken', 'triceps', '{chest,shoulders}', 'barbell', 'weight_reps'),
  ('Dips (Trizeps)', 'triceps', '{chest,shoulders}', 'bodyweight', 'bodyweight_reps'),
  ('Dips (Maschine)', 'triceps', '{chest}', 'machine', 'weight_reps'),
  ('Trizeps-Kickbacks (Kurzhantel)', 'triceps', '{}', 'dumbbell', 'weight_reps'),
  -- Unterarme
  ('Handgelenkcurls (Langhantel)', 'forearms', '{}', 'barbell', 'weight_reps'),
  ('Reverse Curls (SZ-Stange)', 'forearms', '{biceps}', 'ez_bar', 'weight_reps'),
  ('Farmer''s Walk', 'forearms', '{back,core}', 'dumbbell', 'time'),
  -- Bauch/Core
  ('Crunches', 'core', '{}', 'bodyweight', 'bodyweight_reps'),
  ('Kabelcrunch', 'core', '{}', 'cable', 'weight_reps'),
  ('Bauchmaschine (Crunch)', 'core', '{}', 'machine', 'weight_reps'),
  ('Beinheben hängend', 'core', '{forearms}', 'bodyweight', 'bodyweight_reps'),
  ('Beinheben liegend', 'core', '{}', 'bodyweight', 'bodyweight_reps'),
  ('Russian Twist', 'core', '{}', 'bodyweight', 'bodyweight_reps'),
  ('Ab Wheel Rollout', 'core', '{shoulders}', 'other', 'bodyweight_reps'),
  ('Dead Bug', 'core', '{}', 'bodyweight', 'bodyweight_reps'),
  ('Pallof Press', 'core', '{}', 'cable', 'weight_reps'),
  ('Plank (Unterarmstütz)', 'core', '{shoulders}', 'bodyweight', 'time'),
  ('Seitstütz', 'core', '{}', 'bodyweight', 'time'),
  ('Mountain Climbers', 'core', '{shoulders,cardio}', 'bodyweight', 'time'),
  -- Beine: Quadrizeps
  ('Kniebeuge (Langhantel)', 'quads', '{glutes,hamstrings,core}', 'barbell', 'weight_reps'),
  ('Frontkniebeuge', 'quads', '{glutes,core}', 'barbell', 'weight_reps'),
  ('Kniebeuge (Smith-Maschine)', 'quads', '{glutes}', 'smith_machine', 'weight_reps'),
  ('Kniebeuge (Körpergewicht)', 'quads', '{glutes}', 'bodyweight', 'bodyweight_reps'),
  ('Goblet Squat', 'quads', '{glutes,core}', 'dumbbell', 'weight_reps'),
  ('Hackenschmidt-Kniebeuge', 'quads', '{glutes}', 'machine', 'weight_reps'),
  ('Beinpresse', 'quads', '{glutes,hamstrings}', 'machine', 'weight_reps'),
  ('Beinstrecker (Maschine)', 'quads', '{}', 'machine', 'weight_reps'),
  ('Ausfallschritte (Kurzhantel)', 'quads', '{glutes,hamstrings}', 'dumbbell', 'weight_reps'),
  ('Bulgarian Split Squat', 'quads', '{glutes}', 'dumbbell', 'weight_reps'),
  ('Step-ups (Kurzhantel)', 'quads', '{glutes}', 'dumbbell', 'weight_reps'),
  -- Beine: Beinbeuger
  ('Rumänisches Kreuzheben (Langhantel)', 'hamstrings', '{glutes,back}', 'barbell', 'weight_reps'),
  ('Rumänisches Kreuzheben (Kurzhantel)', 'hamstrings', '{glutes,back}', 'dumbbell', 'weight_reps'),
  ('Beinbeuger liegend (Maschine)', 'hamstrings', '{calves}', 'machine', 'weight_reps'),
  ('Beinbeuger sitzend (Maschine)', 'hamstrings', '{}', 'machine', 'weight_reps'),
  ('Nordic Curls', 'hamstrings', '{}', 'bodyweight', 'bodyweight_reps'),
  ('Good Mornings', 'hamstrings', '{back,glutes}', 'barbell', 'weight_reps'),
  -- Gesäß und Adduktoren
  ('Hip Thrust (Langhantel)', 'glutes', '{hamstrings}', 'barbell', 'weight_reps'),
  ('Hip Thrust (Maschine)', 'glutes', '{hamstrings}', 'machine', 'weight_reps'),
  ('Glute Bridge', 'glutes', '{hamstrings}', 'bodyweight', 'bodyweight_reps'),
  ('Kickbacks am Kabel', 'glutes', '{hamstrings}', 'cable', 'weight_reps'),
  ('Abduktoren (Maschine)', 'glutes', '{}', 'machine', 'weight_reps'),
  ('Adduktoren (Maschine)', 'adductors', '{}', 'machine', 'weight_reps'),
  -- Waden
  ('Wadenheben stehend (Maschine)', 'calves', '{}', 'machine', 'weight_reps'),
  ('Wadenheben sitzend (Maschine)', 'calves', '{}', 'machine', 'weight_reps'),
  ('Wadenheben an der Beinpresse', 'calves', '{}', 'machine', 'weight_reps'),
  ('Wadenheben einbeinig (Kurzhantel)', 'calves', '{}', 'dumbbell', 'weight_reps'),
  -- Ganzkörper
  ('Kettlebell Swing', 'full_body', '{glutes,hamstrings,back}', 'kettlebell', 'weight_reps'),
  ('Thruster (Langhantel)', 'full_body', '{quads,shoulders}', 'barbell', 'weight_reps'),
  ('Umsetzen (Power Clean)', 'full_body', '{back,quads,glutes}', 'barbell', 'weight_reps'),
  ('Burpees', 'full_body', '{chest,quads,cardio}', 'bodyweight', 'bodyweight_reps'),
  -- Ausdauer
  ('Laufband', 'cardio', '{}', 'machine', 'distance_time'),
  ('Laufen (draußen)', 'cardio', '{}', 'other', 'distance_time'),
  ('Fahrrad-Ergometer', 'cardio', '{}', 'machine', 'distance_time'),
  ('Rudergerät', 'cardio', '{back}', 'machine', 'distance_time'),
  ('Crosstrainer', 'cardio', '{}', 'machine', 'time'),
  ('Stepper', 'cardio', '{glutes}', 'machine', 'time'),
  ('Seilspringen', 'cardio', '{calves}', 'other', 'time'),
  ('Schwimmen', 'cardio', '{}', 'other', 'distance_time')
) as v(name, muscle, secondary, equipment, tracking);
