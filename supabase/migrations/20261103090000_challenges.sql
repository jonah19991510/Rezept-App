-- Sport & Gesundheit (03.11.2026): Challenges (Phase C1).
-- Nur additiv: drei Tabellen, Hilfsfunktionen, eine Abfrage für Challenges aus Trainings.
--   1. challenges: Regeln einer Challenge (was zählt, wie oft, wie lange, Start, verpasste Tage, Joker, Nachtragen).
--      Jeder darf anlegen; alle Eingeloggten sehen alle Challenges. Sobald jemand anderes mitmacht, sind die Regeln
--      gesperrt (Name, Beschreibung, Symbol und Farbe bleiben änderbar).
--   2. challenge_participants: wer mitmacht und ab welchem Tag (fester Start für alle oder ab dem Beitritt).
--   3. challenge_entries: Abhaken bzw. Menge je Teilnehmer und Tag (eine Zeile je Tag), nur im erlaubten Zeitfenster.
-- Punkte, Status und Ranglisten rechnet die App (lib/domain/challenges.ts) aus diesen Daten.

-- Heutiger Kalendertag in deutscher Zeit
create or replace function private.berlin_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Berlin')::date;
$$;
grant execute on function private.berlin_today() to authenticated;

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  -- Account gelöscht: die Challenge bleibt für die anderen Teilnehmer stehen
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 60),
  description text check (description is null or char_length(description) <= 2000),
  -- Symbol- und Farbschlüssel aus der App
  icon text not null check (icon ~ '^[a-z-]{2,24}$'),
  color text not null check (color ~ '^[a-z]{2,16}$'),
  -- check: abhaken (ja/nein) · daily: Menge pro Tag · total: Gesamtmenge im Zeitraum
  metric text not null check (metric in ('check', 'daily', 'total')),
  -- manual: selbst eintragen · workouts: zählt automatisch aus beendeten Trainings
  source text not null default 'manual' check (source in ('manual', 'workouts')),
  unit text check (unit is null or char_length(btrim(unit)) between 1 and 24),
  daily_target numeric(10, 2) check (daily_target is null or (daily_target > 0 and daily_target <= 100000)),
  total_target numeric(12, 2) check (total_target is null or (total_target > 0 and total_target <= 10000000)),
  -- daily: jeder Tag zählt · weekly: x Tage je Woche (Wochen ab dem eigenen Start)
  frequency text not null default 'daily' check (frequency in ('daily', 'weekly')),
  days_per_week smallint check (days_per_week is null or days_per_week between 1 and 7),
  duration_days smallint not null check (duration_days between 1 and 366),
  -- fixed: gemeinsamer Start für alle · join: jeder ab seinem Beitritt
  start_mode text not null check (start_mode in ('fixed', 'join')),
  starts_on date,
  -- fester Start: Einstieg noch bis so viele Tage nach dem Start (0 = nur bis zum Start)
  late_join_days smallint not null default 0 check (late_join_days between 0 and 366),
  -- strict: mehr verpasst als Joker = ausgeschieden · streak: Serie reißt · relaxed: keine Folgen
  missed_rule text not null default 'relaxed' check (missed_rule in ('strict', 'streak', 'relaxed')),
  jokers smallint not null default 0 check (jokers between 0 and 30),
  -- geschafft ab so vielen erfüllten Tagen bzw. Wochen (null = alle)
  min_periods smallint check (min_periods is null or min_periods >= 1),
  -- Nachtragen bis so viele Tage zurück (0 = nur heute)
  backfill_days smallint not null default 1 check (backfill_days between 0 and 7),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint challenges_start check ((start_mode = 'fixed') = (starts_on is not null)),
  constraint challenges_late_join check (start_mode = 'fixed' or late_join_days = 0),
  constraint challenges_targets check (
    (metric = 'check' and daily_target is null and total_target is null)
    or (metric = 'daily' and source = 'manual' and daily_target is not null and total_target is null)
    or (metric = 'total' and total_target is not null and daily_target is null)
  ),
  -- Einheit nur bei selbst eingetragenen Mengen (Trainings zählen in „Trainings“)
  constraint challenges_unit check ((metric <> 'check' and source = 'manual') = (unit is not null)),
  constraint challenges_weekly check (
    (frequency = 'weekly') = (days_per_week is not null)
    and (frequency = 'daily' or duration_days % 7 = 0)
  ),
  -- Gesamtmenge: kein Rhythmus, keine verpassten Tage
  constraint challenges_total check (
    metric <> 'total' or (frequency = 'daily' and missed_rule = 'relaxed' and jokers = 0 and min_periods is null)
  ),
  constraint challenges_jokers check (missed_rule <> 'relaxed' or jokers = 0),
  constraint challenges_min_periods check (
    min_periods is null
    or (missed_rule <> 'strict' and min_periods <= case when frequency = 'weekly' then duration_days / 7 else duration_days end)
  )
);
create index challenges_created_by_idx on public.challenges (created_by);
create trigger challenges_set_updated_at
  before update on public.challenges
  for each row execute function private.set_updated_at();

create table public.challenge_participants (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- erster Tag der Challenge für diese Person (setzt der Trigger)
  start_date date not null default private.berlin_today(),
  joined_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
create index challenge_participants_user_idx on public.challenge_participants (user_id);

create table public.challenge_entries (
  challenge_id uuid not null,
  user_id uuid not null default auth.uid(),
  day date not null,
  -- abhaken: 1 · Menge: der Wert des Tages
  value numeric(12, 2) not null check (value > 0 and value <= 10000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (challenge_id, user_id, day),
  -- Austreten oder Löschen der Challenge nimmt die Einträge mit
  foreign key (challenge_id, user_id) references public.challenge_participants (challenge_id, user_id) on delete cascade
);
create index challenge_entries_user_idx on public.challenge_entries (user_id);
create trigger challenge_entries_set_updated_at
  before update on public.challenge_entries
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Regeln, die die Datenbank selbst durchsetzt
-- ---------------------------------------------------------------------------

-- Macht außer dem Ersteller schon jemand mit? Dann sind die Regeln gesperrt.
create or replace function private.challenge_has_others(p_challenge_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.challenge_participants p
    join public.challenges c on c.id = p.challenge_id
    where p.challenge_id = p_challenge_id and p.user_id is distinct from c.created_by
  );
$$;
grant execute on function private.challenge_has_others(uuid) to authenticated;

create or replace function private.challenges_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.start_mode = 'fixed' and new.starts_on < private.berlin_today() then
      raise exception 'Der Start darf nicht in der Vergangenheit liegen.' using errcode = '23514';
    end if;
    return new;
  end if;

  new.created_by := old.created_by;
  if (new.metric, new.source, new.unit, new.daily_target, new.total_target, new.frequency, new.days_per_week,
      new.duration_days, new.start_mode, new.starts_on, new.late_join_days, new.missed_rule, new.jokers,
      new.min_periods, new.backfill_days)
     is distinct from
     (old.metric, old.source, old.unit, old.daily_target, old.total_target, old.frequency, old.days_per_week,
      old.duration_days, old.start_mode, old.starts_on, old.late_join_days, old.missed_rule, old.jokers,
      old.min_periods, old.backfill_days) then
    if private.challenge_has_others(old.id) then
      raise exception 'Es machen schon andere mit, die Regeln lassen sich nicht mehr ändern.' using errcode = '42501';
    end if;
    if new.start_mode = 'fixed' and new.starts_on is distinct from old.starts_on and new.starts_on < private.berlin_today() then
      raise exception 'Der Start darf nicht in der Vergangenheit liegen.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger challenges_guard
  before insert or update on public.challenges
  for each row execute function private.challenges_guard();

-- Neuer Start bei festem Termin: Ersteller (einziger Teilnehmer) zieht mit
create or replace function private.challenges_follow_start()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.start_mode = 'fixed' and new.starts_on is distinct from old.starts_on then
    update public.challenge_participants set start_date = new.starts_on where challenge_id = new.id;
  end if;
  return null;
end;
$$;

create trigger challenges_follow_start
  after update on public.challenges
  for each row execute function private.challenges_follow_start();

-- Beitritt: Starttag festlegen und prüfen, ob man noch einsteigen darf
create or replace function private.challenge_participants_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_challenge public.challenges;
  v_today date := private.berlin_today();
begin
  select * into v_challenge from public.challenges where id = new.challenge_id;
  if not found then
    raise exception 'Die Challenge gibt es nicht mehr.' using errcode = '23503';
  end if;
  if v_challenge.start_mode = 'fixed' then
    if v_today > v_challenge.starts_on + v_challenge.late_join_days then
      raise exception 'Der Einstieg ist nicht mehr möglich.' using errcode = '42501';
    end if;
    new.start_date := v_challenge.starts_on;
  else
    new.start_date := v_today;
  end if;
  new.joined_at := now();
  return new;
end;
$$;

create trigger challenge_participants_guard
  before insert on public.challenge_participants
  for each row execute function private.challenge_participants_guard();

-- Darf die eingeloggte Person an diesem Tag eintragen (oder austragen)? Nur selbst eingetragene Challenges, nur im
-- eigenen Zeitraum, nicht in der Zukunft und nicht weiter zurück als „Nachtragen“ erlaubt.
create or replace function private.challenge_day_open(p_challenge_id uuid, p_day date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.challenges c
    join public.challenge_participants p on p.challenge_id = c.id and p.user_id = (select auth.uid())
    where c.id = p_challenge_id
      and c.source = 'manual'
      and p_day between p.start_date and p.start_date + c.duration_days - 1
      and p_day <= private.berlin_today()
      and p_day >= private.berlin_today() - c.backfill_days
  );
$$;
grant execute on function private.challenge_day_open(uuid, date) to authenticated;

-- Abhaken speichert immer 1
create or replace function private.challenge_value_ok(p_challenge_id uuid, p_value numeric)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.challenges c
    where c.id = p_challenge_id and (c.metric <> 'check' or p_value = 1)
  );
$$;
grant execute on function private.challenge_value_ok(uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: Challenges, Teilnehmer und Einträge sind für alle Eingeloggten sichtbar (Ranglisten); schreiben nur eigene
-- ---------------------------------------------------------------------------

alter table public.challenges enable row level security;
alter table public.challenge_participants enable row level security;
alter table public.challenge_entries enable row level security;

create policy "challenges_select" on public.challenges
  for select to authenticated
  using (true);
create policy "challenges_insert_own" on public.challenges
  for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "challenges_update_own_or_admin" on public.challenges
  for update to authenticated
  using (created_by = (select auth.uid()) or (select private.is_admin()))
  with check (created_by = (select auth.uid()) or (select private.is_admin()));
-- Löschen: Ersteller, solange niemand sonst mitmacht; Admins immer
create policy "challenges_delete_own_or_admin" on public.challenges
  for delete to authenticated
  using ((created_by = (select auth.uid()) and not private.challenge_has_others(id)) or (select private.is_admin()));

create policy "challenge_participants_select" on public.challenge_participants
  for select to authenticated
  using (true);
create policy "challenge_participants_join" on public.challenge_participants
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "challenge_participants_leave" on public.challenge_participants
  for delete to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "challenge_entries_select" on public.challenge_entries
  for select to authenticated
  using (true);
create policy "challenge_entries_insert_own" on public.challenge_entries
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and private.challenge_day_open(challenge_id, day)
    and private.challenge_value_ok(challenge_id, value)
  );
create policy "challenge_entries_update_own" on public.challenge_entries
  for update to authenticated
  using (user_id = (select auth.uid()) and private.challenge_day_open(challenge_id, day))
  with check (
    user_id = (select auth.uid())
    and private.challenge_day_open(challenge_id, day)
    and private.challenge_value_ok(challenge_id, value)
  );
create policy "challenge_entries_delete_own" on public.challenge_entries
  for delete to authenticated
  using (user_id = (select auth.uid()) and private.challenge_day_open(challenge_id, day));

revoke all on public.challenges, public.challenge_participants, public.challenge_entries from anon;
grant select, insert, update, delete on public.challenges, public.challenge_entries to authenticated;
-- Teilnahme: beitreten und austreten, nichts ändern
grant select, insert, delete on public.challenge_participants to authenticated;
revoke update on public.challenge_participants from authenticated;

-- ---------------------------------------------------------------------------
-- Challenges aus Trainings: beendete Trainings je Teilnehmer und Tag im jeweiligen Zeitraum. Trainings selbst sind
-- privat; herausgegeben wird nur die Anzahl, und nur für Leute, die bei dieser Challenge mitmachen.
-- ---------------------------------------------------------------------------

create or replace function public.challenge_workout_days(p_challenge_id uuid)
returns table (user_id uuid, day date, workouts integer)
language sql
stable
security definer
set search_path = ''
as $$
  select w.user_id, (w.started_at at time zone 'Europe/Berlin')::date as day, count(*)::integer
  from public.challenges c
  join public.challenge_participants p on p.challenge_id = c.id
  join public.workouts w on w.user_id = p.user_id
  where c.id = p_challenge_id
    and c.source = 'workouts'
    and (select auth.uid()) is not null
    and w.ended_at is not null
    and (w.started_at at time zone 'Europe/Berlin')::date between p.start_date and p.start_date + c.duration_days - 1
  group by w.user_id, (w.started_at at time zone 'Europe/Berlin')::date;
$$;
revoke all on function public.challenge_workout_days(uuid) from public, anon;
grant execute on function public.challenge_workout_days(uuid) to authenticated;
