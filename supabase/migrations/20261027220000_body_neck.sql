-- Sport & Gesundheit (27.10.2026): Halsumfang in den Körpermaßen (für den Körperfettanteil nach der Navy-Methode).
-- Nur additiv: Spalte neck_cm; die Regel „mindestens ein Wert“ zählt den Hals mit.
-- Das Geschlecht für die Formel steht in user_settings.body_settings (jsonb, keine Schemaänderung nötig).

alter table public.body_measurements
  add column neck_cm numeric(5, 1) check (neck_cm is null or neck_cm between 20 and 80);

alter table public.body_measurements drop constraint body_measurements_not_empty;
alter table public.body_measurements add constraint body_measurements_not_empty check (
  coalesce(weight_kg, neck_cm, shoulder_cm, chest_cm, waist_cm, belly_cm, hip_cm, upper_arm_cm, thigh_cm, calf_cm) is not null
);
