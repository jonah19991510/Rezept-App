import { z } from "zod";
import { Constants } from "@/lib/supabase/database.types";
import { markdownFileName } from "./recipe-markdown";

// Teilen per Link (Phase 14): geteilte Rezeptkarte /r/[token]. Die Daten kommen aus der Datenbankfunktion
// get_shared_recipe (ohne IDs, Autor nur mit Anzeigenamen) und werden hier noch einmal geprüft.

/** 22 Zeichen base64url, wie die Datenbank sie erzeugt */
export const SHARE_TOKEN = /^[A-Za-z0-9_-]{22}$/;

export function isShareToken(value: string): boolean {
  return SHARE_TOKEN.test(value);
}

const num = z.number().nullable();

export const sharedRecipeSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  recipe_type: z.enum(Constants.public.Enums.recipe_type),
  servings: z.number().int().min(1),
  prep_minutes: num,
  cook_minutes: num,
  category: z.enum(Constants.public.Enums.recipe_category).nullable(),
  tags: z.array(z.string()),
  is_meal_prep: z.boolean(),
  source_url: z.string().nullable(),
  /** Interner Speicherpfad des Fotos: nur auf dem Server verwenden, nie an den Browser geben */
  image_url: z.string().nullable(),
  updated_at: z.string(),
  author: z.string().nullable(),
  /** Beilagen als Vorschläge (seit 21.10.2026) */
  side_dishes: z.array(z.string()).default([]),
  nutrition: z
    .object({ kcal: z.number(), protein: num, carbs: num, fat: num, fiber: num })
    .nullable(),
  ingredients: z.array(
    z.object({
      position: z.number(),
      amount: num,
      unit: z.enum(Constants.public.Enums.unit).nullable(),
      grams: num,
      note: z.string().nullable(),
      name: z.string(),
      /** seit 21.10.2026 */
      is_optional: z.boolean().default(false),
    }),
  ),
  steps: z.array(z.object({ position: z.number(), text: z.string(), timer_seconds: num })),
  /** Phase 15: nur bei Cocktails gesetzt */
  cocktail: z
    .object({
      glass: z.enum(Constants.public.Enums.glass).nullable(),
      method: z.enum(Constants.public.Enums.cocktail_method).nullable(),
      ice: z.string().nullable(),
      garnish: z.string().nullable(),
    })
    .nullable()
    .default(null),
  alcohol: z
    .object({ abv_percent: z.number(), alcohol_g: z.number(), volume_ml: z.number(), dilution: z.number() })
    .nullable()
    .default(null),
});

export type SharedRecipe = z.infer<typeof sharedRecipeSchema>;

/** Antwort der Datenbank prüfen; null bei ungültigem/widerrufenem Link oder unerwartetem Format. */
export function parseSharedRecipe(data: unknown): SharedRecipe | null {
  if (data == null) return null;
  const parsed = sharedRecipeSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/** Makros pro Portion für Anzeige und Bilder (fehlende Werte als 0). */
export function sharedMacros(recipe: SharedRecipe) {
  const n = recipe.nutrition;
  if (!n) return null;
  return { kcal: n.kcal, protein: n.protein ?? 0, carbs: n.carbs ?? 0, fat: n.fat ?? 0, fiber: n.fiber ?? 0 };
}

/** Zutaten, deren Gewicht fehlt (zählen in den Nährwerten nicht mit). */
export function missingGramNames(recipe: SharedRecipe): string[] {
  return recipe.ingredients.filter((l) => !l.is_optional && l.amount != null && l.grams == null).map((l) => l.name);
}

/** Absolute Adresse der Karte, z. B. für „Link kopieren“. */
export function shareUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/r/${token}`;
}

const de1 = (v: number) => v.toLocaleString("de-DE", { maximumFractionDigits: 1 });

/** Kurztext für Link-Vorschauen: Beschreibung oder Eckdaten (bei Cocktails Alkoholgehalt und kcal pro Drink). */
export function shareDescription(recipe: SharedRecipe): string {
  const macros = sharedMacros(recipe);
  const facts =
    recipe.recipe_type === "cocktail"
      ? [
          `${recipe.servings} ${recipe.servings === 1 ? "Drink" : "Drinks"}`,
          recipe.alcohol ? `${de1(recipe.alcohol.abv_percent)} % vol` : null,
          macros ? `${Math.round(macros.kcal)} kcal pro Drink` : null,
        ].filter(Boolean)
      : [
          `${recipe.servings} ${recipe.servings === 1 ? "Portion" : "Portionen"}`,
          macros ? `${Math.round(macros.kcal)} kcal und ${Math.round(macros.protein)} g Eiweiß pro Portion` : null,
        ].filter(Boolean);
  const description = recipe.description?.replace(/\s+/g, " ").trim();
  const text = description ? `${description} · ${facts.join(" · ")}` : facts.join(" · ");
  return text.length > 200 ? `${text.slice(0, 197).trimEnd()}…` : text;
}

/** Dateiname für den Bild-Export: „pasta-alfredo.jpg“ (gleiche Regeln wie beim Markdown-Export) */
export function shareImageFileName(title: string): string {
  return markdownFileName(title).replace(/\.md$/, ".jpg");
}
