import "server-only";
import { collectMyIngredients, type MyIngredient, type MyIngredientPrice } from "@/lib/domain/my-ingredients";
import { createClient } from "@/lib/supabase/server";
import { getPrices } from "./kitchen-log";

// Wie INGREDIENT_OPTION_COLUMNS plus created_by (als Literal, damit die Supabase-Typen greifen)
const COLUMNS =
  "id, name, kcal, protein, carbs, fat, fiber, sugar, food_group, diet, piece_weight_g, density_g_per_ml, abv, source, is_staple, created_by" as const;

/** Zutaten aus eigenen Rezepten (Küche und Bar) und selbst angelegte, mit eigenem Preis. */
export async function getMyIngredients(userId: string): Promise<MyIngredient[]> {
  const supabase = await createClient();
  const [recipes, own, prices] = await Promise.all([
    supabase
      .from("recipes")
      .select(
        "id, title, recipe_type, recipe_ingredients!recipe_ingredients_recipe_id_fkey(ingredients!recipe_ingredients_ingredient_id_fkey(id, name, kcal, protein, carbs, fat, fiber, sugar, food_group, diet, piece_weight_g, density_g_per_ml, abv, source, is_staple, created_by))",
      )
      .eq("owner_id", userId),
    supabase.from("ingredients").select(COLUMNS).eq("created_by", userId),
    getPrices(userId),
  ]);
  if (recipes.error || own.error) throw new Error("Zutaten konnten nicht geladen werden.");

  const priceMap = new Map<string, MyIngredientPrice>(
    prices.map((p) => [
      p.ingredientId,
      { id: p.id, price: p.price, packageAmount: p.packageAmount, packageUnit: p.packageUnit, store: p.store, perGram: p.perGram },
    ]),
  );
  return collectMyIngredients({
    userId,
    recipes: recipes.data.map((r) => ({
      id: r.id,
      title: r.title,
      type: r.recipe_type,
      ingredients: r.recipe_ingredients.map((l) => l.ingredients),
    })),
    own: own.data,
    prices: priceMap,
  });
}
