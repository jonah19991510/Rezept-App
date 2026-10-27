-- Sport & Gesundheit (27.10.2026): Energiebedarfsrechner.
-- Nur additiv: die Eingaben des Rechners (Geschlecht, Alter, Größe, Gewicht, Körperfett, PAL, Sport, Ziel, Protein,
-- Fett, Formel) im Konto, damit PC und Handy dasselbe zeigen. null = noch nie gerechnet (die App zeigt Standardwerte).
-- Die App prüft und normalisiert den Inhalt (normalizeProfile); hier nur Typ und Größe.

alter table public.user_settings
  add column energy_profile jsonb check (energy_profile is null or (jsonb_typeof(energy_profile) = 'object' and pg_column_size(energy_profile) < 2000));
