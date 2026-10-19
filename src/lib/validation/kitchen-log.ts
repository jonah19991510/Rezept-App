import { z } from "zod";
import { isIsoDate } from "@/lib/domain/week";

// Phase 12: Preise, Koch-Log von der Rezeptseite, Versionen, „Lange nicht gekocht“.

const isoDate = z.string().refine(isIsoDate, "Ungültiges Datum.");

/** Preis für eine Packung (z. B. 3,49 € für 500 g), optional mit Laden. */
export const priceSchema = z.object({
  ingredientId: z.uuid("Bitte eine Zutat auswählen."),
  price: z.number({ error: "Bitte einen Preis eingeben." }).min(0, "Nicht negativ.").max(10000, "Höchstens 10.000 €."),
  packageAmount: z.number({ error: "Bitte die Packungsgröße eingeben." }).positive("Die Packungsgröße muss größer als 0 sein.").max(100000),
  packageUnit: z.enum(["g", "ml", "piece"]),
  store: z.string().trim().max(80, "Höchstens 80 Zeichen.").default(""),
});
export type PriceInput = z.input<typeof priceSchema>;

/** Schnelleingabe in der Einkaufsliste: bezahlter Preis für einen abgehakten Eintrag. */
export const paidPriceSchema = z.object({
  itemId: z.uuid(),
  price: z.number({ error: "Bitte einen Preis eingeben." }).min(0, "Nicht negativ.").max(10000, "Höchstens 10.000 €."),
});

/** Koch-Log-Eintrag von der Rezeptseite (Datum frei wählbar, nicht in der Zukunft). */
export const manualCookLogSchema = z.object({
  recipeId: z.uuid("Ungültiges Rezept."),
  date: isoDate,
  rating: z.number().int().min(1).max(5).nullable(),
  note: z.string().trim().max(1000, "Höchstens 1000 Zeichen.").default(""),
  servings: z.number().min(0.25).max(100).nullable(),
});
export type ManualCookLogInput = z.input<typeof manualCookLogSchema>;

export const restoreVersionSchema = z.object({ recipeId: z.uuid(), version: z.number().int().min(1) });

export const longNotCookedSchema = z.object({
  weeks: z.number({ error: "Bitte eine Zahl eingeben." }).int("Bitte ganze Wochen.").min(1, "Mindestens 1 Woche.").max(104, "Höchstens 104 Wochen."),
});
