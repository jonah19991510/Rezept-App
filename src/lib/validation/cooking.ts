import { z } from "zod";

/** Eintrag „Gekocht!“ am Ende des Kochmodus (Bewertung und Notiz sind freiwillig). */
export const cookLogSchema = z.object({
  recipeId: z.uuid("Ungültiges Rezept."),
  rating: z.number().int().min(1).max(5).nullable(),
  note: z.string().trim().max(1000, "Höchstens 1000 Zeichen.").default(""),
  servings: z.number().min(0.25).max(100),
});

export type CookLogInput = z.input<typeof cookLogSchema>;
