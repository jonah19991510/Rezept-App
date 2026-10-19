"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { flattenIssues } from "@/lib/validation/recipe";
import {
  addPlanEntrySchema,
  copyWeekSchema,
  deletePlanEntrySchema,
  updatePlanEntrySchema,
} from "@/lib/validation/plan";
import type { z } from "zod";

export type PlanActionResult = { ok: true; message?: string } | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

function invalid(error: z.ZodError): PlanActionResult {
  return { ok: false, message: "Bitte prüfe die Eingaben.", fieldErrors: flattenIssues(error) };
}

export async function addPlanEntryAction(input: z.input<typeof addPlanEntrySchema>): Promise<PlanActionResult> {
  const user = await requireUser();
  const parsed = addPlanEntrySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { date, slot, recipe_id, servings } = parsed.data;

  const supabase = await createClient();
  // Neuer Eintrag ans Ende des Slots
  const { count } = await supabase
    .from("meal_plan_entries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("date", date)
    .eq("slot", slot);

  const { error } = await supabase
    .from("meal_plan_entries")
    .insert({ user_id: user.id, date, slot, recipe_id, servings, position: count ?? 0 });
  // RLS lehnt Rezepte ab, die der Nutzer nicht lesen darf
  if (error) return { ok: false, message: "Das Rezept konnte nicht eingeplant werden." };

  revalidatePath("/wochenplan");
  return { ok: true };
}

export async function updatePlanEntryAction(input: z.input<typeof updatePlanEntrySchema>): Promise<PlanActionResult> {
  const user = await requireUser();
  const parsed = updatePlanEntrySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, servings, date, slot } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_plan_entries")
    .update({ servings, date, slot })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");
  if (error || !data?.length) return { ok: false, message: "Der Eintrag konnte nicht geändert werden." };

  revalidatePath("/wochenplan");
  return { ok: true };
}

export async function deletePlanEntryAction(input: z.input<typeof deletePlanEntrySchema>): Promise<PlanActionResult> {
  const user = await requireUser();
  const parsed = deletePlanEntrySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("meal_plan_entries").delete().eq("id", parsed.data.id).eq("user_id", user.id);
  if (error) return { ok: false, message: "Der Eintrag konnte nicht entfernt werden." };

  revalidatePath("/wochenplan");
  return { ok: true };
}

/**
 * Woche kopieren (Datenbankfunktion copy_plan_week, eine Transaktion).
 * replace = vorhandene Einträge der Zielwoche vorher löschen, sonst ergänzen.
 */
export async function copyWeekAction(input: z.input<typeof copyWeekSchema>): Promise<PlanActionResult> {
  await requireUser();
  const parsed = copyWeekSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { fromMonday, toMonday, replace } = parsed.data;

  const supabase = await createClient();
  const { data: count, error } = await supabase.rpc("copy_plan_week", {
    p_from_monday: fromMonday,
    p_to_monday: toMonday,
    p_replace: replace,
  });
  if (error) return { ok: false, message: "Die Woche konnte nicht kopiert werden." };
  if (!count) return { ok: false, message: "In dieser Woche ist nichts geplant, das man kopieren könnte." };

  revalidatePath("/wochenplan");
  return { ok: true, message: `${count} ${count === 1 ? "Eintrag" : "Einträge"} kopiert.` };
}
