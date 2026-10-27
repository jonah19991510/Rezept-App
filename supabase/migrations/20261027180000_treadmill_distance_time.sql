-- Sport & Gesundheit (27.10.2026): „Laufband“ im Grundbestand erfasst jetzt Strecke und Zeit (statt nur Zeit),
-- damit man im Training Geschwindigkeit, Strecke und Zeit eintragen kann (wie bei „Laufen (draußen)“,
-- Fahrrad-Ergometer und Rudergerät). Zielzeiten in Plänen (z. B. 1 × 30 Min.) bleiben gültig.
-- Bisher gibt es mit Laufband keine Trainings; vorhandene Sätze hätten ihre Zeit ohnehin behalten.

update public.exercises
set tracking = 'distance_time'
where name = 'Laufband' and created_by is null and tracking = 'time';
