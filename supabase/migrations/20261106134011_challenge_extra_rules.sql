-- Sport & Gesundheit (06.11.2026): eigene Regeln einer Challenge als Freitext.
-- Sie zählen nicht für die Wertung und stehen deshalb bewusst nicht in der Regel-Sperre (private.challenges_guard):
-- Ersteller und Admins können sie auch dann noch ändern, wenn schon andere mitmachen. Rein additiv.

alter table public.challenges
  add column extra_rules text check (extra_rules is null or char_length(extra_rules) <= 1000);
