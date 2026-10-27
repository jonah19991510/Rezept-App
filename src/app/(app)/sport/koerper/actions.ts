"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { MEASURES } from "@/lib/domain/body";
import { todayInBerlin } from "@/lib/domain/week";
import { createClient } from "@/lib/supabase/server";
import { bodySettingsSchema, measurementInputSchema, type MeasurementInput } from "@/lib/validation/body";
import { flattenIssues } from "@/lib/validation/recipe";

// Körpermaße speichern. Wer was darf, entscheidet die RLS (nur eigene Messungen).

const idSchema = z.uuid();

function revalidateBody() {
  revalidatePath("/sport/koerper");
  revalidatePath("/sport/statistik");
}

export type BodyResult = { ok: true } | { ok: false; message?: string; fieldErrors?: Record<string, string[]> };

/**
 * Messung speichern: neu (`id` null) oder ändern. Eine Messung je Tag; gibt es für das Datum schon eine, wird sie
 * überschrieben (beim Ändern nur, wenn es dieselbe ist).
 */
export async function saveMeasurementAction(id: string | null, input: MeasurementInput): Promise<BodyResult> {
  const user = await requireUser();
  if (id && !idSchema.safeParse(id).success) return { ok: false, message: "Ungültige Messung." };
  const parsed = measurementInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message, fieldErrors: flattenIssues(parsed.error) };
  const d = parsed.data;
  if (d.date > todayInBerlin()) return { ok: false, fieldErrors: { date: ["Das Datum liegt in der Zukunft."] } };

  const row = {
    measured_on: d.date,
    note: d.note || null,
    ...Object.fromEntries(MEASURES.map((m) => [m.column, d[m.key]])),
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("body_measurements").update(row).eq("id", id).eq("user_id", user.id)
    : await supabase.from("body_measurements").upsert({ ...row, user_id: user.id }, { onConflict: "user_id,measured_on" });
  if (error) {
    if (error.code === "23505") return { ok: false, fieldErrors: { date: ["Für diesen Tag gibt es schon eine Messung."] } };
    return { ok: false, message: "Die Messung konnte nicht gespeichert werden." };
  }
  revalidateBody();
  return { ok: true };
}

export async function deleteMeasurementAction(id: string): Promise<{ ok: boolean; message?: string }> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Ungültige Messung." };
  const supabase = await createClient();
  const { error } = await supabase.from("body_measurements").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, message: "Die Messung konnte nicht gelöscht werden." };
  revalidateBody();
  return { ok: true };
}

export async function saveBodySettingsAction(input: z.input<typeof bodySettingsSchema>): Promise<{ ok: boolean; message?: string }> {
  const user = await requireUser();
  const parsed = bodySettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Ungültige Einstellungen." };
  const supabase = await createClient();
  const { error } = await supabase.from("user_settings").update({ body_settings: parsed.data }).eq("user_id", user.id);
  if (error) return { ok: false, message: "Die Einstellungen konnten nicht gespeichert werden." };
  revalidateBody();
  return { ok: true };
}
