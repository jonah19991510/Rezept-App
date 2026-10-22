-- Wünsche vom 22.10.2026: Rezeptliste nebeneinander (Raster) oder untereinander (Liste), je Nutzer gespeichert.
-- Additiv mit Standardwert: die bisherige App-Version liest und schreibt die Tabelle unverändert weiter.
alter table public.user_settings
  add column recipe_view text not null default 'grid' check (recipe_view in ('grid', 'list'));
