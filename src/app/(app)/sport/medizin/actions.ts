"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { sortTemperatures } from "@/lib/domain/medical";
import { todayInBerlin } from "@/lib/domain/week";
import { createClient } from "@/lib/supabase/server";
import {
  checkupInputSchema,
  checkupVisitInputSchema,
  medicationInputSchema,
  sickEpisodeInputSchema,
  temperatureSchema,
  type CheckupInput,
  type CheckupVisitInput,
  type MedicationInput,
  type SickEpisodeInput,
} from "@/lib/validation/health";
import { flattenIssues } from "@/lib/validation/recipe";

// Krankheitstage, Medikamente und Vorsorge speichern. Wer was darf, entscheidet die RLS (nur eigene Einträge).

const idSchema = z.uuid();

export type MedicalResult = { ok: true } | { ok: false; message?: string; fieldErrors?: Record<string, string[]> };

function invalid(error: z.ZodError): MedicalResult {
  return { ok: false, message: error.issues[0]?.message ?? "Bitte prüfe die Eingaben.", fieldErrors: flattenIssues(error) };
}

function revalidateMedical() {
  revalidatePath("/sport/medizin", "layout");
}

// ---------------------------------------------------------------------------
// Krankheitstage
// ---------------------------------------------------------------------------

export async function saveSickEpisodeAction(id: string | null, input: SickEpisodeInput): Promise<MedicalResult> {
  const user = await requireUser();
  if (id && !idSchema.safeParse(id).success) return { ok: false, message: "Ungültiger Eintrag." };
  const parsed = sickEpisodeInputSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  if (d.start > todayInBerlin()) return { ok: false, fieldErrors: { start: ["Der Beginn liegt in der Zukunft."] } };
  const row = {
    title: d.title,
    started_on: d.start,
    ended_on: d.end,
    symptoms: [...new Set(d.symptoms.filter(Boolean))],
    sick_note: d.sickNote,
    temperatures: sortTemperatures(d.temperatures),
    note: d.note,
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("sick_episodes").update(row).eq("id", id).eq("user_id", user.id)
    : await supabase.from("sick_episodes").insert({ ...row, user_id: user.id });
  if (error) return { ok: false, message: "Der Eintrag konnte nicht gespeichert werden." };
  revalidateMedical();
  return { ok: true };
}

/** Wieder gesund: Ende auf heute (bzw. den Beginn, falls der in der Zukunft läge). */
export async function endSickEpisodeAction(id: string, end: string): Promise<MedicalResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success || !z.iso.date().safeParse(end).success) return { ok: false, message: "Ungültiger Eintrag." };
  const supabase = await createClient();
  const { data } = await supabase.from("sick_episodes").select("started_on").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!data) return { ok: false, message: "Den Eintrag gibt es nicht mehr." };
  const { error } = await supabase
    .from("sick_episodes")
    .update({ ended_on: end < data.started_on ? data.started_on : end })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, message: "Das ging gerade nicht." };
  revalidateMedical();
  return { ok: true };
}

/** Fieber messen: eine Messung an eine Krankheit anhängen. */
export async function addTemperatureAction(id: string, input: z.input<typeof temperatureSchema>): Promise<MedicalResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Ungültiger Eintrag." };
  const parsed = temperatureSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data } = await supabase.from("sick_episodes").select("temperatures").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!data) return { ok: false, message: "Den Eintrag gibt es nicht mehr." };
  const list = Array.isArray(data.temperatures) ? (data.temperatures as z.infer<typeof temperatureSchema>[]) : [];
  if (list.length >= 100) return { ok: false, message: "Höchstens 100 Messungen." };
  const { error } = await supabase
    .from("sick_episodes")
    .update({ temperatures: sortTemperatures([...list, parsed.data]) })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, message: "Die Messung konnte nicht gespeichert werden." };
  revalidateMedical();
  return { ok: true };
}

export async function deleteSickEpisodeAction(id: string): Promise<MedicalResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Ungültiger Eintrag." };
  const supabase = await createClient();
  const { error } = await supabase.from("sick_episodes").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, message: "Der Eintrag konnte nicht gelöscht werden." };
  revalidateMedical();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Medikamente
// ---------------------------------------------------------------------------

export async function saveMedicationAction(id: string | null, input: MedicationInput): Promise<MedicalResult> {
  const user = await requireUser();
  if (id && !idSchema.safeParse(id).success) return { ok: false, message: "Ungültiger Eintrag." };
  const parsed = medicationInputSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  if (d.date > todayInBerlin()) return { ok: false, fieldErrors: { date: ["Das Datum liegt in der Zukunft."] } };
  const row = { name: d.name, dose: d.dose, taken_on: d.date, taken_time: d.time, reason: d.reason, episode_id: d.episodeId, note: d.note };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("medication_intakes").update(row).eq("id", id).eq("user_id", user.id)
    : await supabase.from("medication_intakes").insert({ ...row, user_id: user.id });
  if (error) return { ok: false, message: "Die Einnahme konnte nicht gespeichert werden." };
  revalidateMedical();
  return { ok: true };
}

export async function deleteMedicationAction(id: string): Promise<MedicalResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Ungültiger Eintrag." };
  const supabase = await createClient();
  const { error } = await supabase.from("medication_intakes").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, message: "Die Einnahme konnte nicht gelöscht werden." };
  revalidateMedical();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Vorsorge
// ---------------------------------------------------------------------------

export async function saveCheckupAction(id: string | null, input: CheckupInput): Promise<MedicalResult> {
  const user = await requireUser();
  if (id && !idSchema.safeParse(id).success) return { ok: false, message: "Ungültiger Eintrag." };
  const parsed = checkupInputSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const row = { name: d.name, doctor: d.doctor, interval_months: d.intervalMonths, next_on: d.nextOn, note: d.note };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("checkups").update(row).eq("id", id).eq("user_id", user.id)
    : await supabase.from("checkups").insert({ ...row, user_id: user.id });
  if (error) return { ok: false, message: "Die Vorsorge konnte nicht gespeichert werden." };
  revalidateMedical();
  return { ok: true };
}

export async function deleteCheckupAction(id: string): Promise<MedicalResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Ungültiger Eintrag." };
  const supabase = await createClient();
  const { error } = await supabase.from("checkups").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, message: "Die Vorsorge konnte nicht gelöscht werden." };
  revalidateMedical();
  return { ok: true };
}

/**
 * Besuch eintragen („War beim Termin“). Ein ausgemachter Termin an oder vor diesem Tag ist damit erledigt und wird
 * geleert; optional gleich den nächsten Termin festhalten.
 */
export async function addCheckupVisitAction(checkupId: string, input: CheckupVisitInput, nextOn: string | null): Promise<MedicalResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(checkupId).success) return { ok: false, message: "Ungültiger Eintrag." };
  const parsed = checkupVisitInputSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (parsed.data.date > todayInBerlin()) return { ok: false, fieldErrors: { date: ["Das Datum liegt in der Zukunft."] } };
  if (nextOn != null && (!z.iso.date().safeParse(nextOn).success || nextOn <= parsed.data.date)) {
    return { ok: false, fieldErrors: { nextOn: ["Der nächste Termin muss nach dem Besuch liegen."] } };
  }
  const supabase = await createClient();
  const { data: checkup } = await supabase.from("checkups").select("next_on").eq("id", checkupId).eq("user_id", user.id).maybeSingle();
  if (!checkup) return { ok: false, message: "Die Vorsorge gibt es nicht mehr." };
  const { error } = await supabase.from("checkup_visits").insert({ checkup_id: checkupId, user_id: user.id, visited_on: parsed.data.date, note: parsed.data.note });
  if (error) return { ok: false, message: "Der Besuch konnte nicht gespeichert werden." };
  const done = checkup.next_on != null && checkup.next_on <= parsed.data.date;
  if (nextOn != null || done) {
    await supabase.from("checkups").update({ next_on: nextOn }).eq("id", checkupId).eq("user_id", user.id);
  }
  revalidateMedical();
  return { ok: true };
}

export async function deleteCheckupVisitAction(id: string): Promise<MedicalResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Ungültiger Eintrag." };
  const supabase = await createClient();
  const { error } = await supabase.from("checkup_visits").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, message: "Der Besuch konnte nicht gelöscht werden." };
  revalidateMedical();
  return { ok: true };
}
