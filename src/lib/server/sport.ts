import "server-only";
import { cache } from "react";
import { authorName } from "@/lib/domain/community";
import type { ExerciseOption, LibraryExercise, MuscleGroup } from "@/lib/domain/exercises";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

// Sport & Gesundheit, Phase S1: Übungen und Trainingspläne lesen.

type ExerciseRow = Pick<Tables<"exercises">, "id" | "name" | "muscle_group" | "secondary_muscles" | "equipment" | "tracking" | "created_by">;

function toExerciseOption(row: ExerciseRow, userId: string): ExerciseOption {
  return {
    id: row.id,
    name: row.name,
    muscleGroup: row.muscle_group,
    secondaryMuscles: row.secondary_muscles,
    equipment: row.equipment,
    tracking: row.tracking,
    own: row.created_by === userId,
  };
}

const EXERCISE_COLUMNS = "id, name, muscle_group, secondary_muscles, equipment, tracking, created_by";

/** Alle Übungen (Grundbestand und von Nutzern angelegte), für die Auswahl im Editor. */
export async function getExercises(userId: string): Promise<ExerciseOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("exercises").select(EXERCISE_COLUMNS).order("name");
  if (error) throw new Error(`Übungen konnten nicht geladen werden (${error.code})`);
  return data.map((row) => toExerciseOption(row, userId));
}

export type PlanListItem = {
  id: string;
  title: string;
  description: string | null;
  isArchived: boolean;
  isPublic: boolean;
  updatedAt: string;
  days: { id: string; name: string; focus: string | null; exerciseCount: number }[];
};

/** Eigene Pläne mit ihren Tagen (zuletzt geänderte zuerst). */
export async function getTrainingPlans(userId: string): Promise<PlanListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("training_plans")
    .select(
      "id, title, description, is_archived, is_public, updated_at, training_plan_days!training_plan_days_plan_id_fkey(id, name, focus, position, training_plan_exercises!training_plan_exercises_day_id_fkey(id))",
    )
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Trainingspläne konnten nicht geladen werden (${error.code})`);
  return data.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    isArchived: p.is_archived,
    isPublic: p.is_public,
    updatedAt: p.updated_at,
    days: [...p.training_plan_days]
      .sort((a, b) => a.position - b.position)
      .map((d) => ({ id: d.id, name: d.name, focus: d.focus, exerciseCount: d.training_plan_exercises.length })),
  }));
}

export type PlanDetailExercise = {
  id: string;
  exercise: ExerciseOption;
  sets: number;
  repsMin: number | null;
  repsMax: number | null;
  targetSeconds: number | null;
  restSeconds: number | null;
  warmup: boolean;
  note: string | null;
};

export type PlanDetail = {
  id: string;
  title: string;
  description: string | null;
  isArchived: boolean;
  isPublic: boolean;
  isOwn: boolean;
  /** Anzeigename des Besitzers (nie die E-Mail) */
  authorName: string;
  days: { id: string; name: string; focus: string | null; exercises: PlanDetailExercise[] }[];
};

/** Ein Plan mit Tagen und Übungen (eigener oder öffentlicher); null, wenn nicht lesbar. */
export const getTrainingPlan = cache(async (planId: string, userId: string): Promise<PlanDetail | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("training_plans")
    .select(
      `id, title, description, is_archived, is_public, owner_id, profiles!training_plans_owner_id_fkey(display_name), training_plan_days!training_plan_days_plan_id_fkey(id, name, focus, position, training_plan_exercises!training_plan_exercises_day_id_fkey(id, position, sets, reps_min, reps_max, target_seconds, rest_seconds, warmup, note, exercises!training_plan_exercises_exercise_id_fkey(${EXERCISE_COLUMNS})))`,
    )
    .eq("id", planId)
    .maybeSingle();
  if (error) throw new Error(`Trainingsplan konnte nicht geladen werden (${error.code})`);
  if (!data) return null;
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    isArchived: data.is_archived,
    isPublic: data.is_public,
    isOwn: data.owner_id === userId,
    authorName: authorName(data.profiles?.display_name),
    days: [...data.training_plan_days]
      .sort((a, b) => a.position - b.position)
      .map((d) => ({
        id: d.id,
        name: d.name,
        focus: d.focus,
        exercises: [...d.training_plan_exercises]
          .sort((a, b) => a.position - b.position)
          .map((e) => ({
            id: e.id,
            exercise: toExerciseOption(e.exercises, userId),
            sets: e.sets,
            repsMin: e.reps_min,
            repsMax: e.reps_max,
            targetSeconds: e.target_seconds,
            restSeconds: e.rest_seconds,
            warmup: e.warmup,
            note: e.note,
          })),
      })),
  };
});

export type PublicPlanItem = {
  id: string;
  title: string;
  description: string | null;
  authorName: string;
  isOwn: boolean;
  /** Hat der Nutzer schon eine eigene Kopie? */
  copied: boolean;
  updatedAt: string;
  days: { name: string; focus: string | null; exerciseCount: number }[];
  /** Arbeitssätze je Muskelgruppe über alle Tage (für Filter und Schwerpunkt) */
  muscleSets: Partial<Record<MuscleGroup, number>>;
};

/** Öffentliche Pläne aus der Runde (auch eigene, als „von dir“), zuletzt geänderte zuerst. */
export async function getPublicTrainingPlans(userId: string): Promise<PublicPlanItem[]> {
  const supabase = await createClient();
  const [plans, forks] = await Promise.all([
    supabase
      .from("training_plans")
      .select(
        "id, title, description, owner_id, updated_at, profiles!training_plans_owner_id_fkey(display_name), training_plan_days!training_plan_days_plan_id_fkey(name, focus, position, training_plan_exercises!training_plan_exercises_day_id_fkey(sets, exercises!training_plan_exercises_exercise_id_fkey(muscle_group)))",
      )
      .eq("is_public", true)
      .order("updated_at", { ascending: false }),
    supabase.from("training_plans").select("forked_from_id").eq("owner_id", userId).not("forked_from_id", "is", null),
  ]);
  if (plans.error) throw new Error(`Öffentliche Pläne konnten nicht geladen werden (${plans.error.code})`);
  const copied = new Set((forks.data ?? []).map((f) => f.forked_from_id));
  return plans.data.map((p) => {
    const muscleSets: Partial<Record<MuscleGroup, number>> = {};
    for (const d of p.training_plan_days) {
      for (const e of d.training_plan_exercises) muscleSets[e.exercises.muscle_group] = (muscleSets[e.exercises.muscle_group] ?? 0) + e.sets;
    }
    return {
      id: p.id,
      title: p.title,
      description: p.description,
      authorName: authorName(p.profiles?.display_name),
      isOwn: p.owner_id === userId,
      copied: copied.has(p.id),
      updatedAt: p.updated_at,
      days: [...p.training_plan_days]
        .sort((a, b) => a.position - b.position)
        .map((d) => ({ name: d.name, focus: d.focus, exerciseCount: d.training_plan_exercises.length })),
      muscleSets,
    };
  });
}

/** Eigene Kopie eines (fremden) Plans, falls vorhanden. */
export async function getOwnCopyOf(userId: string, planId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("training_plans")
    .select("id")
    .eq("owner_id", userId)
    .eq("forked_from_id", planId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/** Übungsdatenbank: alle Übungen mit Herkunft und wie oft sie in eigenen Plänen bzw. Trainings vorkommen. */
export async function getExerciseLibrary(userId: string): Promise<LibraryExercise[]> {
  const supabase = await createClient();
  const [exercises, planRows, workoutRows] = await Promise.all([
    supabase.from("exercises").select(EXERCISE_COLUMNS).order("name"),
    supabase
      .from("training_plan_exercises")
      .select("exercise_id, training_plan_days!inner(plan_id, training_plans!inner(owner_id))")
      .eq("training_plan_days.training_plans.owner_id", userId),
    // RLS: nur eigene Trainings
    supabase.from("workout_exercises").select("exercise_id, workout_id"),
  ]);
  if (exercises.error) throw new Error(`Übungen konnten nicht geladen werden (${exercises.error.code})`);
  const plans = new Map<string, Set<string>>();
  for (const r of planRows.data ?? []) {
    const set = plans.get(r.exercise_id) ?? new Set<string>();
    set.add(r.training_plan_days.plan_id);
    plans.set(r.exercise_id, set);
  }
  const workouts = new Map<string, Set<string>>();
  for (const r of workoutRows.data ?? []) {
    const set = workouts.get(r.exercise_id) ?? new Set<string>();
    set.add(r.workout_id);
    workouts.set(r.exercise_id, set);
  }
  return exercises.data.map((row) => ({
    ...toExerciseOption(row, userId),
    origin: row.created_by == null ? "seed" : row.created_by === userId ? "own" : "other",
    planCount: plans.get(row.id)?.size ?? 0,
    workoutCount: workouts.get(row.id)?.size ?? 0,
  }));
}
