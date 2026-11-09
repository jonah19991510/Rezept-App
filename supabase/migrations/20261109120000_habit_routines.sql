-- Sport & Gesundheit (09.11.2026): Morgen- und Abendroutine im Habit Tracker.
-- Ein Punkt einer Routine ist eine tägliche Gewohnheit (oder ein Supplement) mit Zuordnung zur Routine. Abhaken,
-- Serien und Statistik laufen wie bei allen Habits über habit_checks; die Reihenfolge innerhalb der Routine ist die
-- bestehende Spalte position. Rein additiv (nullable Spalte).

alter table public.habits
  add column routine text check (routine is null or routine in ('morgen', 'abend'));

-- Routinen gibt es nur bei täglichen Gewohnheiten
alter table public.habits
  add constraint habits_routine_daily check (routine is null or frequency = 'daily');
