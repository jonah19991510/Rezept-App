import "server-only";
import { authorName, UNAVAILABLE_TITLE } from "@/lib/domain/community";
import { recipeBases, type BaseKey } from "@/lib/domain/leftovers";
import { batchRemaining, LEFTOVER_DAYS, type OpenBatch } from "@/lib/domain/mealprep";
import type { DayMacros, Goals, MealSlot } from "@/lib/domain/plan";
import { addDays } from "@/lib/domain/week";
import { createClient } from "@/lib/supabase/server";

export type PlanEntry = {
  id: string;
  date: string;
  slot: MealSlot;
  servings: number;
  position: number;
  /** null bei eigenen Einträgen ohne Rezept (z. B. „Restaurant“): keine Nährwerte, kein Einkauf */
  recipeId: string | null;
  /** Name des Rezepts bzw. Titel des eigenen Eintrags */
  recipeTitle: string;
  /** Speicherpfad des Rezeptfotos (Vorschaubild im Plan), sonst null */
  imagePath: string | null;
  /** false, wenn das Rezept nicht mehr lesbar ist (ein fremdes Rezept wurde wieder privat gemacht) */
  available: boolean;
  /** Anzeigename bei fremden öffentlichen Rezepten, sonst null */
  authorName: string | null;
  /** Makros einer Portion; null, wenn das Rezept keine Zutaten hat */
  perServing: DayMacros | null;
  /** Meal Prep (Phase 11): Batch, zu dem der Eintrag gehört; Reste sind die Folge-Einträge */
  batchId: string | null;
  isLeftover: boolean;
};

/** Alle Einträge der Woche (Montag bis Sonntag) mit Rezeptname und Makros pro Portion. */
export async function getWeekEntries(userId: string, monday: string): Promise<PlanEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_plan_entries")
    .select(
      "id, date, slot, servings, position, recipe_id, title, batch_id, is_leftover, recipes!meal_plan_entries_recipe_id_fkey(title, image_url, owner_id, profiles!recipes_owner_id_fkey(display_name))",
    )
    .eq("user_id", userId)
    .gte("date", monday)
    .lte("date", addDays(monday, 6))
    .order("date")
    .order("position")
    .order("created_at");
  if (error) throw new Error(`Wochenplan konnte nicht geladen werden (${error.code})`);

  const recipeIds = [...new Set(data.flatMap((e) => (e.recipe_id ? [e.recipe_id] : [])))];
  const { data: nutrition, error: nError } = recipeIds.length
    ? await supabase
        .from("recipe_nutrition")
        .select("recipe_id, ingredient_count, kcal_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving")
        .in("recipe_id", recipeIds)
    : { data: [], error: null };
  if (nError) throw new Error(`Nährwerte konnten nicht geladen werden (${nError.code})`);
  const byRecipe = new Map(nutrition.map((n) => [n.recipe_id, n]));

  return data.map((e) => {
    const n = e.recipe_id ? byRecipe.get(e.recipe_id) : undefined;
    return {
      id: e.id,
      date: e.date,
      slot: e.slot,
      servings: e.servings,
      position: e.position,
      recipeId: e.recipe_id,
      recipeTitle: e.recipe_id ? (e.recipes?.title ?? UNAVAILABLE_TITLE) : (e.title ?? ""),
      imagePath: e.recipes?.image_url ?? null,
      available: e.recipe_id == null || e.recipes != null,
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
      batchId: e.batch_id,
      isLeftover: e.is_leftover,
    };
  });
}

const EMPTY_GOALS: Goals = { kcal: null, protein: null, carbs: null, fat: null };

/** Tagesziel (Standard). */
export async function getDefaultGoals(userId: string): Promise<Goals> {
  return (await getAllGoals(userId)).default;
}

/** Standard- und Trainingstag-Ziel (Phase 11). Fehlende Ziele: alle Felder leer. */
export async function getAllGoals(userId: string): Promise<{ default: Goals; training: Goals }> {
  const supabase = await createClient();
  const { data } = await supabase.from("user_goals").select("goal_type, kcal, protein, carbs, fat").eq("user_id", userId);
  const pick = (type: "default" | "training"): Goals => {
    const row = data?.find((g) => g.goal_type === type);
    return row ? { kcal: row.kcal, protein: row.protein, carbs: row.carbs, fat: row.fat } : EMPTY_GOALS;
  };
  return { default: pick("default"), training: pick("training") };
}

/** Standard-Trainingstage (ISO-Wochentage) und im Plan umgeschaltete Tage im Zeitraum. */
export async function getTrainingDays(
  userId: string,
  from: string,
  to: string,
): Promise<{ weekdays: number[]; overrides: Record<string, boolean> }> {
  const supabase = await createClient();
  const [weekdays, days] = await Promise.all([
    getTrainingWeekdays(userId),
    supabase.from("plan_days").select("date, is_training_day").eq("user_id", userId).gte("date", from).lte("date", to),
  ]);
  return { weekdays, overrides: Object.fromEntries((days.data ?? []).map((d) => [d.date, d.is_training_day])) };
}

/** Standard-Trainingstage aus den Einstellungen (ISO-Wochentage 1 = Montag … 7 = Sonntag). */
export async function getTrainingWeekdays(userId: string): Promise<number[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("user_settings").select("training_weekdays").eq("user_id", userId).maybeSingle();
  return data?.training_weekdays ?? [];
}

export type PlanBatch = OpenBatch & { servingsCooked: number; planned: number };

/** Meal-Prep-Batches, deren Reste in der Woche noch eine Rolle spielen (Kochtag bis 3 Tage vor Montag). */
export async function getWeekBatches(userId: string, monday: string): Promise<PlanBatch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_prep_batches")
    .select(
      "id, recipe_id, cook_date, servings_cooked, recipes!meal_prep_batches_recipe_id_fkey(title), meal_plan_entries!meal_plan_entries_batch_id_fkey(servings, is_leftover)",
    )
    .eq("user_id", userId)
    .gte("cook_date", addDays(monday, -LEFTOVER_DAYS))
    .lte("cook_date", addDays(monday, 6));
  if (error) throw new Error(`Meal Prep konnte nicht geladen werden (${error.code})`);
  // Ohne Kochtag-Eintrag (z. B. beim Ersetzen einer Woche gelöscht) gilt der Batch als verworfen
  return data.filter((b) => b.meal_plan_entries.some((e) => !e.is_leftover)).map((b) => {
    const planned = b.meal_plan_entries.map((e) => e.servings);
    return {
      id: b.id,
      recipeId: b.recipe_id,
      title: b.recipes?.title ?? UNAVAILABLE_TITLE,
      cookDate: b.cook_date,
      servingsCooked: b.servings_cooked,
      planned: planned.reduce((a, c) => a + c, 0),
      remaining: batchRemaining(b.servings_cooked, planned),
    };
  });
}

/** Geplante Rezepte der zwei Tage vor dem Montag (für Reste-Vorschläge am Wochenanfang). */
export async function getPlannedBefore(userId: string, monday: string): Promise<{ date: string; recipeId: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("meal_plan_entries")
    .select("date, recipe_id")
    .eq("user_id", userId)
    .gte("date", addDays(monday, -2))
    .lt("date", monday);
  return (data ?? []).flatMap((e) => (e.recipe_id ? [{ date: e.date, recipeId: e.recipe_id }] : []));
}

/** Basis-Zutaten (Reis, Nudeln, Kartoffeln) je Rezept, aus den Zutatennamen. Nur lesbare Rezepte. */
export async function getRecipeBases(recipeIds: string[]): Promise<Record<string, BaseKey[]>> {
  if (recipeIds.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("recipe_ingredients")
    .select("recipe_id, ingredients!recipe_ingredients_ingredient_id_fkey(name)")
    .in("recipe_id", recipeIds);
  const names: Record<string, string[]> = {};
  for (const row of data ?? []) (names[row.recipe_id] ??= []).push(row.ingredients.name);
  return Object.fromEntries(
    Object.entries(names)
      .map(([id, list]) => [id, recipeBases(list)] as const)
      .filter(([, bases]) => bases.length > 0),
  );
}
