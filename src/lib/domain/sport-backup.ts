import { z } from "zod";
import { Constants } from "@/lib/supabase/database.types";
import { normalizeSearch, type Equipment, type MuscleGroup, type Tracking } from "./exercises";

// Sport-Sicherung (26.10.2026): eigene Trainingspläne und eigene Übungen als JSON-Datei, die sich wieder importieren
// lässt. Übungen stehen mit Namen UND Eckdaten drin: Beim Import wird nach dem Namen gesucht (Grundbestand und eigene),
// fehlt eine Übung, wird sie als eigene Übung angelegt. Trainings (Phase S2) kommen mit Version 2 dazu.

export const SPORT_BACKUP_FORMAT = "rezeptbuch-sport";
export const SPORT_BACKUP_VERSION = 1;
export const MAX_SPORT_BACKUP_PLANS = 100;

export const sportBackupExerciseSchema = z.object({
  name: z.string().trim().min(1).max(80),
  muscle_group: z.enum(Constants.public.Enums.muscle_group),
  secondary_muscles: z.array(z.enum(Constants.public.Enums.muscle_group)).max(14).default([]),
  equipment: z.enum(Constants.public.Enums.exercise_equipment),
  tracking: z.enum(Constants.public.Enums.exercise_tracking),
});

const optionalInt = (min: number, max: number) => z.number().int().min(min).max(max).nullable();

export const sportBackupPlanSchema = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().max(1000).nullable(),
  is_archived: z.boolean().default(false),
  days: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        focus: z.string().max(60).nullable(),
        exercises: z
          .array(
            z.object({
              exercise: sportBackupExerciseSchema,
              sets: z.number().int().min(1).max(20),
              reps_min: optionalInt(1, 100),
              reps_max: optionalInt(1, 100),
              target_seconds: optionalInt(1, 36000),
              rest_seconds: optionalInt(0, 900),
              warmup: z.boolean().default(false),
              note: z.string().max(200).nullable(),
            }),
          )
          .max(40),
      }),
    )
    .min(1)
    .max(14),
});

export const sportBackupFileSchema = z.object({
  format: z.literal(SPORT_BACKUP_FORMAT, { error: "Das ist keine Sport-Sicherung aus dieser App." }),
  version: z.literal(SPORT_BACKUP_VERSION, { error: "Diese Sicherung stammt aus einer anderen Version der App." }),
  exported_at: z.string().max(40),
  own_exercises: z.array(sportBackupExerciseSchema).max(500).default([]),
  plans: z.array(sportBackupPlanSchema).max(MAX_SPORT_BACKUP_PLANS, `Höchstens ${MAX_SPORT_BACKUP_PLANS} Pläne auf einmal.`),
});

export type SportBackupExercise = z.infer<typeof sportBackupExerciseSchema>;
export type SportBackupPlan = z.infer<typeof sportBackupPlanSchema>;
export type SportBackupFile = z.infer<typeof sportBackupFileSchema>;
export type SportBackupFileInput = z.input<typeof sportBackupFileSchema>;

/** Plan aus der Datenbank (mit Tagen und Übungen samt Übungsdaten), wie ihn der Export liest. */
export type PlanRowForBackup = {
  title: string;
  description: string | null;
  is_archived: boolean;
  training_plan_days: {
    position: number;
    name: string;
    focus: string | null;
    training_plan_exercises: {
      position: number;
      sets: number;
      reps_min: number | null;
      reps_max: number | null;
      target_seconds: number | null;
      rest_seconds: number | null;
      warmup: boolean;
      note: string | null;
      exercises: { name: string; muscle_group: MuscleGroup; secondary_muscles: MuscleGroup[]; equipment: Equipment; tracking: Tracking };
    }[];
  }[];
};

export function toSportBackupFile(plans: PlanRowForBackup[], ownExercises: SportBackupExercise[], now: Date): SportBackupFile {
  return {
    format: SPORT_BACKUP_FORMAT,
    version: SPORT_BACKUP_VERSION,
    exported_at: now.toISOString(),
    own_exercises: ownExercises,
    plans: plans.map((p) => ({
      title: p.title,
      description: p.description,
      is_archived: p.is_archived,
      days: [...p.training_plan_days]
        .sort((a, b) => a.position - b.position)
        .map((d) => ({
          name: d.name,
          focus: d.focus,
          exercises: [...d.training_plan_exercises]
            .sort((a, b) => a.position - b.position)
            .map(({ exercises: x, ...e }) => ({
              sets: e.sets,
              reps_min: e.reps_min,
              reps_max: e.reps_max,
              target_seconds: e.target_seconds,
              rest_seconds: e.rest_seconds,
              warmup: e.warmup,
              note: e.note,
              exercise: {
                name: x.name,
                muscle_group: x.muscle_group,
                secondary_muscles: x.secondary_muscles,
                equipment: x.equipment,
                tracking: x.tracking,
              },
            })),
        })),
    })),
  };
}

const exerciseKey = (name: string) => normalizeSearch(name);

/**
 * Übungen der Sicherung vorhandenen zuordnen (gleicher Name, Groß-/Kleinschreibung und Umlaute egal; eigene vor dem
 * Grundbestand). Was fehlt, muss als eigene Übung angelegt werden (je Name nur einmal).
 */
export function resolveSportExercises(
  backup: SportBackupFile,
  existing: { id: string; name: string; own: boolean }[],
): { mapping: Map<string, string>; toCreate: SportBackupExercise[] } {
  const byName = new Map<string, string>();
  // Grundbestand zuerst eintragen, eigene überschreiben ihn
  for (const e of [...existing].sort((a, b) => Number(a.own) - Number(b.own))) byName.set(exerciseKey(e.name), e.id);
  const mapping = new Map<string, string>();
  const toCreate = new Map<string, SportBackupExercise>();
  const wanted = [...backup.own_exercises, ...backup.plans.flatMap((p) => p.days.flatMap((d) => d.exercises.map((e) => e.exercise)))];
  for (const exercise of wanted) {
    const k = exerciseKey(exercise.name);
    if (mapping.has(k) || toCreate.has(k)) continue;
    if (byName.has(k)) mapping.set(k, byName.get(k)!);
    else toCreate.set(k, exercise);
  }
  return { mapping, toCreate: [...toCreate.values()] };
}

/** ID einer Übung der Sicherung nach dem Zuordnen (bzw. Anlegen). */
export function exerciseIdFor(mapping: Map<string, string>, exercise: { name: string }): string | undefined {
  return mapping.get(exerciseKey(exercise.name));
}

/** Eingabe für save_training_plan aus einem Plan der Sicherung. */
export function planDaysForSave(plan: SportBackupPlan, mapping: Map<string, string>) {
  return plan.days.map((d) => ({
    id: null,
    name: d.name,
    focus: d.focus ?? "",
    exercises: d.exercises.flatMap((e) => {
      const id = exerciseIdFor(mapping, e.exercise);
      return id
        ? [
            {
              exercise_id: id,
              sets: e.sets,
              reps_min: e.reps_min,
              reps_max: e.reps_max,
              target_seconds: e.target_seconds,
              rest_seconds: e.rest_seconds,
              warmup: e.warmup,
              note: e.note ?? "",
            },
          ]
        : [];
    }),
  }));
}
