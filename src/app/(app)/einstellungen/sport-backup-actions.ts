"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  planDaysForSave,
  resolveSportExercises,
  sportBackupFileSchema,
  workoutPayloadFromBackup,
  type SportBackupFileInput,
} from "@/lib/domain/sport-backup";
import { normalizeSearch } from "@/lib/domain/exercises";
import { uuid } from "@/lib/domain/workout";
import { getTrainingPlans } from "@/lib/server/sport";
import { createClient } from "@/lib/supabase/server";

export type ImportSportBackupResult =
  | { ok: true; imported: number; skipped: number; createdExercises: number; importedWorkouts: number; skippedWorkouts: number }
  | { ok: false; message: string };

/**
 * Sport-Sicherung einspielen: fehlende Übungen als eigene anlegen, dann jeden Plan als neuen eigenen Plan speichern.
 * Pläne, deren Name es bei dir schon gibt, werden übersprungen (erneutes Einspielen derselben Datei verdoppelt nichts).
 * Ab Version 2 auch Trainings; Trainings mit derselben Startzeit wie ein vorhandenes werden übersprungen.
 */
export async function importSportBackupAction(input: SportBackupFileInput): Promise<ImportSportBackupResult> {
  const user = await requireUser();
  const parsed = sportBackupFileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Die Datei ist keine gültige Sport-Sicherung." };
  const backup = parsed.data;
  const supabase = await createClient();

  const [existing, ownPlans] = await Promise.all([
    supabase.from("exercises").select("id, name, created_by"),
    supabase.from("training_plans").select("title").eq("owner_id", user.id),
  ]);
  if (existing.error || ownPlans.error) return { ok: false, message: "Deine Übungen und Pläne konnten nicht geprüft werden." };

  const { mapping, toCreate } = resolveSportExercises(
    backup,
    existing.data.map((e) => ({ id: e.id, name: e.name, own: e.created_by === user.id })),
  );
  if (toCreate.length) {
    const { data, error } = await supabase
      .from("exercises")
      .insert(toCreate.map((e) => ({ ...e, created_by: user.id })))
      .select("id, name");
    if (error) return { ok: false, message: "Fehlende Übungen konnten nicht angelegt werden." };
    for (const e of data) mapping.set(normalizeSearch(e.name), e.id);
  }

  const taken = new Set(ownPlans.data.map((p) => p.title.trim().toLocaleLowerCase("de")));
  let imported = 0;
  let skipped = 0;
  for (const plan of backup.plans) {
    if (taken.has(plan.title.trim().toLocaleLowerCase("de"))) {
      skipped++;
      continue;
    }
    const { data: planId, error } = await supabase.rpc("save_training_plan", {
      p_plan: { id: null, title: plan.title, description: plan.description ?? "" },
      p_days: planDaysForSave(plan, mapping),
    });
    if (error || !planId) {
      skipped++;
      continue;
    }
    if (plan.is_archived) await supabase.from("training_plans").update({ is_archived: true }).eq("id", planId);
    taken.add(plan.title.trim().toLocaleLowerCase("de"));
    imported++;
  }

  // Trainings: Plan und Tag über die Namen (inkl. der eben importierten Pläne)
  let importedWorkouts = 0;
  let skippedWorkouts = 0;
  if (backup.workouts.length) {
    const [plans, existingWorkouts] = await Promise.all([
      getTrainingPlans(user.id),
      supabase.from("workouts").select("started_at").eq("user_id", user.id),
    ]);
    const seen = new Set((existingWorkouts.data ?? []).map((w) => new Date(w.started_at).getTime()));
    for (const workout of backup.workouts) {
      const start = new Date(workout.started_at).getTime();
      if (seen.has(start)) {
        skippedWorkouts++;
        continue;
      }
      const { error } = await supabase.rpc("sync_workout", { p_workout: workoutPayloadFromBackup(workout, mapping, plans, uuid) });
      if (error) {
        skippedWorkouts++;
        continue;
      }
      seen.add(start);
      importedWorkouts++;
    }
  }

  revalidatePath("/sport/plaene");
  revalidatePath("/sport/verlauf");
  revalidatePath("/");
  return { ok: true, imported, skipped, createdExercises: toCreate.length, importedWorkouts, skippedWorkouts };
}
