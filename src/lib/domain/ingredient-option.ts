import type { Tables } from "@/lib/supabase/database.types";

/** Was der Editor über eine Zutat wissen muss (Nährwerte, Umrechnung, Anzeige). */
export type IngredientOption = Pick<
  Tables<"ingredients">,
  | "id"
  | "name"
  | "kcal"
  | "protein"
  | "carbs"
  | "fat"
  | "fiber"
  | "sugar"
  | "food_group"
  | "diet"
  | "piece_weight_g"
  | "density_g_per_ml"
  | "source"
  | "is_staple"
>;

export const INGREDIENT_OPTION_COLUMNS =
  "id, name, kcal, protein, carbs, fat, fiber, sugar, food_group, diet, piece_weight_g, density_g_per_ml, source, is_staple" as const;

export function toIngredientOption(row: IngredientOption): IngredientOption {
  return {
    id: row.id,
    name: row.name,
    kcal: row.kcal,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    fiber: row.fiber,
    sugar: row.sugar,
    food_group: row.food_group,
    diet: row.diet,
    piece_weight_g: row.piece_weight_g,
    density_g_per_ml: row.density_g_per_ml,
    source: row.source,
    is_staple: row.is_staple,
  };
}
