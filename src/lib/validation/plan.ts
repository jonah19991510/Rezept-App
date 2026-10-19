import { z } from "zod";
import { isIsoDate } from "@/lib/domain/week";
import { Constants } from "@/lib/supabase/database.types";

const isoDate = z.string().refine(isIsoDate, "Ungültiges Datum.");
const servings = z
  .number({ error: "Bitte eine Zahl eingeben." })
  .min(0.25, "Mindestens ¼ Portion.")
  .max(20, "Höchstens 20 Portionen.");

export const addPlanEntrySchema = z.object({
  date: isoDate,
  slot: z.enum(Constants.public.Enums.meal_slot),
  recipe_id: z.uuid("Bitte ein Rezept auswählen."),
  servings,
});

export const updatePlanEntrySchema = z.object({
  id: z.uuid(),
  servings,
  date: isoDate,
  slot: z.enum(Constants.public.Enums.meal_slot),
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
