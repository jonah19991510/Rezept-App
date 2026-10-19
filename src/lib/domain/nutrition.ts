import type { Enums } from "@/lib/supabase/database.types";

// Makroberechnung im Client (Live-Vorschau im Editor). Die gleiche Logik steckt in der
// Postgres-View recipe_nutrition; Liste, Wochenplan und Statistik lesen aus der View.
// Beide nutzen dieselben Schwellenwerte aus app_config.

export type NutritionThresholds = {
  highProteinMinGrams: number;
  highProteinMinKcalShare: number;
  lowCarbMaxGrams: number;
};

export const DEFAULT_THRESHOLDS: NutritionThresholds = {
  highProteinMinGrams: 30,
  highProteinMinKcalShare: 0.3,
  lowCarbMaxGrams: 20,
};

export type IngredientNutrients = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  food_group: Enums<"food_group">;
  diet: Enums<"ingredient_diet">;
};

export type NutritionLine = {
  grams: number | null;
  ingredient: IngredientNutrients;
};

export type Macros = { kcal: number; protein: number; carbs: number; fat: number; fiber: number; sugar: number };

export type RecipeNutrition = {
  total: Macros;
  perServing: Macros;
  gramsByFoodGroup: Partial<Record<Enums<"food_group">, number>>;
  /** Zeilen ohne Gramm-Angabe (zählen mit 0 g) */
  linesWithoutGrams: number;
  isHighProtein: boolean;
  isLowCarb: boolean;
  isVegetarian: boolean;
  isVegan: boolean;
};

const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 };
const KEYS = Object.keys(ZERO) as (keyof Macros)[];

export function computeRecipeNutrition(
  lines: NutritionLine[],
  servings: number,
  thresholds: NutritionThresholds = DEFAULT_THRESHOLDS,
): RecipeNutrition {
  const total: Macros = { ...ZERO };
  const gramsByFoodGroup: RecipeNutrition["gramsByFoodGroup"] = {};
  let linesWithoutGrams = 0;

  for (const line of lines) {
    const grams = line.grams ?? 0;
    if (line.grams == null) linesWithoutGrams++;
    for (const key of KEYS) total[key] += (grams * line.ingredient[key]) / 100;
    const group = line.ingredient.food_group;
    gramsByFoodGroup[group] = (gramsByFoodGroup[group] ?? 0) + grams;
  }

  const safeServings = servings > 0 ? servings : 1;
  const perServing = Object.fromEntries(KEYS.map((k) => [k, total[k] / safeServings])) as Macros;
  const hasIngredients = lines.length > 0;

  return {
    total,
    perServing,
    gramsByFoodGroup,
    linesWithoutGrams,
    isHighProtein:
      hasIngredients &&
      (perServing.protein >= thresholds.highProteinMinGrams ||
        (perServing.kcal > 0 && (perServing.protein * 4) / perServing.kcal >= thresholds.highProteinMinKcalShare)),
    isLowCarb: hasIngredients && perServing.carbs <= thresholds.lowCarbMaxGrams,
    isVegetarian: hasIngredients && lines.every((l) => l.ingredient.diet !== "none"),
    isVegan: hasIngredients && lines.every((l) => l.ingredient.diet === "vegan"),
  };
}

/** Schwellenwerte aus den app_config-Zeilen lesen (fehlende Werte → Standard). */
export function thresholdsFromConfig(rows: { key: string; value: unknown }[]): NutritionThresholds {
  const get = (key: string, fallback: number) => {
    const raw = rows.find((r) => r.key === key)?.value;
    const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    highProteinMinGrams: get("high_protein_min_protein_g", DEFAULT_THRESHOLDS.highProteinMinGrams),
    highProteinMinKcalShare: get("high_protein_min_kcal_share", DEFAULT_THRESHOLDS.highProteinMinKcalShare),
    lowCarbMaxGrams: get("low_carb_max_carbs_g", DEFAULT_THRESHOLDS.lowCarbMaxGrams),
  };
}
