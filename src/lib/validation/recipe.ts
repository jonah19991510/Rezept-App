import { z } from "zod";
import { Constants } from "@/lib/supabase/database.types";

const unitEnum = z.enum(Constants.public.Enums.unit);
const foodGroupEnum = z.enum(Constants.public.Enums.food_group);
const dietEnum = z.enum(Constants.public.Enums.ingredient_diet);
const glassEnum = z.enum(Constants.public.Enums.glass);
const methodEnum = z.enum(Constants.public.Enums.cocktail_method);

const minutes = z
  .number({ error: "Bitte eine Zahl eingeben." })
  .int("Bitte ganze Minuten angeben.")
  .min(0, "Bitte keine negativen Minuten.")
  .max(10000, "Das sind ungewöhnlich viele Minuten.")
  .nullable();

export const recipeIngredientInputSchema = z
  .object({
    ingredient_id: z.uuid("Bitte eine Zutat auswählen."),
    amount: z.number({ error: "Bitte eine Zahl eingeben." }).positive("Die Menge muss größer als 0 sein.").max(100000).nullable(),
    unit: unitEnum.nullable(),
    /** Nur nötig, wenn sich die Menge nicht umrechnen lässt (Stück ohne Stückgewicht). */
    manual_grams: z.number().min(0).max(100000).nullable(),
    note: z.string().trim().max(200, "Höchstens 200 Zeichen.").default(""),
    step_position: z.number().int().min(1).nullable().default(null),
    /** Optionale Zutat: zählt nicht in Nährwerten, Kosten und Einkaufsliste */
    is_optional: z.boolean().default(false),
  })
  .refine((l) => l.amount == null || l.unit != null, { path: ["unit"], message: "Bitte eine Einheit wählen." });

export const recipeStepInputSchema = z.object({
  text: z.string().trim().min(1, "Leere Schritte bitte löschen.").max(2000, "Höchstens 2000 Zeichen."),
  timer_seconds: z.number().int().positive().max(86400).nullable().default(null),
});

/** Phase 15: Cocktail-Felder (nur bei recipe_type „cocktail“). */
export const cocktailInputSchema = z.object({
  glass: glassEnum.nullable(),
  method: methodEnum.nullable(),
  ice: z.string().trim().max(100, "Höchstens 100 Zeichen.").default(""),
  garnish: z.string().trim().max(200, "Höchstens 200 Zeichen.").default(""),
});

export type CocktailInput = z.input<typeof cocktailInputSchema>;

/** Doppelte (ohne Groß-/Kleinschreibung) entfernen, erste Schreibweise bleibt. */
function uniqueCaseInsensitive(list: string[]): string[] {
  const seen = new Set<string>();
  return list.filter((t) => {
    const key = t.toLocaleLowerCase("de-DE");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const tagSchema =z.string().trim().min(1).max(30, "Ein Tag darf höchstens 30 Zeichen haben.");

export const recipeInputSchema = z.object({
  id: z.uuid().optional(),
  /** Phase 15: fehlt die Angabe, bleibt der gespeicherte Typ (neu: Gericht) */
  recipe_type: z.enum(Constants.public.Enums.recipe_type).optional(),
  cocktail: cocktailInputSchema.nullable().default(null),
  title: z.string().trim().min(1, "Bitte gib einen Titel ein.").max(200, "Der Titel ist zu lang."),
  description: z.string().trim().max(2000, "Höchstens 2000 Zeichen.").default(""),
  servings: z
    .number({ error: "Bitte eine Zahl eingeben." })
    .int("Bitte ganze Portionen angeben.")
    .min(1, "Mindestens 1 Portion.")
    .max(100, "Höchstens 100 Portionen."),
  prep_minutes: minutes,
  cook_minutes: minutes,
  category: z.string().trim().min(1).max(40, "Kategorie: höchstens 40 Zeichen.").nullable(),
  tags: z
    .array(tagSchema)
    .max(20, "Höchstens 20 Tags.")
    .transform(uniqueCaseInsensitive),
  is_meal_prep: z.boolean(),
  source_url: z
    .union([z.literal(""), z.url({ protocol: /^https?$/, error: "Bitte eine Webadresse mit http(s):// angeben." })])
    .default(""),
  /** Beilagen als Vorschläge (gehören nicht zum Rezept), z. B. „Spätzle“ zum Gulasch */
  side_dishes: z
    .array(z.string().trim().min(1).max(100, "Eine Beilage darf höchstens 100 Zeichen haben."))
    .max(20, "Höchstens 20 Beilagen.")
    .default([])
    .transform(uniqueCaseInsensitive),
  ingredients: z.array(recipeIngredientInputSchema).max(100, "Höchstens 100 Zutaten."),
  steps: z.array(recipeStepInputSchema).max(60, "Höchstens 60 Schritte."),
  /** Phase 12: optionale Notiz zur neuen Version (nur bei inhaltlichen Änderungen gespeichert) */
  change_note: z.string().trim().max(200, "Höchstens 200 Zeichen.").default(""),
});

export type RecipeInput = z.input<typeof recipeInputSchema>;
export type RecipeInputParsed = z.output<typeof recipeInputSchema>;

/** Neue Zutat (manuell oder aus Open Food Facts übernommen). Nährwerte pro 100 g. */
const per100 = (label: string, max = 100) =>
  z.number({ error: `Bitte ${label} angeben.` }).min(0, "Nicht negativ.").max(max, `Höchstens ${max} pro 100 g.`);

export const ingredientInputSchema = z
  .object({
    name: z.string().trim().min(1, "Bitte einen Namen eingeben.").max(200, "Der Name ist zu lang."),
    kcal: per100("kcal", 900),
    protein: per100("Protein"),
    carbs: per100("Kohlenhydrate"),
    fat: per100("Fett"),
    fiber: per100("Ballaststoffe"),
    sugar: per100("Zucker"),
    food_group: foodGroupEnum,
    diet: dietEnum.nullable(),
    piece_weight_g: z.number().positive("Muss größer als 0 sein.").max(10000).nullable(),
    density_g_per_ml: z.number().positive("Muss größer als 0 sein.").max(5, "Unrealistisch hohe Dichte.").nullable(),
    /** Phase 15: Alkoholgehalt in % vol (Spirituosen, Liköre, Wein) */
    abv: z.number({ error: "Bitte eine Zahl eingeben." }).min(0, "Nicht negativ.").max(100, "Höchstens 100 % vol.").nullable().default(null),
    is_staple: z.boolean().default(false),
    /** Barcode bei Open Food Facts; leer bei manuell angelegten Zutaten */
    external_id: z.string().trim().regex(/^\d{4,20}$/, "Ungültiger Barcode.").nullable().default(null),
  })
  .refine((v) => v.sugar <= v.carbs + 0.5, { path: ["sugar"], message: "Zucker kann nicht mehr sein als Kohlenhydrate." })
  .refine((v) => v.protein + v.carbs + v.fat + v.fiber <= 105, {
    path: ["fat"],
    message: "Protein, Kohlenhydrate, Fett und Ballaststoffe ergeben zusammen mehr als 100 g.",
  });

export type IngredientInput = z.input<typeof ingredientInputSchema>;

/** Zod-Fehler als { "ingredients.2.amount": ["…"] } für die Anzeige an den Feldern. */
export function flattenIssues(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
