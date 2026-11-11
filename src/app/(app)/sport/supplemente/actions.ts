"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { servingsPerPack, servingText, type SupplementForm } from "@/lib/domain/supplements";
import { todayInBerlin } from "@/lib/domain/week";
import { createClient } from "@/lib/supabase/server";
import { bloodTestInputSchema, supplementInputSchema, type BloodTestInput, type SupplementInput } from "@/lib/validation/health";
import { flattenIssues } from "@/lib/validation/recipe";

// Supplemente und Bluttests speichern. Wer was darf, entscheidet die RLS (nur eigene Einträge).

const idSchema = z.uuid();

export type HealthResult = { ok: true } | { ok: false; message?: string; fieldErrors?: Record<string, string[]> };

function invalid(error: z.ZodError): HealthResult {
  return { ok: false, message: error.issues[0]?.message ?? "Bitte prüfe die Eingaben.", fieldErrors: flattenIssues(error) };
}

export async function saveSupplementAction(id: string | null, input: SupplementInput): Promise<HealthResult> {
  const user = await requireUser();
  if (id && !idSchema.safeParse(id).success) return { ok: false, message: "Ungültiges Supplement." };
  const parsed = supplementInputSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const servings = servingsPerPack(d.packAmount, d.servingAmount);
  const row = {
    name: d.name,
    brand: d.brand,
    form: d.form,
    pack_amount: d.packAmount,
    serving_amount: d.servingAmount,
    // berechnet bzw. Anzeige-Text, damit Export und ältere Stände lesbar bleiben
    servings_per_pack: servings != null ? Math.min(10000, Math.max(0.1, Math.round(servings * 10) / 10)) : null,
    serving_label: servingText({ form: d.form as SupplementForm, servingAmount: d.servingAmount }).slice(0, 40),
    price_eur: d.priceEur,
    shop: d.shop,
    servings_per_day: d.servingsPerDay,
    active: d.active,
    ingredients: d.ingredients,
    note: d.note,
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("supplements").update(row).eq("id", id).eq("user_id", user.id)
    : await supabase.from("supplements").insert({ ...row, user_id: user.id });
  if (error) return { ok: false, message: "Das Supplement konnte nicht gespeichert werden." };
  revalidatePath("/sport/supplemente");
  return { ok: true };
}

export async function setSupplementActiveAction(id: string, active: boolean): Promise<HealthResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Ungültiges Supplement." };
  const supabase = await createClient();
  const { error } = await supabase.from("supplements").update({ active: Boolean(active) }).eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, message: "Das ging gerade nicht." };
  revalidatePath("/sport/supplemente");
  return { ok: true };
}

export async function deleteSupplementAction(id: string): Promise<HealthResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Ungültiges Supplement." };
  const supabase = await createClient();
  const { error } = await supabase.from("supplements").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, message: "Das Supplement konnte nicht gelöscht werden." };
  revalidatePath("/sport/supplemente");
  return { ok: true };
}

export async function saveBloodTestAction(id: string | null, input: BloodTestInput): Promise<HealthResult> {
  const user = await requireUser();
  if (id && !idSchema.safeParse(id).success) return { ok: false, message: "Ungültiger Bluttest." };
  const parsed = bloodTestInputSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  if (d.date > todayInBerlin()) return { ok: false, fieldErrors: { date: ["Das Datum liegt in der Zukunft."] } };
  const row = { taken_on: d.date, lab: d.lab, note: d.note, results: d.values };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("blood_tests").update(row).eq("id", id).eq("user_id", user.id)
    : await supabase.from("blood_tests").insert({ ...row, user_id: user.id });
  if (error) return { ok: false, message: "Der Bluttest konnte nicht gespeichert werden." };
  revalidatePath("/sport/supplemente/blutwerte");
  return { ok: true };
}

export async function deleteBloodTestAction(id: string): Promise<HealthResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Ungültiger Bluttest." };
  const supabase = await createClient();
  const { error } = await supabase.from("blood_tests").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, message: "Der Bluttest konnte nicht gelöscht werden." };
  revalidatePath("/sport/supplemente/blutwerte");
  return { ok: true };
}
