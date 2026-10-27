import { z } from "zod";
import { MAX_PREP_DAYS } from "@/lib/domain/mealprep";
import { isIsoDate } from "@/lib/domain/week";
import { Constants } from "@/lib/supabase/database.types";

const isoDate = z.string().refine(isIsoDate, "Ungültiges Datum.");
const servings = z
  .number({ error: "Bitte eine Zahl eingeben." })
  .min(0.25, "Mindestens ¼ Portion.")
  .max(20, "Höchstens 20 Portionen.");

export const addPlanEntrySchema = z
  .object({
    date: isoDate,
    slot: z.enum(Constants.public.Enums.meal_slot),
    recipe_id: z.uuid("Bitte ein Rezept auswählen."),
    servings,
    /** Meal Prep (Phase 11): weitere Tage mit Resten, gleicher Slot */
    prepDates: z.array(isoDate).max(MAX_PREP_DAYS).optional(),
    /** Insgesamt gekochte Portionen (mindestens so viele, wie eingeplant sind) */
    servingsCooked: z.number().min(0.25).max(60, "Höchstens 60 Portionen.").optional(),
  })
  .refine((v) => !v.prepDates || v.prepDates.every((d) => d > v.date), {
    path: ["prepDates"],
    message: "Reste-Tage müssen nach dem Kochtag liegen.",
  })
  .refine((v) => !v.prepDates || new Set(v.prepDates).size === v.prepDates.length, {
    path: ["prepDates"],
    message: "Jeder Tag nur einmal.",
  });

export const addLeftoverSchema = z.object({
  batchId: z.uuid(),
  date: isoDate,
  slot: z.enum(Constants.public.Enums.meal_slot),
  servings,
});

export const trainingDaySchema = z.object({ date: isoDate, training: z.boolean() });

export const trainingWeekdaysSchema = z.object({
  weekdays: z.array(z.number().int().min(1).max(7)).max(7),
});

/** Titel eines eigenen Eintrags ohne Rezept, z. B. „Restaurant“, „Essen bei den Eltern“. */
const freeTitle = z.string().trim().min(1, "Bitte eintragen, was es gibt.").max(80, "Höchstens 80 Zeichen.");

export const addFreePlanEntrySchema = z.object({
  date: isoDate,
  slot: z.enum(Constants.public.Enums.meal_slot),
  title: freeTitle,
});

export const updatePlanEntrySchema = z.object({
  id: z.uuid(),
  servings,
  date: isoDate,
  slot: z.enum(Constants.public.Enums.meal_slot),
  /** nur bei eigenen Einträgen: neuer Titel */
  title: freeTitle.optional(),
});

export const deletePlanEntrySchema = z.object({ id: z.uuid() });

export const copyWeekSchema = z
  .object({
    fromMonday: isoDate,
    toMonday: isoDate,
    replace: z.boolean(),
  })
  .refine((v) => v.fromMonday !== v.toMonday, { path: ["toMonday"], message: "Bitte eine andere Woche wählen." });

const goalValue = (label: string, max: number) =>
  z
    .number({ error: `Bitte ${label} als Zahl eingeben.` })
    .min(0, "Nicht negativ.")
    .max(max, `Höchstens ${max}.`)
    .nullable();

export const goalsSchema = z.object({
  kcal: goalValue("kcal", 10000),
  protein: goalValue("Protein", 1000),
  carbs: goalValue("Kohlenhydrate", 2000),
  fat: goalValue("Fett", 1000),
});

export type GoalsInput = z.input<typeof goalsSchema>;

export const goalTypeSchema = z.enum(Constants.public.Enums.goal_type);
