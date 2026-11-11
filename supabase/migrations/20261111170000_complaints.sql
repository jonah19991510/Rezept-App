-- Medizin (11.11.2026): Beschwerden getrennt von Krankheiten.
-- Kopfschmerzen, Migräne & Co. sind keine Krankheitstage und sollen die Statistik „wie oft krank“ nicht verfälschen.
-- sick_episodes bekommt eine Art (krank / beschwerde) und eine Stärke 1–10 (für Beschwerden). Additiv; bestehende
-- Einträge bleiben „krank“, außer Kopfschmerzen und Migräne (werden Beschwerden).

alter table public.sick_episodes
  add column kind text not null default 'krank' check (kind in ('krank', 'beschwerde')),
  add column severity smallint check (severity is null or severity between 1 and 10);

update public.sick_episodes
set kind = 'beschwerde'
where lower(title) in ('kopfschmerzen', 'migräne', 'migraene', 'spannungskopfschmerz');
