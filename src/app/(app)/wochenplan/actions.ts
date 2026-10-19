"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { cookedServings } from "@/lib/domain/mealprep";
import type { MealSlot } from "@/lib/domain/plan";
import { isTrainingDay } from "@/lib/domain/training";
import { createClient } from "@/lib/supabase/server";
import { flattenIssues } from "@/lib/validation/recipe";
import {
  addLeftoverSchema,
  addPlanEntrySchema,
  copyWeekSchema,
  deletePlanEntrySchema,
  trainingDaySchema,
  updatePlanEntrySchema,
} from "@/lib/validation/plan";
import type { z } from "zod";

export type PlanActionResult = { ok: true; message?: string } | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

function invalid(error: z.ZodError): PlanActionResult {
  return { ok: false, message: "Bitte prüfe die Eingaben.", fieldErrors: flattenIssues(error) };
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Nächste freie Position je Tag im Slot (neue Einträge kommen ans Ende). */
async function nextPositions(supabase: Supabase, userId: string, dates: string[], slot: MealSlot): Promise<Record<string, number>> {
  const { data } = await supabase.from("meal_plan_entries").select("date").eq("user_id", userId).eq("slot", slot).in("date", dates);
  const result: Record<string, number> = Object.fromEntries(dates.map((d) => [d, 0]));
  for (const row of data ?? []) result[row.date] = (result[row.date] ?? 0) + 1;
  return result;
}

/** Gekochte Portionen eines Batches anheben, falls inzwischen mehr eingeplant ist. */
async function syncBatchServings(supabase: Supabase, userId: string, batchId: string) {
  const [{ data: batch }, { data: entries }] = await Promise.all([
    supabase.from("meal_prep_batches").select("servings_cooked").eq("id", batchId).eq("user_id", userId).maybeSingle(),
    supabase.from("meal_plan_entries").select("servings").eq("batch_id", batchId).eq("user_id", userId),
  ]);
  if (!batch || !entries) return;
  const cooked = cookedServings(batch.servings_cooked, entries.map((e) => e.servings));
  if (cooked !== batch.servings_cooked) {
    await supabase.from("meal_prep_batches").update({ servings_cooked: cooked }).eq("id", batchId).eq("user_id", userId);
  }
}

/**
 * Rezept einplanen. Mit `prepDates` als Meal Prep: ein Batch, der Eintrag am gewählten Tag ist der Kochtag,
 * an den weiteren Tagen (gleicher Slot) stehen Reste.
 */
export async function addPlanEntryAction(input: z.input<typeof addPlanEntrySchema>): Promise<PlanActionResult> {
  const user = await requireUser();
  const parsed = addPlanEntrySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { date, slot, recipe_id, servings, prepDates = [], servingsCooked } = parsed.data;

  const supabase = await createClient();
  const positions = await nextPositions(supabase, user.id, [date, ...prepDates], slot);

  if (prepDates.length === 0) {
    const { error } = await supabase
      .from("meal_plan_entries")
      .insert({ user_id: user.id, date, slot, recipe_id, servings, position: positions[date] });
    // RLS lehnt Rezepte ab, die der Nutzer nicht lesen darf
    if (error) return { ok: false, message: "Das Rezept konnte nicht eingeplant werden." };
    revalidatePath("/wochenplan");
    return { ok: true };
  }

  const planned = Array(prepDates.length + 1).fill(servings) as number[];
  const { data: batch, error: batchError } = await supabase
    .from("meal_prep_batches")
    .insert({ user_id: user.id, recipe_id, cook_date: date, servings_cooked: cookedServings(servingsCooked ?? 0, planned) })
    .select("id")
    .single();
  if (batchError) return { ok: false, message: "Das Rezept konnte nicht eingeplant werden." };

  const { error } = await supabase.from("meal_plan_entries").insert(
    [date, ...prepDates].map((d, i) => ({
      user_id: user.id,
      date: d,
      slot,
      recipe_id,
      servings,
      position: positions[d],
      batch_id: batch.id,
      is_leftover: i > 0,
    })),
  );
  if (error) {
    await supabase.from("meal_prep_batches").delete().eq("id", batch.id).eq("user_id", user.id);
    return { ok: false, message: "Das Rezept konnte nicht eingeplant werden." };
  }

  revalidatePath("/wochenplan");
  return { ok: true, message: `Meal Prep eingeplant: Reste an ${prepDates.length} ${prepDates.length === 1 ? "Tag" : "Tagen"}.` };
}

/** Übrige Portionen eines Meal-Prep-Batches als Reste einplanen. */
export async function addLeftoverAction(input: z.input<typeof addLeftoverSchema>): Promise<PlanActionResult> {
  const user = await requireUser();
  const parsed = addLeftoverSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { batchId, date, slot, servings } = parsed.data;

  const supabase = await createClient();
  const { data: batch } = await supabase
    .from("meal_prep_batches")
    .select("recipe_id, cook_date")
    .eq("id", batchId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!batch) return { ok: false, message: "Dieses Meal Prep gibt es nicht mehr." };
  if (date < batch.cook_date) return { ok: false, message: "Reste gibt es erst ab dem Kochtag." };

  const positions = await nextPositions(supabase, user.id, [date], slot);
  const { error } = await supabase.from("meal_plan_entries").insert({
    user_id: user.id,
    date,
    slot,
    recipe_id: batch.recipe_id,
    servings,
    position: positions[date],
    batch_id: batchId,
    is_leftover: true,
  });
  if (error) return { ok: false, message: "Die Reste konnten nicht eingeplant werden." };
  await syncBatchServings(supabase, user.id, batchId);

  revalidatePath("/wochenplan");
  return { ok: true, message: "Reste eingeplant." };
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
    .select("batch_id, is_leftover");
  if (error || !data?.length) return { ok: false, message: "Der Eintrag konnte nicht geändert werden." };

  const { batch_id, is_leftover } = data[0];
  if (batch_id) {
    // Kochtag verschoben: Batch zieht mit; mehr Portionen eingeplant: mehr kochen
    if (!is_leftover) await supabase.from("meal_prep_batches").update({ cook_date: date }).eq("id", batch_id).eq("user_id", user.id);
    await syncBatchServings(supabase, user.id, batch_id);
  }

  revalidatePath("/wochenplan");
  return { ok: true };
}

/** Eintrag entfernen. Der Kochtag eines Meal Preps nimmt den ganzen Batch mit allen Resten mit. */
export async function deletePlanEntryAction(input: z.input<typeof deletePlanEntrySchema>): Promise<PlanActionResult> {
  const user = await requireUser();
  const parsed = deletePlanEntrySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("meal_plan_entries")
    .select("batch_id, is_leftover")
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!entry) return { ok: false, message: "Der Eintrag konnte nicht entfernt werden." };

  const { error } =
    entry.batch_id && !entry.is_leftover
      ? await supabase.from("meal_prep_batches").delete().eq("id", entry.batch_id).eq("user_id", user.id)
      : await supabase.from("meal_plan_entries").delete().eq("id", parsed.data.id).eq("user_id", user.id);
  if (error) return { ok: false, message: "Der Eintrag konnte nicht entfernt werden." };

  revalidatePath("/wochenplan");
  return { ok: true, message: entry.batch_id && !entry.is_leftover ? "Meal Prep mit allen Resten entfernt." : undefined };
}

/**
 * Tag als Trainingstag an- oder abschalten. Entspricht der Wunsch dem Standard aus den Einstellungen,
 * wird die Ausnahme gelöscht, damit spätere Änderungen am Standard wieder greifen.
 */
export async function setTrainingDayAction(input: z.input<typeof trainingDaySchema>): Promise<PlanActionResult> {
  const user = await requireUser();
  const parsed = trainingDaySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { date, training } = parsed.data;

  const supabase = await createClient();
  const { data: settings } = await supabase.from("user_settings").select("training_weekdays").eq("user_id", user.id).maybeSingle();
  const isDefault = isTrainingDay(date, settings?.training_weekdays ?? [], {}) === training;
  const { error } = isDefault
    ? await supabase.from("plan_days").delete().eq("user_id", user.id).eq("date", date)
    : await supabase.from("plan_days").upsert({ user_id: user.id, date, is_training_day: training }, { onConflict: "user_id,date" });
  if (error) return { ok: false, message: "Der Tag konnte nicht umgestellt werden." };

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
