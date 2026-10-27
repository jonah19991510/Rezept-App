import { z } from "zod";
import { DRINK_COLOR_KEYS, type DrinkColor } from "@/lib/domain/drinks";

// Getränketracker: Eingaben von Getränken, Einträgen und Tagesziel.

const name = z.string().trim().min(1, "Bitte einen Namen eingeben.").max(60, "Höchstens 60 Zeichen.");

export const drinkIngredientSchema = z.object({
  name,
  ml: z.number().int().min(1, "Mindestens 1 ml.").max(5000, "Höchstens 5000 ml."),
  caffeine: z.number().min(0).max(1000),
  sugar: z.number().min(0).max(100),
  water: z.boolean(),
});

export const drinkInputSchema = z.object({
  name,
  color: z.enum(DRINK_COLOR_KEYS as [DrinkColor, ...DrinkColor[]]),
  caffeinePer100: z.number().min(0, "Nicht negativ.").max(1000, "Höchstens 1000 mg."),
  sugarPer100: z.number().min(0, "Nicht negativ.").max(100, "Höchstens 100 g."),
  /** einfaches Getränk: zählt als Wasser */
  isWater: z.boolean(),
  /** null = einfaches Getränk; sonst rechnet der Server die Werte aus den Zutaten */
  ingredients: z.array(drinkIngredientSchema).min(1, "Mindestens eine Zutat.").max(12, "Höchstens 12 Zutaten.").nullable(),
});
export type DrinkInput = z.infer<typeof drinkInputSchema>;

export const drinkEntryInputSchema = z.object({
  /** null nur beim Bearbeiten eines Eintrags, dessen Getränk gelöscht ist */
  drinkId: z.uuid().nullable(),
  ml: z.number().int().min(1, "Mindestens 1 ml.").max(5000, "Höchstens 5 Liter auf einmal."),
  /** beide leer = jetzt */
  date: z.iso.date().nullable(),
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
});
export type DrinkEntryInput = z.infer<typeof drinkEntryInputSchema>;

export const drinkGoalSchema = z.number().int().min(250, "Mindestens 0,25 l.").max(10000, "Höchstens 10 l.");
