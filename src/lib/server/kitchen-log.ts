import "server-only";
import type { CookLog } from "@/lib/domain/cooklog";
import { pricePerGram, type IngredientWeights, type PriceUnit } from "@/lib/domain/costs";
import { parseSnapshot, type RecipeSnapshot } from "@/lib/domain/versions";
import { todayInBerlin } from "@/lib/domain/week";
import { createClient } from "@/lib/supabase/server";

// Phase 12: Koch-Log, Preise/Kosten und Rezept-Versionen lesen.

type CookRow = { id: string; recipe_id: string; cooked_at: string; rating: number | null; note: string | null; servings: number | null; recipe_version: number | null };

function toCookLog(row: CookRow): CookLog {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    date: todayInBerlin(new Date(row.cooked_at)),
    rating: row.rating,
    note: row.note,
    servings: row.servings,
    version: row.recipe_version,
  };
}

/** Eigene Koch-Log-Einträge, optional nur für ein Rezept; neueste zuerst. */
export async function getCookLogs(userId: string, recipeId?: string): Promise<CookLog[]> {
  const supabase = await createClient();
  let query = supabase
    .from("cook_logs")
    .select("id, recipe_id, cooked_at, rating, note, servings, recipe_version")
    .eq("user_id", userId)
    .order("cooked_at", { ascending: false });
  if (recipeId) query = query.eq("recipe_id", recipeId);
  const { data, error } = await query;
  if (error) throw new Error(`Koch-Log konnte nicht geladen werden (${error.code})`);
  return data.map(toCookLog);
}

export type RecipeCost = { total: number; perServing: number; priced: number; count: number };

/** Kosten aller lesbaren Rezepte nach den eigenen Preisen (View recipe_costs). Nur Rezepte mit mindestens einem Preis. */
export async function getRecipeCosts(recipeIds?: string[]): Promise<Map<string, RecipeCost>> {
  const supabase = await createClient();
  let query = supabase.from("recipe_costs").select("recipe_id, cost_total, cost_per_serving, priced_count, ingredient_count").gt("priced_count", 0);
  if (recipeIds) {
    if (recipeIds.length === 0) return new Map();
    query = query.in("recipe_id", recipeIds);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Kosten konnten nicht geladen werden (${error.code})`);
  return new Map(
    data.flatMap((r) =>
      r.recipe_id
        ? [
            [
              r.recipe_id,
              {
                total: r.cost_total ?? 0,
                perServing: r.cost_per_serving ?? 0,
                priced: r.priced_count ?? 0,
                count: r.ingredient_count ?? 0,
              },
            ] as const,
          ]
        : [],
    ),
  );
}

/** Kosten eines Rezepts inklusive Anzahl Zutaten (auch ohne einen einzigen Preis). */
export async function getRecipeCost(recipeId: string): Promise<RecipeCost | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("recipe_costs")
    .select("cost_total, cost_per_serving, priced_count, ingredient_count")
    .eq("recipe_id", recipeId)
    .maybeSingle();
  if (!data) return null;
  return { total: data.cost_total ?? 0, perServing: data.cost_per_serving ?? 0, priced: data.priced_count ?? 0, count: data.ingredient_count ?? 0 };
}

export type PriceRow = {
  id: string;
  ingredientId: string;
  name: string;
  price: number;
  packageAmount: number;
  packageUnit: PriceUnit;
  store: string | null;
  updatedAt: string;
  info: IngredientWeights;
  /** null, wenn sich die Packung nicht in Gramm umrechnen lässt (Stück ohne Stückgewicht) */
  perGram: number | null;
};

/** Eigene Preise mit Zutatenname, alphabetisch. */
export async function getPrices(userId: string): Promise<PriceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ingredient_prices")
    .select(
      "id, ingredient_id, price, package_amount, package_unit, store, updated_at, ingredients!ingredient_prices_ingredient_id_fkey(name, density_g_per_ml, piece_weight_g)",
    )
    .eq("user_id", userId);
  if (error) throw new Error(`Preise konnten nicht geladen werden (${error.code})`);
  return data
    .map((p) => {
      const info = { density_g_per_ml: p.ingredients.density_g_per_ml, piece_weight_g: p.ingredients.piece_weight_g };
      const unit: PriceUnit = p.package_unit === "ml" || p.package_unit === "piece" ? p.package_unit : "g";
      return {
        id: p.id,
        ingredientId: p.ingredient_id,
        name: p.ingredients.name,
        price: p.price,
        packageAmount: p.package_amount,
        packageUnit: unit,
        store: p.store,
        updatedAt: p.updated_at,
        info,
        perGram: pricePerGram({ price: p.price, packageAmount: p.package_amount, packageUnit: p.package_unit }, info),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export type RecipeVersion = { version: number; changeNote: string | null; createdAt: string; snapshot: RecipeSnapshot };

/** Versionen eines eigenen Rezepts, neueste zuerst (RLS: nur der Owner sieht sie). */
export async function getRecipeVersions(recipeId: string): Promise<RecipeVersion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipe_versions")
    .select("version, change_note, created_at, snapshot")
    .eq("recipe_id", recipeId)
    .order("version", { ascending: false });
  if (error) throw new Error(`Versionen konnten nicht geladen werden (${error.code})`);
  return data.map((v) => ({ version: v.version, changeNote: v.change_note, createdAt: v.created_at, snapshot: parseSnapshot(v.snapshot) }));
}

/** Nährwerte pro 100 g für die Zutaten aller Versionen (für die Makro-Differenz im Vergleich). */
export async function getIngredientNutrition(ingredientIds: string[]) {
  if (ingredientIds.length === 0) return new Map<string, { kcal: number; protein: number; carbs: number; fat: number }>();
  const supabase = await createClient();
  const { data } = await supabase.from("ingredients").select("id, kcal, protein, carbs, fat").in("id", ingredientIds);
  return new Map((data ?? []).map((i) => [i.id, { kcal: i.kcal, protein: i.protein, carbs: i.carbs, fat: i.fat }]));
}

/** „Lange nicht gekocht“: Wochen aus den Einstellungen. */
export async function getLongNotCookedWeeks(userId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.from("user_settings").select("long_not_cooked_weeks").eq("user_id", userId).maybeSingle();
  return data?.long_not_cooked_weeks ?? 6;
}
