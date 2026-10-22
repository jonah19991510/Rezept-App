-- Wünsche vom 22.10.2026: gewählte Sortierung der Rezeptliste je Nutzer merken, Küche und Bar getrennt
-- (die Bar sortiert auch nach Stärke). Additiv mit Standardwert „neu“ (zuletzt geändert).
alter table public.user_settings
  add column recipe_sort text not null default 'neu' check (recipe_sort in ('neu', 'name', 'protein', 'kcal', 'zeit')),
  add column cocktail_sort text not null default 'neu' check (cocktail_sort in ('neu', 'name', 'stark', 'leicht', 'kcal'));
