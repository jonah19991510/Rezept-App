import "server-only";
import { cache } from "react";
import type { ExerciseOption } from "@/lib/domain/exercises";
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
  days: { id: string; name: string; focus: string | null; exercises: PlanDetailExercise[] }[];
};

/** Ein Plan mit Tagen und Übungen (eigener oder öffentlicher); null, wenn nicht lesbar. */
export const getTrainingPlan = cache(async (planId: string, userId: string): Promise<PlanDetail | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("training_plans")
    .select(
      `id, title, description, is_archived, is_public, owner_id, training_plan_days!training_plan_days_plan_id_fkey(id, name, focus, position, training_plan_exercises!training_plan_exercises_day_id_fkey(id, position, sets, reps_min, reps_max, target_seconds, rest_seconds, warmup, note, exercises!training_plan_exercises_exercise_id_fkey(${EXERCISE_COLUMNS})))`,
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
