-- Supplemente (11.11.2026): Packungsinhalt und Menge je Portion getrennt.
-- Bisher stand im Feld „Portionen je Packung“ oft der Packungsinhalt (z. B. 90 Kapseln), während eine Portion laut
-- Freitext 3 Kapseln war; gerechnet wurde mit 90 Portionen statt 30. Jetzt: pack_amount (Inhalt, z. B. 90) und
-- serving_amount (je Portion, z. B. 3) in der Einheit der Form (Kapseln, Tabletten, g, Tropfen, ml, Stück).
-- servings_per_pack bleibt als berechneter Wert (pack_amount / serving_amount), serving_label als Anzeige-Text.

alter table public.supplements
  add column pack_amount numeric(8, 1) check (pack_amount is null or pack_amount between 0.1 and 100000),
  add column serving_amount numeric(7, 2) not null default 1 check (serving_amount > 0 and serving_amount <= 10000);

-- Bestehende Einträge: Zahl am Anfang des Portions-Texts („3 Kapseln“ → 3) ist die Menge je Portion, der bisherige
-- Wert „Portionen je Packung“ der Packungsinhalt.
update public.supplements
set
  serving_amount = coalesce(nullif(replace(substring(serving_label from '^\s*(\d+(?:[.,]\d+)?)'), ',', '.'), '')::numeric, 1),
  pack_amount = servings_per_pack;

update public.supplements
set servings_per_pack = round(pack_amount / serving_amount, 1)
where pack_amount is not null and pack_amount / serving_amount >= 0.1;
