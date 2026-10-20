import { z } from "zod";
import { Constants } from "@/lib/supabase/database.types";

// Rezept-Sicherung (Phase 8): alle eigenen Rezepte als JSON-Datei, die sich wieder importieren lässt.
// Zutaten stehen mit ID UND Nährwerten drin: Gibt es die ID beim Import nicht (mehr), wird nach dem Namen
// gesucht und sonst eine eigene Zutat mit diesen Werten angelegt. Fotos sind nicht enthalten.
// Version 2 (Phase 15): auch Cocktails (recipe_type, Glas, Methode, Eis, Garnitur) und der Alkoholgehalt der
// Zutaten. Dateien der Version 1 lassen sich weiter importieren (alles Gerichte, Alkoholgehalt unbekannt).

export const BACKUP_FORMAT = "rezeptbuch-rezepte";
export const BACKUP_VERSION = 2;
export const SUPPORTED_BACKUP_VERSIONS = [1, 2] as const;
export const MAX_BACKUP_RECIPES = 300;

const n = (max: number) => z.number().min(0).max(max);

export const backupIngredientSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(200),
  kcal: n(900),
  protein: n(100),
  carbs: n(100),
  fat: n(100),
  fiber: n(100),
  sugar: n(100),
  food_group: z.enum(Constants.public.Enums.food_group),
  diet: z.enum(Constants.public.Enums.ingredient_diet).nullable(),
  piece_weight_g: z.number().positive().max(10000).nullable(),
  density_g_per_ml: z.number().positive().max(5).nullable(),
  /** ab Version 2 */
  abv: z.number().min(0).max(100).nullable().default(null),
});

/** ab Version 2: Cocktail-Felder */
export const backupCocktailSchema = z.object({
  glass: z.enum(Constants.public.Enums.glass).nullable(),
  method: z.enum(Constants.public.Enums.cocktail_method).nullable(),
  ice: z.string().max(100).nullable(),
  garnish: z.string().max(200).nullable(),
});

export const backupRecipeSchema = z.object({
  /** ab Version 2; Version 1 kennt nur Gerichte */
  recipe_type: z.enum(Constants.public.Enums.recipe_type).default("dish"),
  cocktail: backupCocktailSchema.nullable().default(null),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).nullable(),
  servings: z.number().int().min(1).max(100),
  prep_minutes: z.number().int().min(0).max(10000).nullable(),
  cook_minutes: z.number().int().min(0).max(10000).nullable(),
  category: z.enum(Constants.public.Enums.recipe_category).nullable(),
  tags: z.array(z.string().trim().min(1).max(30)).max(20),
  is_meal_prep: z.boolean(),
  source_url: z.string().max(2000).nullable(),
  ingredients: z
    .array(
      z.object({
        ingredient: backupIngredientSchema,
        amount: z.number().positive().max(100000).nullable(),
        unit: z.enum(Constants.public.Enums.unit).nullable(),
        grams: z.number().min(0).max(100000).nullable(),
        note: z.string().max(200).nullable(),
        step_position: z.number().int().min(1).nullable(),
      }),
    )
    .max(100),
  steps: z.array(z.object({ text: z.string().trim().min(1).max(2000), timer_seconds: z.number().int().positive().max(86400).nullable() })).max(60),
});

export const backupFileSchema = z.object({
  format: z.literal(BACKUP_FORMAT, { error: "Das ist keine Rezept-Sicherung aus dieser App." }),
  version: z.literal(SUPPORTED_BACKUP_VERSIONS, { error: "Diese Sicherung stammt aus einer anderen Version der App." }),
  exported_at: z.string().max(40),
  recipes: z.array(backupRecipeSchema).min(1, "Die Sicherung enthält keine Rezepte.").max(MAX_BACKUP_RECIPES, `Höchstens ${MAX_BACKUP_RECIPES} Rezepte auf einmal.`),
});

export type BackupIngredient = z.infer<typeof backupIngredientSchema>;
export type BackupRecipe = z.infer<typeof backupRecipeSchema>;
export type BackupFile = z.infer<typeof backupFileSchema>;
/** Was der Server-Import entgegennimmt (vor dem Auffüllen der Standardwerte, z. B. aus Version 1) */
export type BackupFileInput = z.input<typeof backupFileSchema>;

/** Datenbankzeile eines eigenen Rezepts mit Zutaten (inkl. Zutat), Schritten und Cocktail-Feldern. */
export type RecipeRowForBackup = Omit<BackupRecipe, "ingredients" | "steps" | "cocktail"> & {
  cocktail_details: BackupRecipe["cocktail"];
  recipe_ingredients: (Omit<BackupRecipe["ingredients"][number], "ingredient"> & { position: number; ingredient: BackupIngredient })[];
  recipe_steps: { position: number; text: string; timer_seconds: number | null }[];
};

export function toBackupFile(rows: RecipeRowForBackup[], now: Date): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exported_at: now.toISOString(),
    recipes: rows.map(({ recipe_ingredients, recipe_steps, cocktail_details, ...r }) => ({
      ...r,
      cocktail: r.recipe_type === "cocktail" ? cocktail_details : null,
      ingredients: [...recipe_ingredients]
        .sort((a, b) => a.position - b.position)
        .map((l) => ({
          ingredient: l.ingredient,
          amount: l.amount,
          unit: l.unit,
          grams: l.grams,
          note: l.note,
          step_position: l.step_position,
        })),
      steps: [...recipe_steps].sort((a, b) => a.position - b.position).map(({ text, timer_seconds }) => ({ text, timer_seconds })),
    })),
  };
}

const key = (name: string) => name.trim().toLocaleLowerCase("de-DE");

/**
 * Ordnet die Zutaten einer Sicherung vorhandenen Zutaten zu: erst über die ID, dann über den Namen
 * (Groß-/Kleinschreibung egal). Was übrig bleibt, muss neu angelegt werden (je Name nur einmal).
 */
export function resolveBackupIngredients(
  backup: BackupFile,
  existing: { id: string; name: string }[],
): { mapping: Map<string, string>; toCreate: BackupIngredient[] } {
  const byId = new Set(existing.map((e) => e.id));
  const byName = new Map(existing.map((e) => [key(e.name), e.id]));
  const mapping = new Map<string, string>();
  const toCreate = new Map<string, BackupIngredient>();

  for (const recipe of backup.recipes) {
    for (const { ingredient } of recipe.ingredients) {
      if (mapping.has(ingredient.id)) continue;
      if (byId.has(ingredient.id)) mapping.set(ingredient.id, ingredient.id);
      else if (byName.has(key(ingredient.name))) mapping.set(ingredient.id, byName.get(key(ingredient.name))!);
      else if (!toCreate.has(key(ingredient.name))) toCreate.set(key(ingredient.name), ingredient);
    }
  }
  return { mapping, toCreate: [...toCreate.values()] };
}

/** Nach dem Anlegen: Namen der neuen Zutaten auf ihre IDs abbilden und die Zuordnung vervollständigen. */
export function completeMapping(
  backup: BackupFile,
  mapping: Map<string, string>,
  created: { id: string; name: string }[],
): Map<string, string> {
  const byName = new Map(created.map((c) => [key(c.name), c.id]));
  const full = new Map(mapping);
  for (const recipe of backup.recipes) {
    for (const { ingredient } of recipe.ingredients) {
      if (!full.has(ingredient.id) && byName.has(key(ingredient.name))) full.set(ingredient.id, byName.get(key(ingredient.name))!);
    }
  }
  return full;
}

/** Dateiname mit Datum, z. B. rezeptbuch-rezepte-2026-10-19.json */
export function backupFileName(prefix: string, now: Date): string {
  return `${prefix}-${now.toISOString().slice(0, 10)}.json`;
}
