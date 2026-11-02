-- Sport & Gesundheit (02.11.2026): Habit Tracker und Trainings-Wochenplan.
-- Nur additiv: drei Tabellen.
--   1. habits: Gewohnheiten und Supplemente mit Rhythmus (täglich, wöchentlich, monatlich), Ziel je Zeitraum,
--      optional Wochentage (nur täglich), Tageszeit, Uhrzeit, Dosis (Supplemente), Notizen, Farbe, Reihenfolge
--   2. habit_checks: wie oft eine Gewohnheit an einem Kalendertag erledigt wurde (höchstens eine Zeile je Tag)
--   3. training_schedule: wiederkehrender Wochenplan fürs Training (Wochentag, Tageszeit, Uhrzeit, Titel, Art, Dauer)

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  kind text not null default 'habit' check (kind in ('habit', 'supplement')),
  frequency text not null default 'daily' check (frequency in ('daily', 'weekly', 'monthly')),
  -- wie oft je Zeitraum (täglich: pro Tag, wöchentlich: pro Woche, monatlich: pro Monat)
  target smallint not null default 1 check (target between 1 and 31),
  -- nur täglich: an welchen Wochentagen (1 = Montag … 7 = Sonntag); leer = jeden Tag
  weekdays smallint[] not null default '{}' check (weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  daytime text check (daytime is null or daytime in ('morgens', 'mittags', 'nachmittags', 'abends', 'nachts')),
  at_time time,
  -- Supplemente: z. B. „5 g“, „1 Kapsel“
  dose text check (dose is null or char_length(dose) between 1 and 40),
  notes text check (notes is null or char_length(notes) <= 1000),
  -- Farbschlüssel aus der Palette der App (wie bei Getränken)
  color text not null check (color ~ '^[a-z]{2,16}$'),
  position integer not null default 0,
  -- gesetzt = pausiert (nicht unter „Heute“, nicht in der Statistik ab diesem Tag)
  paused_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index habits_user_position_idx on public.habits (user_id, position);
create trigger habits_set_updated_at
  before update on public.habits
  for each row execute function private.set_updated_at();

create table public.habit_checks (
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day date not null,
  count smallint not null default 1 check (count between 1 and 99),
  created_at timestamptz not null default now(),
  primary key (habit_id, day)
);
create index habit_checks_user_day_idx on public.habit_checks (user_id, day);

create table public.training_schedule (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  daytime text not null check (daytime in ('morgens', 'mittags', 'nachmittags', 'abends', 'nachts')),
  at_time time,
  title text not null check (char_length(btrim(title)) between 1 and 60),
  category text not null default 'kraft' check (category in ('kraft', 'ausdauer', 'mobility', 'sport', 'erholung')),
  duration_min smallint check (duration_min is null or duration_min between 5 and 600),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index training_schedule_user_weekday_idx on public.training_schedule (user_id, weekday);
create trigger training_schedule_set_updated_at
  before update on public.training_schedule
  for each row execute function private.set_updated_at();

alter table public.habits enable row level security;
alter table public.habit_checks enable row level security;
alter table public.training_schedule enable row level security;

create policy "habits_own" on public.habits
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "habit_checks_own" on public.habit_checks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = (select auth.uid()))
  );
create policy "training_schedule_own" on public.training_schedule
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.habits, public.habit_checks, public.training_schedule from anon;
grant select, insert, update, delete on public.habits, public.habit_checks, public.training_schedule to authenticated;
