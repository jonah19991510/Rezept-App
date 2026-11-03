-- Sport & Gesundheit (04.11.2026): Challenges bis Monats- bzw. Jahresende und Challenges, die sich wiederholen.
-- Additiv: zwei Spalten, neue Regeln, angepasste Funktionen.
--   period_kind: days (feste Anzahl Tage) · month (bis Ende des Monats) · year (bis Ende des Jahres)
--   repeats: nach dem Ende beginnt am nächsten Tag die nächste Runde mit denselben Regeln; wer mitmacht, ist
--            automatisch wieder dabei. Bei month/year sind die Runden Kalendermonate bzw. -jahre (die erste Runde
--            beginnt am Starttag), bei days Blöcke von duration_days Tagen.
-- Monat/Jahr und Wiederholen gibt es nur mit gemeinsamem Start. Bei month/year steht in duration_days die Länge der
-- ersten Runde (nur zur Anzeige).

alter table public.challenges
  add column period_kind text not null default 'days' check (period_kind in ('days', 'month', 'year')),
  add column repeats boolean not null default false;

alter table public.challenges add constraint challenges_rounds check (
  (period_kind = 'days' and not repeats) or start_mode = 'fixed'
);
-- „x Tage pro Woche“ und „mindestens X von Y“ nur bei einer festen Anzahl Tage
alter table public.challenges add constraint challenges_calendar check (
  period_kind = 'days' or (frequency = 'daily' and min_periods is null)
);

-- Letzter Tag, an dem für eine Teilnahme (Start `p_start`) eingetragen werden darf; ohne Ende bei Wiederholung
create or replace function private.challenge_last_day(
  p_start_mode text, p_period_kind text, p_repeats boolean, p_starts_on date, p_duration_days integer, p_start date
)
returns date
language sql
immutable
set search_path = ''
as $$
  select case
    when p_start_mode = 'join' then p_start + p_duration_days - 1
    when p_repeats then 'infinity'::date
    when p_period_kind = 'month' then ((date_trunc('month', p_starts_on) + interval '1 month')::date - 1)
    when p_period_kind = 'year' then ((date_trunc('year', p_starts_on) + interval '1 year')::date - 1)
    else p_starts_on + p_duration_days - 1
  end;
$$;
grant execute on function private.challenge_last_day(text, text, boolean, date, integer, date) to authenticated;

-- Regeln sperren: auch Zeitraum und Wiederholen
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
      new.min_periods, new.backfill_days, new.period_kind, new.repeats)
     is distinct from
     (old.metric, old.source, old.unit, old.daily_target, old.total_target, old.frequency, old.days_per_week,
      old.duration_days, old.start_mode, old.starts_on, old.late_join_days, old.missed_rule, old.jokers,
      old.min_periods, old.backfill_days, old.period_kind, old.repeats) then
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

-- Beitritt: bei Wiederholung jederzeit; ist die laufende Runde schon zu weit, zählt man ab der nächsten
create or replace function private.challenge_participants_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.challenges;
  v_today date := private.berlin_today();
  v_round date;
begin
  select * into c from public.challenges where id = new.challenge_id;
  if not found then
    raise exception 'Die Challenge gibt es nicht mehr.' using errcode = '23503';
  end if;
  if c.start_mode = 'join' then
    new.start_date := v_today;
  elsif c.repeats then
    -- Beginn der laufenden Runde
    if v_today <= c.starts_on then
      v_round := c.starts_on;
    elsif c.period_kind = 'month' then
      v_round := greatest(c.starts_on, date_trunc('month', v_today)::date);
    elsif c.period_kind = 'year' then
      v_round := greatest(c.starts_on, date_trunc('year', v_today)::date);
    else
      v_round := c.starts_on + ((v_today - c.starts_on) / c.duration_days) * c.duration_days;
    end if;
    if v_today > v_round + c.late_join_days then
      v_round := case c.period_kind
        when 'month' then (date_trunc('month', v_round) + interval '1 month')::date
        when 'year' then (date_trunc('year', v_round) + interval '1 year')::date
        else v_round + c.duration_days
      end;
    end if;
    new.start_date := v_round;
  else
    if v_today > c.starts_on + c.late_join_days then
      raise exception 'Der Einstieg ist nicht mehr möglich.' using errcode = '42501';
    end if;
    new.start_date := c.starts_on;
  end if;
  new.joined_at := now();
  return new;
end;
$$;

-- Eintragen: ab dem eigenen Start bis zum letzten Tag (bei Wiederholung ohne Ende), im Nachtrag-Fenster
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
      and p_day >= p.start_date
      and p_day <= private.challenge_last_day(c.start_mode, c.period_kind, c.repeats, c.starts_on, c.duration_days, p.start_date)
      and p_day <= private.berlin_today()
      and p_day >= private.berlin_today() - c.backfill_days
  );
$$;

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
    and (w.started_at at time zone 'Europe/Berlin')::date >= p.start_date
    and (w.started_at at time zone 'Europe/Berlin')::date
      <= private.challenge_last_day(c.start_mode, c.period_kind, c.repeats, c.starts_on, c.duration_days, p.start_date)
  group by w.user_id, (w.started_at at time zone 'Europe/Berlin')::date;
$$;
