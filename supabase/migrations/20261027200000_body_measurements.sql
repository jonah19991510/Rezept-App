-- Sport & Gesundheit (27.10.2026): Körpermaße.
-- Nur additiv: Tabelle body_measurements (eine Messung je Tag: Gewicht und Umfänge, alles optional) und
-- user_settings.body_settings (Körpergröße für den BMI, ausgeblendete Maße).

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  measured_on date not null,
  weight_kg numeric(5, 1) check (weight_kg is null or weight_kg between 20 and 400),
  shoulder_cm numeric(5, 1) check (shoulder_cm is null or shoulder_cm between 30 and 250),
  chest_cm numeric(5, 1) check (chest_cm is null or chest_cm between 30 and 250),
  waist_cm numeric(5, 1) check (waist_cm is null or waist_cm between 30 and 250),
  belly_cm numeric(5, 1) check (belly_cm is null or belly_cm between 30 and 250),
  hip_cm numeric(5, 1) check (hip_cm is null or hip_cm between 30 and 250),
  upper_arm_cm numeric(5, 1) check (upper_arm_cm is null or upper_arm_cm between 10 and 100),
  thigh_cm numeric(5, 1) check (thigh_cm is null or thigh_cm between 20 and 150),
  calf_cm numeric(5, 1) check (calf_cm is null or calf_cm between 15 and 100),
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint body_measurements_user_day_key unique (user_id, measured_on),
  -- mindestens ein Wert
  constraint body_measurements_not_empty check (
    coalesce(weight_kg, shoulder_cm, chest_cm, waist_cm, belly_cm, hip_cm, upper_arm_cm, thigh_cm, calf_cm) is not null
  )
);
create trigger body_measurements_set_updated_at
  before update on public.body_measurements
  for each row execute function private.set_updated_at();

alter table public.body_measurements enable row level security;
create policy "body_measurements_own" on public.body_measurements
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
revoke all on public.body_measurements from anon;
grant select, insert, update, delete on public.body_measurements to authenticated;

-- {heightCm, hidden: [...]} – die App prüft und normalisiert den Inhalt
alter table public.user_settings
  add column body_settings jsonb check (body_settings is null or (jsonb_typeof(body_settings) = 'object' and pg_column_size(body_settings) < 1000));
