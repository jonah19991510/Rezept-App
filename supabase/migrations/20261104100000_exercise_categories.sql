-- Sport & Gesundheit (04.11.2026): Übungen bekommen eine Art (Training, Dehnen, Reha) und eine optionale Anleitung.
-- Dazu vier Muskelgruppen, die bisher fehlten (Nacken, Hüftbeuger, Schienbein, Füße). Additiv: Bestehende Übungen
-- zählen als Training, die laufende App liest die neuen Spalten nicht.
-- Eigene Migration, weil neue Enum-Werte erst nach dem Commit nutzbar sind (Grundbestand: nächste Migration).

alter type public.muscle_group add value if not exists 'neck';
alter type public.muscle_group add value if not exists 'hip_flexors';
alter type public.muscle_group add value if not exists 'shins';
alter type public.muscle_group add value if not exists 'feet';

create type public.exercise_category as enum ('training', 'stretching', 'rehab');

alter table public.exercises
  add column category public.exercise_category not null default 'training',
  add column instructions text check (char_length(instructions) <= 500);
