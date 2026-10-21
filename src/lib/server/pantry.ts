import "server-only";
import { isPantryUnit, neededInUnit, type PantryEntry } from "@/lib/domain/pantry";
import type { FoodGroup } from "@/lib/domain/shopping";
import type { Unit } from "@/lib/domain/units";
import { createClient } from "@/lib/supabase/server";

export type PantryRow = PantryEntry & { name: string; foodGroup: FoodGroup; isStaple: boolean };

/** Alle Vorrats-Einträge des Nutzers mit Zutatenname und -gruppe. */
export async function getPantry(userId: string): Promise<PantryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pantry_items")
    .select("id, ingredient_id, amount, unit, location, expires_on, ingredients!pantry_items_ingredient_id_fkey(name, food_group, is_staple)")
    .eq("user_id", userId);
  if (error) throw new Error(`Vorrat konnte nicht geladen werden (${error.code})`);
  return data
    .map((row) => ({
      id: row.id,
      ingredientId: row.ingredient_id,
      amount: row.amount,
      unit: isPantryUnit(row.unit) ? row.unit : null,
      location: row.location,
      expiresOn: row.expires_on,
      name: row.ingredients.name,
      foodGroup: row.ingredients.food_group,
      isStaple: row.ingredients.is_staple,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export type RecipeLineForPantry = {
  ingredientId: string;
  name: string;
  isStaple: boolean;
  foodGroup: FoodGroup;
  amount: number | null;
  unit: Unit | null;
  grams: number | null;
  density: number | null;
  pieceWeight: number | null;
};

/** Zutaten eines (lesbaren) Rezepts mit allem, was Vorrat und Einkaufsliste brauchen. */
export async function getRecipeLinesForPantry(recipeId: string): Promise<{ servings: number; lines: RecipeLineForPantry[] } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("recipes")
    .select(
      "servings, recipe_ingredients!recipe_ingredients_recipe_id_fkey(amount, unit, grams, ingredient_id, is_optional, ingredients!recipe_ingredients_ingredient_id_fkey(name, is_staple, food_group, density_g_per_ml, piece_weight_g))",
    )
    .eq("id", recipeId)
    .maybeSingle();
  if (!data) return null;
  return {
    servings: data.servings,
    // Optionale Zutaten zählen weder als fehlend noch als verbraucht
    lines: data.recipe_ingredients.filter((l) => !l.is_optional).map((l) => ({
      ingredientId: l.ingredient_id,
      name: l.ingredients.name,
      isStaple: l.ingredients.is_staple,
      foodGroup: l.ingredients.food_group,
      amount: l.amount,
      unit: l.unit,
      grams: l.grams,
      density: l.ingredients.density_g_per_ml,
      pieceWeight: l.ingredients.piece_weight_g,
    })),
  };
}

/** Verbrauchte Menge einer Zutat (alle Zeilen des Rezepts) in der Einheit des Vorrats-Eintrags. */
export function neededForEntry(entry: PantryEntry, lines: RecipeLineForPantry[], factor: number): number | null {
  if (!entry.unit) return null;
  const relevant = lines.filter((l) => l.ingredientId === entry.ingredientId);
  let total = 0;
  for (const line of relevant) {
    const needed = neededInUnit(line, factor, entry.unit, { density_g_per_ml: line.density, piece_weight_g: line.pieceWeight });
    if (needed == null) return null;
    total += needed;
  }
  return relevant.length > 0 ? total : null;
}
