import "server-only";
import { cache } from "react";
import { baseSpirit } from "@/lib/domain/cocktail";
import { authorName, toDiscoverItems } from "@/lib/domain/community";
import { toListSort, toRecipeView, type CocktailSummary, type RecipeListItem, type RecipeSort, type RecipeView } from "@/lib/domain/recipe-filter";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

const LIST_COLUMNS = "id, title, description, category, tags, is_meal_prep, prep_minutes, cook_minutes, updated_at, image_url";
const LIST_NUTRITION =
  "recipe_id, kcal_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving, is_high_protein, is_low_carb, is_vegetarian, is_vegan";

type RecipeType = "dish" | "cocktail";

/** Gespeicherte Ansicht (Raster oder Liste) und Sortierung der Rezeptliste; die Sortierung je Küche bzw. Bar. */
export async function getRecipeListSettings(userId: string, type: RecipeType): Promise<{ view: RecipeView; sort: RecipeSort }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_settings")
    .select("recipe_view, recipe_sort, cocktail_sort")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    view: toRecipeView(data?.recipe_view),
    sort: type === "cocktail" ? toListSort(data?.cocktail_sort, "bar") : toListSort(data?.recipe_sort, "kitchen"),
  };
}

/** Alle eigenen Rezepte (Küche) bzw. Cocktails (Bar) mit Makros (aus der View) und Favoriten-Markierung. */
export async function getOwnRecipeList(userId: string, type: RecipeType = "dish"): Promise<RecipeListItem[]> {
  const supabase = await createClient();
  const [recipes, nutrition, favorites] = await Promise.all([
    supabase.from("recipes").select(`${LIST_COLUMNS}, is_public`).eq("owner_id", userId).eq("recipe_type", type),
    supabase.from("recipe_nutrition").select(LIST_NUTRITION),
    supabase.from("favorites").select("recipe_id"),
  ]);
  if (recipes.error) throw new Error("Rezepte konnten nicht geladen werden.");

  const nutritionById = new Map((nutrition.data ?? []).map((n) => [n.recipe_id, n]));
  const favoriteIds = new Set((favorites.data ?? []).map((f) => f.recipe_id));
  const cocktails = type === "cocktail" ? await getCocktailSummaries(recipes.data.map((r) => r.id)) : null;

  return recipes.data.map(({ is_public, ...r }) => ({
    ...r,
    nutrition: nutritionById.get(r.id) ?? null,
    isFavorite: favoriteIds.has(r.id),
    isPublic: is_public,
    ...(cocktails ? { cocktail: cocktails.get(r.id) ?? EMPTY_COCKTAIL } : {}),
  }));
}

const EMPTY_COCKTAIL: CocktailSummary = { method: null, glass: null, abvPercent: null, alcoholGrams: null, baseSpirit: null };

/**
 * Phase 15: Methode, Glas, Alkoholgehalt (View recipe_alcohol) und Basisspirituose (aus den Zutaten)
 * für lesbare Cocktails.
 */
export async function getCocktailSummaries(ids: string[]): Promise<Map<string, CocktailSummary>> {
  if (ids.length === 0) return new Map();
  const supabase = await createClient();
  const [details, alcohol, lines] = await Promise.all([
    supabase.from("cocktail_details").select("recipe_id, glass, method").in("recipe_id", ids),
    supabase.from("recipe_alcohol").select("recipe_id, abv_percent, alcohol_g_per_drink").in("recipe_id", ids),
    supabase
      .from("recipe_ingredients")
      .select("recipe_id, amount, unit, ingredients!recipe_ingredients_ingredient_id_fkey(name, abv, food_group, density_g_per_ml)")
      .in("recipe_id", ids),
  ]);
  if (details.error || alcohol.error || lines.error) throw new Error("Cocktail-Angaben konnten nicht geladen werden.");

  const result = new Map<string, CocktailSummary>();
  for (const id of ids) {
    const d = details.data.find((x) => x.recipe_id === id);
    const a = alcohol.data.find((x) => x.recipe_id === id);
    result.set(id, {
      method: d?.method ?? null,
      glass: d?.glass ?? null,
      abvPercent: a?.abv_percent ?? null,
      alcoholGrams: a?.alcohol_g_per_drink ?? null,
      baseSpirit: baseSpirit(
        lines.data
          .filter((l) => l.recipe_id === id)
          .map((l) => ({ name: l.ingredients.name, amount: l.amount, unit: l.unit, ingredient: l.ingredients })),
      ),
    });
  }
  return result;
}

/**
 * Alle öffentlichen Rezepte (auch die eigenen) für „Entdecken“ und den Wochenplan,
 * mit Anzeigename des Autors (nie die E-Mail) und Markierung, ob der Nutzer schon eine Kopie hat.
 */
export async function getPublicRecipeList(userId: string, type: RecipeType = "dish"): Promise<RecipeListItem[]> {
  const supabase = await createClient();
  const [recipes, favorites, copies] = await Promise.all([
    supabase
      .from("recipes")
      .select(`${LIST_COLUMNS}, owner_id, profiles!recipes_owner_id_fkey(display_name)`)
      .eq("is_public", true)
      .eq("recipe_type", type),
    supabase.from("favorites").select("recipe_id"),
    supabase.from("recipes").select("forked_from_id").eq("owner_id", userId).not("forked_from_id", "is", null),
  ]);
  if (recipes.error) throw new Error(`Öffentliche Rezepte konnten nicht geladen werden (${recipes.error.code})`);

  const ids = recipes.data.map((r) => r.id);
  const nutrition = ids.length
    ? await supabase.from("recipe_nutrition").select(LIST_NUTRITION).in("recipe_id", ids)
    : { data: [], error: null };
  if (nutrition.error) throw new Error(`Nährwerte konnten nicht geladen werden (${nutrition.error.code})`);
  const cocktails = type === "cocktail" ? await getCocktailSummaries(ids) : null;

  const items = toDiscoverItems(
    recipes.data.map(({ profiles, ...r }) => ({ ...r, display_name: profiles?.display_name ?? null })),
    {
      userId,
      nutritionById: new Map(nutrition.data.flatMap((n) => (n.recipe_id ? [[n.recipe_id, n] as const] : []))),
      favoriteIds: new Set((favorites.data ?? []).map((f) => f.recipe_id)),
      copiedIds: new Set((copies.data ?? []).flatMap((c) => (c.forked_from_id ? [c.forked_from_id] : []))),
    },
  );
  return cocktails ? items.map((i) => ({ ...i, cocktail: cocktails.get(i.id) ?? EMPTY_COCKTAIL })) : items;
}

/** Titel aller eigenen Gerichte (für verlinkte Beilagen). */
export async function getOwnRecipeTitles(userId: string): Promise<{ id: string; title: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("recipes").select("id, title").eq("owner_id", userId).eq("recipe_type", "dish");
  return data ?? [];
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
  /** Phase 15: Cocktail-Felder und Alkoholgehalt (nur bei Cocktails) */
  cocktail: Tables<"cocktail_details"> | null;
  alcohol: Tables<"recipe_alcohol"> | null;
  /** Original, falls das Rezept aus Entdecken übernommen wurde und das Original noch lesbar ist */
  forkedFrom: { id: string; title: string; authorName: string } | null;
  /** Bei fremden Rezepten: eigene Kopie, falls schon übernommen (die neueste) */
  ownCopyId: string | null;
};

/** Ein Rezept mit Zutaten, Schritten und Makros. null, wenn es nicht existiert oder nicht lesbar ist (RLS). */
export const getRecipeDetail = cache(async (recipeId: string, userId: string): Promise<RecipeDetail | null> => {
  const supabase = await createClient();
  // Beziehungen mit Fremdschlüssel-Namen angeben: recipes ↔ profiles ist sonst mehrdeutig
  // (direkt über owner_id und zusätzlich über die Tabelle favorites), PostgREST antwortet dann mit 300.
  const { data: recipe, error } = await supabase
    .from("recipes")
    .select(
      "*, profiles!recipes_owner_id_fkey(display_name), recipe_ingredients!recipe_ingredients_recipe_id_fkey(*, ingredients(*)), recipe_steps!recipe_steps_recipe_id_fkey(*), cocktail_details!cocktail_details_recipe_id_fkey(*)",
    )
    .eq("id", recipeId)
    .maybeSingle();
  // Ein Abfragefehler ist kein „nicht gefunden“: lieber die Fehlerseite zeigen als falsch 404
  if (error) throw new Error(`Rezept konnte nicht geladen werden (${error.code})`);
  if (!recipe) return null;

  const isOwner = recipe.owner_id === userId;
  const isCocktail = recipe.recipe_type === "cocktail";
  const [{ data: nutrition }, { data: favorite }, { data: original }, { data: copy }, { data: alcohol }] = await Promise.all([
    supabase.from("recipe_nutrition").select("*").eq("recipe_id", recipeId).maybeSingle(),
    supabase.from("favorites").select("recipe_id").eq("recipe_id", recipeId).maybeSingle(),
    // Original nur, wenn es noch existiert und lesbar ist (eigenes oder öffentlich)
    recipe.forked_from_id
      ? supabase
          .from("recipes")
          .select("id, title, profiles!recipes_owner_id_fkey(display_name)")
          .eq("id", recipe.forked_from_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    isOwner
      ? Promise.resolve({ data: null })
      : supabase
          .from("recipes")
          .select("id")
          .eq("owner_id", userId)
          .eq("forked_from_id", recipeId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
    isCocktail
      ? supabase.from("recipe_alcohol").select("*").eq("recipe_id", recipeId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const { profiles, recipe_ingredients, recipe_steps, cocktail_details, ...base } = recipe;
  return {
    recipe: base,
    authorName: profiles?.display_name ?? null,
    isOwner,
    isFavorite: Boolean(favorite),
    ingredients: recipe_ingredients
      .map(({ ingredients, ...line }) => ({ ...line, ingredient: ingredients }))
      .sort((a, b) => a.position - b.position),
    steps: [...recipe_steps].sort((a, b) => a.position - b.position),
    nutrition: nutrition ?? null,
    cocktail: isCocktail ? (cocktail_details ?? null) : null,
    alcohol: alcohol ?? null,
    forkedFrom: original
      ? { id: original.id, title: original.title, authorName: authorName(original.profiles?.display_name) }
      : null,
    ownCopyId: copy?.id ?? null,
  };
});
