-- Sport & Gesundheit (11.11.2026): Supplemente & Blutwerte, Medizin & Vorsorge.
-- Nur additiv: sechs neue Tabellen, jede nur für den eigenen Nutzer (RLS). Listen-Inhalte (Inhaltsstoffe, Messwerte,
-- Fiebermessungen) liegen als jsonb in der Zeile; die App prüft und normalisiert sie.

-- ---------------------------------------------------------------------------
-- Supplement-Archiv
-- ---------------------------------------------------------------------------
create table public.supplements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  brand text check (brand is null or char_length(brand) between 1 and 80),
  form text not null default 'kapsel' check (form in ('kapsel', 'tablette', 'pulver', 'tropfen', 'fluessig', 'sonstiges')),
  -- eine Portion, z. B. „1 Kapsel“, „5 g“
  serving_label text check (serving_label is null or char_length(serving_label) between 1 and 40),
  servings_per_pack numeric(7, 1) check (servings_per_pack is null or servings_per_pack between 0.1 and 10000),
  price_eur numeric(7, 2) check (price_eur is null or price_eur between 0 and 10000),
  shop text check (shop is null or char_length(shop) between 1 and 80),
  servings_per_day numeric(4, 2) not null default 1 check (servings_per_day between 0 and 50),
  -- nehme ich gerade (zählt in die Tagessumme)
  active boolean not null default true,
  -- [{nutrient, name, amount, unit}]
  ingredients jsonb not null default '[]'::jsonb
    check (jsonb_typeof(ingredients) = 'array' and jsonb_array_length(ingredients) <= 40 and pg_column_size(ingredients) < 8000),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index supplements_user_idx on public.supplements (user_id);
create trigger supplements_set_updated_at
  before update on public.supplements
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Blutwerte-Archiv: ein Bluttest mit seinen Messwerten
-- ---------------------------------------------------------------------------
create table public.blood_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  taken_on date not null,
  lab text check (lab is null or char_length(lab) between 1 and 80),
  -- [{marker, name, value, unit, low, high}]
  results jsonb not null default '[]'::jsonb
    check (jsonb_typeof(results) = 'array' and jsonb_array_length(results) <= 80 and pg_column_size(results) < 16000),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index blood_tests_user_idx on public.blood_tests (user_id, taken_on);
create trigger blood_tests_set_updated_at
  before update on public.blood_tests
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Krankheitstage: eine Krankheit von–bis mit Symptomen und Fiebermessungen
-- ---------------------------------------------------------------------------
create table public.sick_episodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  started_on date not null,
  -- null = noch krank
  ended_on date check (ended_on is null or ended_on >= started_on),
  symptoms text[] not null default '{}' check (cardinality(symptoms) <= 30),
  sick_note boolean not null default false,
  -- [{date, time, celsius}]
  temperatures jsonb not null default '[]'::jsonb
    check (jsonb_typeof(temperatures) = 'array' and jsonb_array_length(temperatures) <= 100 and pg_column_size(temperatures) < 8000),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sick_episodes_user_idx on public.sick_episodes (user_id, started_on);
create trigger sick_episodes_set_updated_at
  before update on public.sick_episodes
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Medikamente: jede Einnahme mit Grund, optional zu einer Krankheit
-- ---------------------------------------------------------------------------
create table public.medication_intakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  dose text check (dose is null or char_length(dose) between 1 and 40),
  taken_on date not null,
  taken_time time,
  reason text check (reason is null or char_length(reason) between 1 and 120),
  episode_id uuid references public.sick_episodes (id) on delete set null,
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index medication_intakes_user_idx on public.medication_intakes (user_id, taken_on);
create index medication_intakes_episode_idx on public.medication_intakes (episode_id);
create trigger medication_intakes_set_updated_at
  before update on public.medication_intakes
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Vorsorge: Untersuchungen (z. B. Zahnarzt) mit Rhythmus und geplantem Termin, dazu die Besuche
-- ---------------------------------------------------------------------------
create table public.checkups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  doctor text check (doctor is null or char_length(doctor) between 1 and 80),
  interval_months smallint check (interval_months is null or interval_months between 1 and 240),
  -- fest ausgemachter nächster Termin
  next_on date,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index checkups_user_idx on public.checkups (user_id);
create trigger checkups_set_updated_at
  before update on public.checkups
  for each row execute function private.set_updated_at();

create table public.checkup_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  checkup_id uuid not null references public.checkups (id) on delete cascade,
  visited_on date not null,
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index checkup_visits_checkup_idx on public.checkup_visits (checkup_id, visited_on);
create index checkup_visits_user_idx on public.checkup_visits (user_id);

-- ---------------------------------------------------------------------------
-- RLS: alles nur für den eigenen Nutzer
-- ---------------------------------------------------------------------------
alter table public.supplements enable row level security;
create policy "supplements_own" on public.supplements
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table public.blood_tests enable row level security;
create policy "blood_tests_own" on public.blood_tests
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table public.sick_episodes enable row level security;
create policy "sick_episodes_own" on public.sick_episodes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table public.medication_intakes enable row level security;
create policy "medication_intakes_own" on public.medication_intakes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (episode_id is null or exists (select 1 from public.sick_episodes e where e.id = episode_id and e.user_id = (select auth.uid())))
  );

alter table public.checkups enable row level security;
create policy "checkups_own" on public.checkups
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table public.checkup_visits enable row level security;
create policy "checkup_visits_own" on public.checkup_visits
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.checkups c where c.id = checkup_id and c.user_id = (select auth.uid()))
  );

revoke all on public.supplements, public.blood_tests, public.sick_episodes, public.medication_intakes, public.checkups, public.checkup_visits from anon;
grant select, insert, update, delete on public.supplements, public.blood_tests, public.sick_episodes, public.medication_intakes, public.checkups, public.checkup_visits to authenticated;
