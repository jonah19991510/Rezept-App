import { z } from "zod";
import { Constants } from "@/lib/supabase/database.types";

// Sport & Gesundheit, Phase S1: Trainingsplan und eigene Übung (Client und Server).

const optionalInt = (min: number, max: number, message: string) =>
  z.number({ error: "Bitte eine ganze Zahl eingeben." }).int("Bitte eine ganze Zahl eingeben.").min(min, message).max(max, message).nullable();

export const planExerciseInputSchema = z
  .object({
    exercise_id: z.uuid("Bitte eine Übung auswählen."),
    sets: z.number().int().min(1, "Mindestens 1 Satz.").max(20, "Höchstens 20 Sätze."),
    reps_min: optionalInt(1, 100, "Zwischen 1 und 100 Wiederholungen."),
    reps_max: optionalInt(1, 100, "Zwischen 1 und 100 Wiederholungen."),
    target_seconds: optionalInt(1, 36000, "Zwischen 1 Sekunde und 10 Stunden."),
    rest_seconds: optionalInt(0, 900, "Höchstens 15 Minuten Pause."),
    warmup: z.boolean().default(false),
    note: z.string().trim().max(200, "Höchstens 200 Zeichen.").default(""),
  })
  .refine((e) => e.reps_min == null || e.reps_max == null || e.reps_max >= e.reps_min, {
    path: ["reps_max"],
    message: "„Bis“ muss mindestens so groß sein wie „von“.",
  });

export const planDayInputSchema = z.object({
  id: z.uuid().nullable().default(null),
  name: z.string().trim().min(1, "Bitte gib dem Tag einen Namen.").max(60, "Höchstens 60 Zeichen."),
  focus: z.string().trim().max(60, "Höchstens 60 Zeichen.").default(""),
  exercises: z.array(planExerciseInputSchema).max(40, "Höchstens 40 Übungen pro Tag."),
});

export const trainingPlanInputSchema = z.object({
  id: z.uuid().nullable().default(null),
  title: z.string().trim().min(1, "Bitte gib dem Plan einen Namen.").max(100, "Höchstens 100 Zeichen."),
  description: z.string().trim().max(1000, "Höchstens 1000 Zeichen.").default(""),
  days: z.array(planDayInputSchema).min(1, "Ein Plan braucht mindestens einen Trainingstag.").max(14, "Höchstens 14 Tage."),
});

export type TrainingPlanInput = z.input<typeof trainingPlanInputSchema>;

export const exerciseInputSchema = z.object({
  name: z.string().trim().min(1, "Bitte gib der Übung einen Namen.").max(80, "Höchstens 80 Zeichen."),
  muscle_group: z.enum(Constants.public.Enums.muscle_group, { error: "Bitte eine Muskelgruppe wählen." }),
  equipment: z.enum(Constants.public.Enums.exercise_equipment, { error: "Bitte ein Gerät wählen." }),
  tracking: z.enum(Constants.public.Enums.exercise_tracking),
  /** Nebenmuskeln (ohne den Hauptmuskel) */
  secondary_muscles: z.array(z.enum(Constants.public.Enums.muscle_group)).max(8).default([]),
});

export type ExerciseInput = z.input<typeof exerciseInputSchema>;
