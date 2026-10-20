import { z } from "zod";

/** Rezept veröffentlichen oder wieder privat machen. */
export const setRecipePublicSchema = z.object({
  recipeId: z.uuid("Ungültiges Rezept."),
  isPublic: z.boolean(),
});

/** Öffentliches Rezept in das eigene Buch übernehmen. */
export const forkRecipeSchema = z.object({ recipeId: z.uuid("Ungültiges Rezept.") });

export type SetRecipePublicInput = z.input<typeof setRecipePublicSchema>;

/** Teilen per Link: Link erzeugen (enabled) oder widerrufen. */
export const setRecipeShareSchema = z.object({
  recipeId: z.uuid("Ungültiges Rezept."),
  enabled: z.boolean(),
});

export type SetRecipeShareInput = z.input<typeof setRecipeShareSchema>;
