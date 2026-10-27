import "server-only";
import { UNAVAILABLE_TITLE } from "@/lib/domain/community";
import type { Goals } from "@/lib/domain/plan";
import type { StatsPlanEntry, StatsRecipe } from "@/lib/domain/stats";
import { addDays, mondayOf, todayInBerlin } from "@/lib/domain/week";
import { Constants, type Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import type { CookLog } from "@/lib/domain/cooklog";
import { getCookLogs, getLongNotCookedWeeks, getRecipeCosts } from "./kitchen-log";
import { getAllGoals, getTrainingDays } from "./plan";

const FOOD_GROUPS = new Set<string>(Constants.public.Enums.food_group);

function parseGroups(value: Json | null): StatsRecipe["gramsByFoodGroup"] {
  const result: StatsRecipe["gramsByFoodGroup"] = {};
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, grams] of Object.entries(value)) {
      if (FOOD_GROUPS.has(key) && typeof grams === "number") result[key as keyof typeof result] = grams;
    }
  }
  return result;
}

export type StatsData = {
  recipes: StatsRecipe[];
  planEntries: StatsPlanEntry[];
  recipeTitles: Record<string, string>;
  mondays: string[];
  goals: { default: Goals; training: Goals };
  training: { weekdays: number[]; overrides: Record<string, boolean> };
  /** Phase 12: eigenes Koch-Log (alle Einträge), Kosten pro Portion, „Lange nicht gekocht“ */
  cookLogs: CookLog[];
  costs: Record<string, { perServing: number; complete: boolean }>;
  longNotCookedWeeks: number;
  today: string;
};

/** Anzahl Wochen im Wochenplan-Verlauf (inklusive der aktuellen). */
export const STATS_WEEKS = 8;

export async function getStatsData(userId: string): Promise<StatsData> {
  const supabase = await createClient();
  const currentMonday = mondayOf(todayInBerlin());
  const mondays = Array.from({ length: STATS_WEEKS }, (_, i) => addDays(currentMonday, (i - STATS_WEEKS + 1) * 7));

  const [recipes, nutrition, plan, goals, training, allCookLogs, costs, longNotCookedWeeks, cocktails] = await Promise.all([
    supabase.from("recipes").select("id, title, category:category_name, servings, is_meal_prep").eq("owner_id", userId).eq("recipe_type", "dish"),
    supabase
      .from("recipe_nutrition")
      .select(
        "recipe_id, ingredient_count, kcal_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving, is_high_protein, is_low_carb, is_vegetarian, is_vegan, grams_by_food_group",
      ),
    supabase
      .from("meal_plan_entries")
      .select("date, recipe_id, servings, recipes!meal_plan_entries_recipe_id_fkey(title)")
      .eq("user_id", userId)
      .gte("date", mondays[0])
      .lte("date", addDays(currentMonday, 6)),
    getAllGoals(userId),
    getTrainingDays(userId, mondays[0], addDays(currentMonday, 6)),
    getCookLogs(userId),
    getRecipeCosts(),
    getLongNotCookedWeeks(userId),
    // Phase 15: Gemixtes zählt in der Bar-Statistik, nicht bei den gekochten Gerichten
    supabase.from("recipes").select("id").eq("owner_id", userId).eq("recipe_type", "cocktail"),
  ]);
  if (recipes.error || nutrition.error || plan.error) throw new Error("Statistiken konnten nicht geladen werden.");

  const nutritionById = new Map(nutrition.data.map((n) => [n.recipe_id, n]));
  const cocktailIds = new Set((cocktails.data ?? []).map((c) => c.id));
  const cookLogs = allCookLogs.filter((l) => !cocktailIds.has(l.recipeId));

  const statsRecipes: StatsRecipe[] = recipes.data.map((r) => {
    const n = nutritionById.get(r.id);
    return {
      id: r.id,
      title: r.title,
      category: r.category,
      servings: r.servings,
      isMealPrep: r.is_meal_prep,
      ingredientCount: n?.ingredient_count ?? 0,
      kcal: n?.kcal_per_serving ?? 0,
      protein: n?.protein_per_serving ?? 0,
      carbs: n?.carbs_per_serving ?? 0,
      fat: n?.fat_per_serving ?? 0,
      isHighProtein: n?.is_high_protein ?? false,
      isLowCarb: n?.is_low_carb ?? false,
      isVegetarian: n?.is_vegetarian ?? false,
      isVegan: n?.is_vegan ?? false,
      gramsByFoodGroup: parseGroups(n?.grams_by_food_group ?? null),
    };
  });

  const recipeTitles: Record<string, string> = {};
  // Eigene Einträge ohne Rezept (Restaurant …) zählen in den Rezept-Statistiken nicht
  const planEntries: StatsPlanEntry[] = plan.data.flatMap((e) => {
    if (!e.recipe_id) return [];
    recipeTitles[e.recipe_id] = e.recipes?.title ?? UNAVAILABLE_TITLE;
    const n = nutritionById.get(e.recipe_id);
    return [
      {
        date: e.date,
        recipeId: e.recipe_id,
        servings: e.servings,
        perServing:
          n && (n.ingredient_count ?? 0) > 0
            ? { kcal: n.kcal_per_serving ?? 0, protein: n.protein_per_serving ?? 0, carbs: n.carbs_per_serving ?? 0, fat: n.fat_per_serving ?? 0 }
            : null,
      },
    ];
  });

  // Titel auch für gekochte Rezepte, die nicht (mehr) im Wochenplan stehen
  for (const r of statsRecipes) recipeTitles[r.id] ??= r.title;

  return {
    recipes: statsRecipes,
    planEntries,
    recipeTitles,
    mondays,
    goals,
    training,
    cookLogs,
    costs: Object.fromEntries([...costs].map(([id, c]) => [id, { perServing: c.perServing, complete: c.priced === c.count }])),
    longNotCookedWeeks,
    today: todayInBerlin(),
  };
}
