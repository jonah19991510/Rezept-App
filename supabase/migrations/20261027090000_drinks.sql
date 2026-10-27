-- Sport & Gesundheit (27.10.2026): Getränketracker.
-- Nur additiv: zwei Tabellen, eine Spalte in user_settings, eine Funktion.
--   1. drinks: eigene Getränke mit Farbe, Koffein und Zucker pro 100 ml und Wasseranteil; Mischgetränke mit Zutaten
--      (jsonb, Werte daraus rechnet die App und speichert sie mit, damit Einträge und Statistik nur eine Quelle haben)
--   2. drink_entries: was wann getrunken wurde. Name, Farbe, Koffein, Zucker und Wasser stehen als Stand zum Zeitpunkt
--      des Trinkens im Eintrag (spätere Änderungen am Getränk oder Löschen ändern alte Tage nicht).
--   3. user_settings.drink_goal_ml: Tagesziel; null = Tracker noch nie geöffnet (dann legt die App die Startliste an)
--   4. drink_days: Summen je Kalendertag in deutscher Zeit (Verlauf, Serie)

create table public.drinks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  -- Farbschlüssel aus der Palette der App (z. B. „blau“)
  color text not null check (color ~ '^[a-z]{2,16}$'),
  caffeine_mg_per_100ml numeric(6, 1) not null default 0 check (caffeine_mg_per_100ml between 0 and 1000),
  sugar_g_per_100ml numeric(5, 1) not null default 0 check (sugar_g_per_100ml between 0 and 100),
  -- Anteil Wasser in % (Wasser 100, Mischgetränk aus den Zutaten)
  water_percent numeric(4, 1) not null default 0 check (water_percent between 0 and 100),
  -- null = einfaches Getränk; sonst Zutaten [{name, ml, caffeine, sugar, water}] (Werte pro 100 ml, water = ist Wasser)
  ingredients jsonb check (ingredients is null or (jsonb_typeof(ingredients) = 'array' and jsonb_array_length(ingredients) between 1 and 12)),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint drinks_user_name_key unique (user_id, name)
);
create index drinks_user_position_idx on public.drinks (user_id, position);
create trigger drinks_set_updated_at
  before update on public.drinks
  for each row execute function private.set_updated_at();

create table public.drink_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  drink_id uuid references public.drinks (id) on delete set null,
  drunk_at timestamptz not null default now(),
  amount_ml integer not null check (amount_ml between 1 and 5000),
  drink_name text not null check (char_length(btrim(drink_name)) between 1 and 60),
  drink_color text not null check (drink_color ~ '^[a-z]{2,16}$'),
  caffeine_mg numeric(7, 1) not null default 0 check (caffeine_mg >= 0),
  sugar_g numeric(6, 1) not null default 0 check (sugar_g >= 0),
  water_ml numeric(6, 1) not null default 0 check (water_ml >= 0),
  created_at timestamptz not null default now()
);
create index drink_entries_user_drunk_idx on public.drink_entries (user_id, drunk_at desc);
create index drink_entries_drink_id_idx on public.drink_entries (drink_id);

alter table public.drinks enable row level security;
alter table public.drink_entries enable row level security;

create policy "drinks_own" on public.drinks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "drink_entries_own" on public.drink_entries
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (drink_id is null or exists (select 1 from public.drinks d where d.id = drink_id and d.user_id = (select auth.uid())))
  );

revoke all on public.drinks, public.drink_entries from anon;
grant select, insert, update, delete on public.drinks, public.drink_entries to authenticated;

alter table public.user_settings
  add column drink_goal_ml integer check (drink_goal_ml is null or drink_goal_ml between 250 and 10000);

-- ---------------------------------------------------------------------------
-- Summen je Kalendertag (deutsche Zeit) von p_from bis p_to (beide einschließlich), nur Tage mit Einträgen
-- ---------------------------------------------------------------------------
create or replace function public.drink_days(p_from date, p_to date)
returns table (
  day date,
  amount_ml bigint,
  caffeine_mg numeric,
  sugar_g numeric,
  entries bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select (e.drunk_at at time zone 'Europe/Berlin')::date as day,
    sum(e.amount_ml)::bigint, sum(e.caffeine_mg), sum(e.sugar_g), count(*)
  from public.drink_entries e
  where e.user_id = (select auth.uid())
    and e.drunk_at >= (p_from::timestamp at time zone 'Europe/Berlin')
    and e.drunk_at < ((p_to + 1)::timestamp at time zone 'Europe/Berlin')
  group by 1
  order by 1;
$$;

revoke all on function public.drink_days(date, date) from public, anon;
grant execute on function public.drink_days(date, date) to authenticated;
