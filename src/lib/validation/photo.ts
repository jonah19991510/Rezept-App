import { z } from "zod";

/** Upload vorbereiten: Pfade für Foto und Vorschaubild im eigenen Ordner. */
export const preparePhotoSchema = z.object({
  recipeId: z.uuid("Ungültiges Rezept."),
  ext: z.enum(["webp", "jpg"]),
});

/** Hochgeladenes Foto am Rezept speichern. Der Pfad wird zusätzlich gegen Owner und Rezept geprüft. */
export const setPhotoSchema = z.object({
  recipeId: z.uuid("Ungültiges Rezept."),
  path: z.string().min(1).max(200),
});

export const removePhotoSchema = z.object({ recipeId: z.uuid("Ungültiges Rezept.") });
