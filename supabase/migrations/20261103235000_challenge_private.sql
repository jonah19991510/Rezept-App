-- Sport & Gesundheit (03.11.2026): private Challenges.
-- Neue Spalte is_public (bestehende bleiben öffentlich). Private Challenges sieht nur, wer sie angelegt hat – samt
-- Teilnahme und Einträgen; mitmachen kann auch nur diese Person. Die Gesamtrangliste lässt private aus (App).
-- Öffentlich → privat geht nur, solange niemand sonst mitmacht.

alter table public.challenges add column is_public boolean not null default true;

-- Darf die eingeloggte Person die Challenge sehen?
create or replace function private.challenge_visible(p_challenge_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.challenges
    where id = p_challenge_id and (is_public or created_by = (select auth.uid()))
  );
$$;
grant execute on function private.challenge_visible(uuid) to authenticated;

drop policy "challenges_select" on public.challenges;
create policy "challenges_select" on public.challenges
  for select to authenticated
  using (is_public or created_by = (select auth.uid()));

drop policy "challenge_participants_select" on public.challenge_participants;
create policy "challenge_participants_select" on public.challenge_participants
  for select to authenticated
  using (private.challenge_visible(challenge_id));

drop policy "challenge_participants_join" on public.challenge_participants;
create policy "challenge_participants_join" on public.challenge_participants
  for insert to authenticated
  with check (user_id = (select auth.uid()) and private.challenge_visible(challenge_id));

drop policy "challenge_entries_select" on public.challenge_entries;
create policy "challenge_entries_select" on public.challenge_entries
  for select to authenticated
  using (private.challenge_visible(challenge_id));

-- Sperre: privat werden nur, solange niemand sonst mitmacht (sonst verschwände die Challenge für die anderen)
create or replace function private.challenges_private_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_public and not new.is_public and private.challenge_has_others(old.id) then
    raise exception 'Es machen schon andere mit, deshalb kann die Challenge nicht mehr privat werden.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger challenges_private_guard
  before update of is_public on public.challenges
  for each row execute function private.challenges_private_guard();

-- Trainings zählen: nur für Challenges, die man sehen darf
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
    and (c.is_public or c.created_by = (select auth.uid()))
    and w.ended_at is not null
    and (w.started_at at time zone 'Europe/Berlin')::date >= p.start_date
    and (w.started_at at time zone 'Europe/Berlin')::date
      <= private.challenge_last_day(c.start_mode, c.period_kind, c.repeats, c.starts_on, c.duration_days, p.start_date)
  group by w.user_id, (w.started_at at time zone 'Europe/Berlin')::date;
$$;
