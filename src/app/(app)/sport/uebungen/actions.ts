"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { flattenIssues } from "@/lib/validation/recipe";
import { exerciseInputSchema, type ExerciseInput } from "@/lib/validation/training-plan";

// Übungsdatenbank im Profilmenü: Übungen ändern und löschen (Anlegen: createExerciseAction bei den Plänen).
// Wer was darf, entscheidet die RLS: eigene Übungen ihr Ersteller, den Grundbestand Admins.

const idSchema = z.uuid();

function revalidateExercises() {
  revalidatePath("/sport/uebungen");
  revalidatePath("/sport/plaene", "layout");
  revalidatePath("/sport/verlauf", "layout");
  revalidatePath("/sport/statistik");
}

export type UpdateExerciseResult = { ok: true } | { ok: false; message?: string; fieldErrors?: Record<string, string[]> };

export async function updateExerciseAction(exerciseId: string, input: ExerciseInput): Promise<UpdateExerciseResult> {
  await requireUser();
  if (!idSchema.safeParse(exerciseId).success) return { ok: false, message: "Ungültige Übung." };
  const parsed = exerciseInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: flattenIssues(parsed.error) };
  const { secondary_muscles, ...rest } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .update({ ...rest, secondary_muscles: secondary_muscles.filter((m) => m !== rest.muscle_group) })
    .eq("id", exerciseId)
    .select("id");
  if (error) {
    if (error.code === "23505") return { ok: false, fieldErrors: { name: ["Eine Übung mit diesem Namen gibt es schon."] } };
    return { ok: false, message: "Die Übung konnte nicht gespeichert werden." };
  }
  if (!data.length) return { ok: false, message: "Diese Übung darfst du nicht ändern." };
  revalidateExercises();
  return { ok: true };
}

export async function deleteExerciseAction(exerciseId: string): Promise<{ ok: boolean; message?: string }> {
  await requireUser();
  if (!idSchema.safeParse(exerciseId).success) return { ok: false, message: "Ungültige Übung." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("exercises").delete().eq("id", exerciseId).select("id");
  if (error) {
    // Übungen in Plänen oder Trainings (auch bei anderen) lassen sich nicht löschen
    if (error.code === "23503") {
      return { ok: false, message: "Die Übung steckt noch in einem Plan oder Training (vielleicht auch bei jemand anderem) und bleibt deshalb." };
    }
    return { ok: false, message: "Die Übung konnte nicht gelöscht werden." };
  }
  if (!data.length) return { ok: false, message: "Diese Übung darfst du nicht löschen." };
  revalidateExercises();
  return { ok: true };
}
