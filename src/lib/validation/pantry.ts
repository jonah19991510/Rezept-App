import { z } from "zod";
import { isIsoDate } from "@/lib/domain/week";

/** Eintrag im Vorratsschrank. Menge ist freiwillig („vorhanden“ reicht), Einheit dann Pflicht. */
export const pantryItemSchema = z
  .object({
    id: z.uuid().optional(),
    ingredientId: z.uuid("Bitte eine Zutat auswählen."),
    location: z.enum(["kitchen", "bar"]),
    amount: z.number({ error: "Bitte eine Zahl eingeben." }).positive("Die Menge muss größer als 0 sein.").max(100000).nullable(),
    unit: z.enum(["g", "ml", "Stück"]).nullable(),
    expiresOn: z.string().refine(isIsoDate, "Ungültiges Datum.").nullable(),
  })
  .refine((v) => v.amount == null || v.unit != null, { path: ["unit"], message: "Bitte eine Einheit wählen." });

export type PantryItemInput = z.input<typeof pantryItemSchema>;

export const recipeIdSchema = z.object({ recipeId: z.uuid("Ungültiges Rezept.") });

/** Nach dem Kochen: ausgewählte Vorrats-Einträge um die verbrauchte Menge verringern bzw. als aufgebraucht entfernen. */
export const consumeSchema = z.object({
  recipeId: z.uuid(),
  servings: z.number().min(0.25).max(100),
  pantryIds: z.array(z.uuid()).max(200),
});
