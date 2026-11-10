-- Sport & Gesundheit (10.11.2026): doppelte Routine-Punkte zusammenführen (mit OK des Nutzers).
-- Bisher war z. B. „Zähne putzen“ in Morgen- und Abendroutine je ein eigenes Habit und zählte doppelt. Gleichnamige
-- tägliche Habits gleicher Art (Groß-/Kleinschreibung egal), die in Routinen stehen, werden zu einem: Es bleibt das
-- weiter oben in der Liste, es steht in allen Routinen der Doppelten, die Häkchen werden je Tag addiert, das
-- Tagesziel ist mindestens die Zahl seiner Routinen. Danach werden die Doppelten gelöscht.

create temporary table habit_merge on commit drop as
with candidates as (
  select h.id, h.user_id, h.kind, lower(btrim(h.name)) as name_key, h.position, h.created_at
  from public.habits h
  where h.frequency = 'daily'
    and exists (select 1 from public.habit_routine_items i where i.habit_id = h.id)
),
ranked as (
  select
    c.*,
    first_value(c.id) over (partition by c.user_id, c.kind, c.name_key order by c.position, c.created_at, c.id) as keeper_id
  from candidates c
)
select id as dup_id, keeper_id, created_at from ranked where id <> keeper_id;

-- In alle Routinen der Doppelten
insert into public.habit_routine_items (routine_id, habit_id, user_id, position)
select i.routine_id, m.keeper_id, i.user_id, i.position
from public.habit_routine_items i
join habit_merge m on m.dup_id = i.habit_id
on conflict (routine_id, habit_id) do nothing;

-- Häkchen je Routine übernehmen
insert into public.habit_routine_checks (routine_id, habit_id, user_id, day)
select c.routine_id, m.keeper_id, c.user_id, c.day
from public.habit_routine_checks c
join habit_merge m on m.dup_id = c.habit_id
on conflict do nothing;

-- Zahlen je Tag addieren
insert into public.habit_checks (habit_id, user_id, day, count)
select m.keeper_id, c.user_id, c.day, least(99, sum(c.count))::smallint
from public.habit_checks c
join habit_merge m on m.dup_id = c.habit_id
group by m.keeper_id, c.user_id, c.day
on conflict (habit_id, day) do update set count = least(99, public.habit_checks.count + excluded.count);

-- Tagesziel: mindestens die Zahl der Routinen; Beginn: das früheste der zusammengeführten
update public.habits h
set
  target = greatest(h.target, n.routines),
  created_at = least(h.created_at, n.first_created)
from (
  select
    m.keeper_id,
    (select count(*) from public.habit_routine_items i where i.habit_id = m.keeper_id)::smallint as routines,
    min(m.created_at) as first_created
  from habit_merge m
  group by m.keeper_id
) n
where n.keeper_id = h.id;

delete from public.habits h using habit_merge m where h.id = m.dup_id;
