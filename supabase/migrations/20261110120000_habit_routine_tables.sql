-- Sport & Gesundheit (10.11.2026): eigene Routinen im Habit Tracker, ein Habit in mehreren Routinen; Wochenplan
-- sortierbar, Tageszeit optional.
-- Rein additiv: drei neue Tabellen, eine neue Spalte, eine NOT-NULL-Bedingung gelockert. Die bisherige Spalte
-- habits.routine bleibt stehen (die laufende Version liest sie noch), die neue Version liest sie nicht mehr.
--   1. habit_routines: Routinen eines Nutzers (Name, Platz unter „Heute“ als Tageszeit, Farbe, Reihenfolge)
--   2. habit_routine_items: welche Habits in welcher Routine stehen, mit Reihenfolge innerhalb der Routine
--   3. habit_routine_checks: in welcher Routine ein Habit an einem Tag abgehakt wurde. Die Zahl des Tages steht wie
--      bisher in habit_checks (ein Habit in zwei Routinen: Tagesziel 2, je Routine ein Häkchen).
--   4. training_schedule: Spalte position (Reihenfolge innerhalb eines Tages), daytime darf leer sein

create table public.habit_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  -- Platz unter „Heute“
  daytime text not null check (daytime in ('morgens', 'mittags', 'nachmittags', 'abends', 'nachts')),
  -- Farbschlüssel aus der Palette der App (wie bei Habits)
  color text not null check (color ~ '^[a-z]{2,16}$'),
  position integer not null default 0,
  -- übernommen aus habits.routine ('morgen' / 'abend'); neue Routinen: null
  legacy_key text check (legacy_key is null or legacy_key in ('morgen', 'abend')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index habit_routines_user_position_idx on public.habit_routines (user_id, position);
create unique index habit_routines_user_legacy_idx on public.habit_routines (user_id, legacy_key) where legacy_key is not null;
create trigger habit_routines_set_updated_at
  before update on public.habit_routines
  for each row execute function private.set_updated_at();

create table public.habit_routine_items (
  routine_id uuid not null references public.habit_routines (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (routine_id, habit_id)
);
create index habit_routine_items_user_idx on public.habit_routine_items (user_id);
create index habit_routine_items_habit_idx on public.habit_routine_items (habit_id);

create table public.habit_routine_checks (
  routine_id uuid not null,
  habit_id uuid not null,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (routine_id, habit_id, day),
  -- Punkt aus der Routine entfernt: seine Häkchen je Routine fallen weg (die Zahl in habit_checks bleibt)
  foreign key (routine_id, habit_id) references public.habit_routine_items (routine_id, habit_id) on delete cascade
);
create index habit_routine_checks_user_day_idx on public.habit_routine_checks (user_id, day);

alter table public.habit_routines enable row level security;
alter table public.habit_routine_items enable row level security;
alter table public.habit_routine_checks enable row level security;

create policy "habit_routines_own" on public.habit_routines
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "habit_routine_items_own" on public.habit_routine_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.habit_routines r where r.id = routine_id and r.user_id = (select auth.uid()))
    and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = (select auth.uid()))
  );
create policy "habit_routine_checks_own" on public.habit_routine_checks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.habit_routines r where r.id = routine_id and r.user_id = (select auth.uid()))
  );

revoke all on public.habit_routines, public.habit_routine_items, public.habit_routine_checks from anon;
grant select, insert, update, delete on public.habit_routines, public.habit_routine_items, public.habit_routine_checks to authenticated;

-- Bestehende Morgen- und Abendroutinen übernehmen (je Nutzer, der Punkte darin hat)
insert into public.habit_routines (user_id, name, daytime, color, position, legacy_key)
select distinct
  h.user_id,
  case h.routine when 'morgen' then 'Morgenroutine' else 'Abendroutine' end,
  case h.routine when 'morgen' then 'morgens' else 'abends' end,
  case h.routine when 'morgen' then 'orange' else 'lila' end,
  case h.routine when 'morgen' then 0 else 1 end,
  h.routine
from public.habits h
where h.routine is not null;

insert into public.habit_routine_items (routine_id, habit_id, user_id, position)
select r.id, h.id, h.user_id, h.position
from public.habits h
join public.habit_routines r on r.user_id = h.user_id and r.legacy_key = h.routine;

-- Bisherige Häkchen gehören zur einzigen Routine des Habits
insert into public.habit_routine_checks (routine_id, habit_id, user_id, day)
select i.routine_id, c.habit_id, c.user_id, c.day
from public.habit_checks c
join public.habit_routine_items i on i.habit_id = c.habit_id;

-- Wochenplan: Reihenfolge innerhalb eines Tages, Tageszeit optional
alter table public.training_schedule
  add column position integer not null default 0;
alter table public.training_schedule
  alter column daytime drop not null;

-- Bisherige Reihenfolge (Uhrzeit bzw. Beginn der Tageszeit, dann Titel) als Startwert
update public.training_schedule t
set position = o.n
from (
  select
    id,
    (row_number() over (
      partition by user_id, weekday
      order by
        coalesce(
          to_char(at_time, 'HH24:MI'),
          case daytime when 'morgens' then '05:00' when 'mittags' then '11:00' when 'nachmittags' then '15:00' when 'abends' then '18:00' when 'nachts' then '23:00' end
        ),
        title
    ) - 1)::integer as n
  from public.training_schedule
) o
where o.id = t.id;
