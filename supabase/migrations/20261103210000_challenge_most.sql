-- Sport & Gesundheit (03.11.2026): Challenge-Art „Wer schafft mehr?“ (Wettkampf).
-- Nur Regeln erweitert: metric 'most' = jeder trägt seine Menge je Tag ein (bzw. Trainings zählen automatisch), es gibt
-- kein Ziel; die Rangliste sortiert nach der Gesamtmenge. Wie bei der Gesamtmenge ohne Rhythmus, Joker und
-- „mindestens X von Y“. Bestehende Challenges bleiben gültig.

alter table public.challenges drop constraint challenges_metric_check;
alter table public.challenges add constraint challenges_metric_check check (metric in ('check', 'daily', 'total', 'most'));

alter table public.challenges drop constraint challenges_targets;
alter table public.challenges add constraint challenges_targets check (
  (metric = 'check' and daily_target is null and total_target is null)
  or (metric = 'daily' and source = 'manual' and daily_target is not null and total_target is null)
  or (metric = 'total' and total_target is not null and daily_target is null)
  or (metric = 'most' and daily_target is null and total_target is null)
);

alter table public.challenges drop constraint challenges_total;
alter table public.challenges add constraint challenges_total check (
  metric not in ('total', 'most') or (frequency = 'daily' and missed_rule = 'relaxed' and jokers = 0 and min_periods is null)
);
