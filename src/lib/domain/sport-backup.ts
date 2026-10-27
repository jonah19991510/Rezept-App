import { z } from "zod";
import { Constants } from "@/lib/supabase/database.types";
import { normalizeSearch, type Equipment, type MuscleGroup, type Tracking } from "./exercises";

// Sport-Sicherung (26.10.2026): eigene Trainingspläne und eigene Übungen als JSON-Datei, die sich wieder importieren
// lässt. Übungen stehen mit Namen UND Eckdaten drin: Beim Import wird nach dem Namen gesucht (Grundbestand und eigene),
// fehlt eine Übung, wird sie als eigene Übung angelegt. Version 2 (Phase S2): auch beendete Trainings mit allen
// erledigten Sätzen; Dateien der Version 1 lassen sich weiter importieren.

export const SPORT_BACKUP_FORMAT = "rezeptbuch-sport";
export const SPORT_BACKUP_VERSION = 2;
export const SUPPORTED_SPORT_BACKUP_VERSIONS = [1, 2] as const;
export const MAX_SPORT_BACKUP_PLANS = 100;
export const MAX_SPORT_BACKUP_WORKOUTS = 2000;

export const sportBackupExerciseSchema = z.object({
  name: z.string().trim().min(1).max(80),
  muscle_group: z.enum(Constants.public.Enums.muscle_group),
  secondary_muscles: z.array(z.enum(Constants.public.Enums.muscle_group)).max(14).default([]),
  equipment: z.enum(Constants.public.Enums.exercise_equipment),
  tracking: z.enum(Constants.public.Enums.exercise_tracking),
});

const optionalInt = (min: number, max: number) => z.number().int().min(min).max(max).nullable();
const timestamp = z.iso.datetime({ offset: true });

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

/** ab Version 2: beendete Trainings (Plan und Tag über ihre Namen, nur erledigte Sätze) */
export const sportBackupWorkoutSchema = z.object({
  title: z.string().trim().min(1).max(160),
  plan_title: z.string().max(100).nullable(),
  day_name: z.string().max(60).nullable(),
  started_at: timestamp,
  ended_at: timestamp,
  note: z.string().max(1000).nullable(),
  exercises: z
    .array(
      z.object({
        exercise: sportBackupExerciseSchema,
        note: z.string().max(200).nullable(),
        sets: z
          .array(
            z.object({
              kind: z.enum(["warmup", "normal"]),
              weight_kg: z.number().min(0).max(1000).nullable(),
              reps: optionalInt(0, 1000),
              seconds: optionalInt(0, 86400),
              distance_m: z.number().min(0).max(1_000_000).nullable(),
              // ab 27.10.2026; ältere Sicherungen haben das Feld nicht
              speed_kmh: z.number().min(0).max(99.9).nullable().optional(),
            }),
          )
          .max(50),
      }),
    )
    .max(60),
});

export const sportBackupFileSchema = z.object({
  format: z.literal(SPORT_BACKUP_FORMAT, { error: "Das ist keine Sport-Sicherung aus dieser App." }),
  version: z.literal(SUPPORTED_SPORT_BACKUP_VERSIONS, { error: "Diese Sicherung stammt aus einer anderen Version der App." }),
  exported_at: z.string().max(40),
  own_exercises: z.array(sportBackupExerciseSchema).max(500).default([]),
  plans: z.array(sportBackupPlanSchema).max(MAX_SPORT_BACKUP_PLANS, `Höchstens ${MAX_SPORT_BACKUP_PLANS} Pläne auf einmal.`),
  workouts: z
    .array(sportBackupWorkoutSchema)
    .max(MAX_SPORT_BACKUP_WORKOUTS, `Höchstens ${MAX_SPORT_BACKUP_WORKOUTS} Trainings auf einmal.`)
    .default([]),
});

export type SportBackupExercise = z.infer<typeof sportBackupExerciseSchema>;
export type SportBackupPlan = z.infer<typeof sportBackupPlanSchema>;
export type SportBackupWorkout = z.infer<typeof sportBackupWorkoutSchema>;
export type SportBackupFile = z.infer<typeof sportBackupFileSchema>;
export type SportBackupFileInput = z.input<typeof sportBackupFileSchema>;

type BackupExerciseRow = { name: string; muscle_group: MuscleGroup; secondary_muscles: MuscleGroup[]; equipment: Equipment; tracking: Tracking };

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
      exercises: BackupExerciseRow;
    }[];
  }[];
};

/** Beendetes Training aus der Datenbank (mit Plan- und Tagnamen, Übungen und Sätzen). */
export type WorkoutRowForBackup = {
  title: string;
  started_at: string;
  ended_at: string | null;
  note: string | null;
  training_plans: { title: string } | null;
  training_plan_days: { name: string } | null;
  workout_exercises: {
    position: number;
    note: string | null;
    exercises: BackupExerciseRow;
    workout_sets: {
      position: number;
      kind: "warmup" | "normal";
      done: boolean;
      weight_kg: number | null;
      reps: number | null;
      seconds: number | null;
      distance_m: number | null;
      speed_kmh?: number | null;
    }[];
  }[];
};

const exerciseData = (x: BackupExerciseRow): SportBackupExercise => ({
  name: x.name,
  muscle_group: x.muscle_group,
  secondary_muscles: x.secondary_muscles,
  equipment: x.equipment,
  tracking: x.tracking,
});

export function toSportBackupFile(
  plans: PlanRowForBackup[],
  ownExercises: SportBackupExercise[],
  workouts: WorkoutRowForBackup[],
  now: Date,
): SportBackupFile {
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
              exercise: exerciseData(x),
            })),
        })),
    })),
    // Laufende Trainings gehören nicht in die Sicherung
    workouts: workouts.flatMap((w) =>
      w.ended_at
        ? [
            {
              title: w.title,
              plan_title: w.training_plans?.title ?? null,
              day_name: w.training_plan_days?.name ?? null,
              started_at: w.started_at,
              ended_at: w.ended_at,
              note: w.note,
              exercises: [...w.workout_exercises]
                .sort((a, b) => a.position - b.position)
                .map((e) => ({
                  exercise: exerciseData(e.exercises),
                  note: e.note,
                  sets: [...e.workout_sets]
                    .filter((s) => s.done)
                    .sort((a, b) => a.position - b.position)
                    .map((s) => ({
                      kind: s.kind,
                      weight_kg: s.weight_kg,
                      reps: s.reps,
                      seconds: s.seconds,
                      distance_m: s.distance_m,
                      ...(s.speed_kmh != null ? { speed_kmh: s.speed_kmh } : {}),
                    })),
                })),
            },
          ]
        : [],
    ),
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
  const wanted = [
    ...backup.own_exercises,
    ...backup.plans.flatMap((p) => p.days.flatMap((d) => d.exercises.map((e) => e.exercise))),
    ...backup.workouts.flatMap((w) => w.exercises.map((e) => e.exercise)),
  ];
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

const nameKey = (name: string) => name.trim().toLocaleLowerCase("de");

/**
 * Stand für sync_workout aus einem Training der Sicherung (neue IDs, alle Sätze erledigt). Plan und Tag nur, wenn es
 * sie beim Nutzer unter diesem Namen gibt. Übungen ohne Zuordnung fallen weg.
 */
export function workoutPayloadFromBackup(
  w: SportBackupWorkout,
  mapping: Map<string, string>,
  plans: { id: string; title: string; days: { id: string; name: string }[] }[],
  newId: () => string,
) {
  const plan = w.plan_title ? plans.find((p) => nameKey(p.title) === nameKey(w.plan_title!)) : undefined;
  const day = plan && w.day_name ? plan.days.find((d) => nameKey(d.name) === nameKey(w.day_name!)) : undefined;
  return {
    id: newId(),
    plan_id: plan?.id ?? null,
    plan_day_id: day?.id ?? null,
    title: w.title,
    started_at: w.started_at,
    ended_at: w.ended_at,
    note: w.note ?? "",
    version: 1,
    exercises: w.exercises.flatMap((e) => {
      const exerciseId = exerciseIdFor(mapping, e.exercise);
      if (!exerciseId) return [];
      return [
        {
          id: newId(),
          exercise_id: exerciseId,
          reps_min: null,
          reps_max: null,
          target_seconds: null,
          rest_seconds: null,
          warmup: false,
          note: e.note ?? "",
          sets: e.sets.map((s) => ({ id: newId(), ...s, done: true, done_at: w.ended_at })),
        },
      ];
    }),
  };
}
