import "server-only";
import { MEASURES, normalizeBodySettings, type BodySettings, type Measurement, type MeasureKey } from "@/lib/domain/body";
import { createClient } from "@/lib/supabase/server";

// Körpermaße lesen (RLS: nur eigene).

export const BODY_COLUMNS = `id, measured_on, note, ${MEASURES.map((m) => m.column).join(", ")}`;

type Row = Record<string, unknown> & { id: string; measured_on: string; note: string | null };

export function toMeasurement(row: Row): Measurement {
  const values = Object.fromEntries(
    MEASURES.map((m) => {
      const v = row[m.column];
      return [m.key, v == null ? null : Number(v)];
    }),
  ) as Record<MeasureKey, number | null>;
  return { id: row.id, date: row.measured_on, note: row.note, ...values };
}

/** Alle Messungen, älteste zuerst. */
export async function getMeasurements(userId: string): Promise<Measurement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("body_measurements").select(BODY_COLUMNS).eq("user_id", userId).order("measured_on");
  if (error) throw new Error(`Körpermaße konnten nicht geladen werden (${error.code})`);
  return (data as unknown as Row[]).map(toMeasurement);
}

/** Einstellungen (Körpergröße, Geschlecht, ausgeblendete Maße); Größe und Geschlecht notfalls aus dem Energierechner. */
export async function getBodySettings(userId: string): Promise<BodySettings> {
  const supabase = await createClient();
  const { data } = await supabase.from("user_settings").select("body_settings, energy_profile").eq("user_id", userId).maybeSingle();
  const energy = (data?.energy_profile ?? null) as { heightCm?: unknown; sex?: unknown } | null;
  const energyHeight = typeof energy?.heightCm === "number" ? energy.heightCm : null;
  const energySex = energy?.sex === "m" || energy?.sex === "w" ? energy.sex : null;
  return normalizeBodySettings(data?.body_settings, energyHeight, energySex);
}
