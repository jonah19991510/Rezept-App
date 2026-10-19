import "server-only";
import { authorName, UNAVAILABLE_TITLE } from "@/lib/domain/community";
import type { DayMacros, Goals, MealSlot } from "@/lib/domain/plan";
import { addDays } from "@/lib/domain/week";
import { createClient } from "@/lib/supabase/server";

export type PlanEntry = {
  id: string;
  date: string;
  slot: MealSlot;
  servings: number;
  position: number;
  recipeId: string;
  recipeTitle: string;
  /** false, wenn das Rezept nicht mehr lesbar ist (ein fremdes Rezept wurde wieder privat gemacht) */
  available: boolean;
  /** Anzeigename bei fremden öffentlichen Rezepten, sonst null */
  authorName: string | null;
  /** Makros einer Portion; null, wenn das Rezept keine Zutaten hat */
  perServing: DayMacros | null;
};

/** Alle Einträge der Woche (Montag bis Sonntag) mit Rezeptname und Makros pro Portion. */
export async function getWeekEntries(userId: string, monday: string): Promise<PlanEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_plan_entries")
    .select(
      "id, date, slot, servings, position, recipe_id, recipes!meal_plan_entries_recipe_id_fkey(title, owner_id, profiles!recipes_owner_id_fkey(display_name))",
    )
    .eq("user_id", userId)
    .gte("date", monday)
    .lte("date", addDays(monday, 6))
    .order("date")
    .order("position")
    .order("created_at");
  if (error) throw new Error(`Wochenplan konnte nicht geladen werden (${error.code})`);

  const recipeIds = [...new Set(data.map((e) => e.recipe_id))];
  const { data: nutrition, error: nError } = recipeIds.length
    ? await supabase
        .from("recipe_nutrition")
        .select("recipe_id, ingredient_count, kcal_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving")
        .in("recipe_id", recipeIds)
    : { data: [], error: null };
  if (nError) throw new Error(`Nährwerte konnten nicht geladen werden (${nError.code})`);
  const byRecipe = new Map(nutrition.map((n) => [n.recipe_id, n]));

  return data.map((e) => {
    const n = byRecipe.get(e.recipe_id);
    return {
      id: e.id,
      date: e.date,
      slot: e.slot,
      servings: e.servings,
      position: e.position,
      recipeId: e.recipe_id,
      recipeTitle: e.recipes?.title ?? UNAVAILABLE_TITLE,
      available: e.recipes != null,
      authorName: e.recipes && e.recipes.owner_id !== userId ? authorName(e.recipes.profiles?.display_name) : null,
      perServing:
        n && (n.ingredient_count ?? 0) > 0
          ? {
              kcal: n.kcal_per_serving ?? 0,
              protein: n.protein_per_serving ?? 0,
              carbs: n.carbs_per_serving ?? 0,
              fat: n.fat_per_serving ?? 0,
            }
          : null,
    };
  });
}

const EMPTY_GOALS: Goals = { kcal: null, protein: null, carbs: null, fat: null };

/** Tagesziel (Standard). Das Trainingstag-Ziel kommt in Phase 11. */
export async function getDefaultGoals(userId: string): Promise<Goals> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_goals")
    .select("kcal, protein, carbs, fat")
    .eq("user_id", userId)
    .eq("goal_type", "default")
    .maybeSingle();
  return data ?? EMPTY_GOALS;
}
