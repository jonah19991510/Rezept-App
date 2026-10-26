-- Wünsche vom 26.10.2026: Startseite mit Widgets in eigener Reihenfolge, einzeln ein- und ausblendbar.
-- Gespeichert als [{ "id": "today", "visible": true }, …]; null = Standard-Anordnung der App.
-- Additiv und nullable: die bisherige App-Version liest und schreibt die Tabelle unverändert weiter.
alter table public.user_settings
  add column home_widgets jsonb check (home_widgets is null or jsonb_typeof(home_widgets) = 'array');
