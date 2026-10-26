"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import type { ExerciseOption } from "@/lib/domain/exercises";
import { createClient } from "@/lib/supabase/server";
import { exerciseInputSchema, trainingPlanInputSchema, type ExerciseInput, type TrainingPlanInput } from "@/lib/validation/training-plan";
import { flattenIssues } from "@/lib/validation/recipe";

// Sport & Gesundheit, Phase S1: Trainingspläne und eigene Übungen.

const idSchema = z.uuid();

function revalidatePlans(planId?: string) {
  revalidatePath("/sport/plaene");
  if (planId) revalidatePath(`/sport/plaene/${planId}`);
  revalidatePath("/");
}

export type SavePlanResult = { ok: false; message?: string; fieldErrors?: Record<string, string[]> };

/** Plan mit Tagen und Übungen speichern (atomar per save_training_plan); danach zur Planseite. */
export async function savePlanAction(input: TrainingPlanInput): Promise<SavePlanResult> {
  await requireUser();
  const parsed = trainingPlanInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Bitte prüfe die markierten Felder.", fieldErrors: flattenIssues(parsed.error) };
  const { id, title, description, days } = parsed.data;

  const supabase = await createClient();
  const { data: planId, error } = await supabase.rpc("save_training_plan", {
    p_plan: { id, title, description },
    p_days: days,
  });
  if (error || !planId) {
    if (error?.code === "P0002") return { ok: false, message: "Den Plan gibt es nicht mehr oder er gehört dir nicht." };
    if (error?.code === "23503") return { ok: false, message: "Eine der Übungen gibt es nicht mehr. Bitte tausche sie aus." };
    return { ok: false, message: "Der Plan konnte nicht gespeichert werden. Bitte versuch es noch einmal." };
  }

  revalidatePlans(planId);
  redirect(`/sport/plaene/${planId}`);
}

/** Plan aus- bzw. wieder einblenden (nicht genutzte Pläne stehen zugeklappt unten). */
export async function setPlanArchivedAction(planId: string, archived: boolean): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (!idSchema.safeParse(planId).success) return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("training_plans")
    .update({ is_archived: archived })
    .eq("id", planId)
    .eq("owner_id", user.id)
    .select("id");
  revalidatePlans(planId);
  return { ok: !error && Boolean(data?.length) };
}

/** Eigenen Plan kopieren und die Kopie gleich bearbeiten. */
export async function duplicatePlanAction(planId: string): Promise<{ ok: false; message: string }> {
  await requireUser();
  if (!idSchema.safeParse(planId).success) return { ok: false, message: "Ungültiger Plan." };
  const supabase = await createClient();
  const { data: source } = await supabase.from("training_plans").select("title").eq("id", planId).maybeSingle();
  const { data: newId, error } = await supabase.rpc("copy_training_plan", {
    p_plan_id: planId,
    p_title: source ? `${source.title} (Kopie)` : undefined,
  });
  if (error || !newId) return { ok: false, message: "Der Plan konnte nicht kopiert werden." };
  revalidatePlans();
  redirect(`/sport/plaene/${newId}/bearbeiten`);
}

export async function deletePlanAction(planId: string): Promise<{ ok: false; message: string }> {
  const user = await requireUser();
  if (!idSchema.safeParse(planId).success) return { ok: false, message: "Ungültiger Plan." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("training_plans").delete().eq("id", planId).eq("owner_id", user.id).select("id");
  if (error || !data?.length) return { ok: false, message: "Der Plan konnte nicht gelöscht werden." };
  revalidatePlans();
  redirect("/sport/plaene");
}

export type CreateExerciseResult = { ok: true; exercise: ExerciseOption } | { ok: false; message?: string; fieldErrors?: Record<string, string[]> };

/** Eigene Übung anlegen (steht danach allen zur Auswahl, ändern kann sie nur, wer sie angelegt hat). */
export async function createExerciseAction(input: ExerciseInput): Promise<CreateExerciseResult> {
  const user = await requireUser();
  const parsed = exerciseInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: flattenIssues(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .insert({ ...parsed.data, created_by: user.id })
    .select("id, name, muscle_group, secondary_muscles, equipment, tracking")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, fieldErrors: { name: ["Eine Übung mit diesem Namen hast du schon."] } };
    return { ok: false, message: "Die Übung konnte nicht angelegt werden." };
  }
  return {
    ok: true,
    exercise: {
      id: data.id,
      name: data.name,
      muscleGroup: data.muscle_group,
      secondaryMuscles: data.secondary_muscles,
      equipment: data.equipment,
      tracking: data.tracking,
      own: true,
    },
  };
}
