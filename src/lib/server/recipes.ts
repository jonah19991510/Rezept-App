import "server-only";
import { cache } from "react";
import type { RecipeListItem } from "@/lib/domain/recipe-filter";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

/** Alle eigenen Rezepte mit Makros (aus der View) und Favoriten-Markierung. */
export async function getOwnRecipeList(userId: string): Promise<RecipeListItem[]> {
  const supabase = await createClient();
  const [recipes, nutrition, favorites] = await Promise.all([
    supabase
      .from("recipes")
      .select("id, title, description, category, tags, is_meal_prep, prep_minutes, cook_minutes, updated_at")
      .eq("owner_id", userId)
      .eq("recipe_type", "dish"),
    supabase
      .from("recipe_nutrition")
      .select(
        "recipe_id, kcal_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving, is_high_protein, is_low_carb, is_vegetarian, is_vegan",
      ),
    supabase.from("favorites").select("recipe_id"),
  ]);
  if (recipes.error) throw new Error("Rezepte konnten nicht geladen werden.");

  const nutritionById = new Map((nutrition.data ?? []).map((n) => [n.recipe_id, n]));
  const favoriteIds = new Set((favorites.data ?? []).map((f) => f.recipe_id));

  return recipes.data.map((r) => ({
    ...r,
    nutrition: nutritionById.get(r.id) ?? null,
    isFavorite: favoriteIds.has(r.id),
  }));
}

export type RecipeDetailIngredient = Tables<"recipe_ingredients"> & { ingredient: Tables<"ingredients"> };

export type RecipeDetail = {
  recipe: Tables<"recipes">;
  authorName: string | null;
  isOwner: boolean;
  isFavorite: boolean;
  ingredients: RecipeDetailIngredient[];
  steps: Tables<"recipe_steps">[];
  nutrition: Tables<"recipe_nutrition"> | null;
};

/** Ein Rezept mit Zutaten, Schritten und Makros. null, wenn es nicht existiert oder nicht lesbar ist (RLS). */
export const getRecipeDetail = cache(async (recipeId: string, userId: string): Promise<RecipeDetail | null> => {
  const supabase = await createClient();
  // Beziehungen mit Fremdschlüssel-Namen angeben: recipes ↔ profiles ist sonst mehrdeutig
  // (direkt über owner_id und zusätzlich über die Tabelle favorites), PostgREST antwortet dann mit 300.
  const { data: recipe, error } = await supabase
    .from("recipes")
    .select(
      "*, profiles!recipes_owner_id_fkey(display_name), recipe_ingredients!recipe_ingredients_recipe_id_fkey(*, ingredients(*)), recipe_steps!recipe_steps_recipe_id_fkey(*)",
    )
    .eq("id", recipeId)
    .maybeSingle();
  // Ein Abfragefehler ist kein „nicht gefunden“: lieber die Fehlerseite zeigen als falsch 404
  if (error) throw new Error(`Rezept konnte nicht geladen werden (${error.code})`);
  if (!recipe) return null;

  const [{ data: nutrition }, { data: favorite }] = await Promise.all([
    supabase.from("recipe_nutrition").select("*").eq("recipe_id", recipeId).maybeSingle(),
    supabase.from("favorites").select("recipe_id").eq("recipe_id", recipeId).maybeSingle(),
  ]);

  const { profiles, recipe_ingredients, recipe_steps, ...base } = recipe;
  return {
    recipe: base,
    authorName: profiles?.display_name ?? null,
    isOwner: base.owner_id === userId,
    isFavorite: Boolean(favorite),
    ingredients: recipe_ingredients
      .map(({ ingredients, ...line }) => ({ ...line, ingredient: ingredients }))
      .sort((a, b) => a.position - b.position),
    steps: [...recipe_steps].sort((a, b) => a.position - b.position),
    nutrition: nutrition ?? null,
  };
});
