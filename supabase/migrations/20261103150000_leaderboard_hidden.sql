-- Sport & Gesundheit (03.11.2026): Gesamtrangliste der Challenges (Phase C2).
-- Nur additiv: wer sich aus der Gesamtrangliste ausblendet. Steht im Profil, weil alle Eingeloggten es lesen müssen
-- (die Rangliste rechnet die App); ändern kann es jeder nur bei sich selbst (Policy „profiles_update_own“).

alter table public.profiles add column hide_from_leaderboard boolean not null default false;

grant update (hide_from_leaderboard) on public.profiles to authenticated;
