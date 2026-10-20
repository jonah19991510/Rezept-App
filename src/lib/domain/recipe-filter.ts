import { z } from "zod";
import { AUTO_TAG_LABELS, type AutoTag } from "@/lib/labels";
import type { RecipeAuthor } from "./community";
import type { Enums } from "@/lib/supabase/database.types";
import { GOOD_RATING } from "./cooklog";
import { parseDecimal } from "./decimal";
import { daysBetween } from "./week";

export type RecipeListNutrition = {
  kcal_per_serving: number | null;
  protein_per_serving: number | null;
  carbs_per_serving: number | null;
  fat_per_serving: number | null;
  is_high_protein: boolean | null;
  is_low_carb: boolean | null;
  is_vegetarian: boolean | null;
  is_vegan: boolean | null;
};

/** Phase 15: Kurzinfo eines Cocktails für Karte, Filter und Sortierung (Bar). */
export type CocktailSummary = {
  method: Enums<"cocktail_method"> | null;
  glass: Enums<"glass"> | null;
  abvPercent: number | null;
  alcoholGrams: number | null;
  baseSpirit: string | null;
};

export type RecipeListItem = {
  id: string;
  title: string;
  description: string | null;
  category: Enums<"recipe_category"> | null;
  tags: string[];
  is_meal_prep: boolean;
  prep_minutes: number | null;
  cook_minutes: number | null;
  updated_at: string;
  nutrition: RecipeListNutrition | null;
  isFavorite: boolean;
  /** Storage-Pfad des Fotos (recipes.image_url) */
  image_url?: string | null;
  /** veröffentlicht (Entdecken) */
  isPublic?: boolean;
  /** nur in Entdecken gesetzt */
  author?: RecipeAuthor;
  /** in Entdecken: Der Nutzer hat schon eine eigene Kopie */
  copied?: boolean;
  /** Phase 12 (eigenes Buch): Kosten pro Portion nach eigenen Preisen */
  costPerServing?: number | null;
  /** false: einzelnen Zutaten fehlt ein Preis, die Kosten sind eine Untergrenze */
  costComplete?: boolean;
  /** Phase 12: Ø-Bewertung aus dem Koch-Log und letztes Kochen (YYYY-MM-DD) */
  avgRating?: number | null;
  lastCooked?: string | null;
  /** Phase 15: nur bei Cocktails */
  cocktail?: CocktailSummary;
};

export function autoTagsFor(item: Pick<RecipeListItem, "is_meal_prep" | "nutrition">): AutoTag[] {
  const n = item.nutrition;
  const tags: AutoTag[] = [];
  if (n?.is_high_protein) tags.push("high_protein");
  if (n?.is_vegan) tags.push("vegan");
  else if (n?.is_vegetarian) tags.push("vegetarian");
  if (n?.is_low_carb) tags.push("low_carb");
  if (item.is_meal_prep) tags.push("meal_prep");
  return tags;
}

export function totalMinutes(item: Pick<RecipeListItem, "prep_minutes" | "cook_minutes">): number | null {
  if (item.prep_minutes == null && item.cook_minutes == null) return null;
  return (item.prep_minutes ?? 0) + (item.cook_minutes ?? 0);
}

const SORTS = ["neu", "name", "protein", "kcal", "zeit", "stark", "leicht"] as const;
export type RecipeSort = (typeof SORTS)[number];

const optionalNumber = z
  .string()
  .optional()
  .transform((v) => {
    const n = parseDecimal(v ?? null);
    return n != null && n >= 0 ? n : undefined;
  });

/** Filter aus der URL (?q=…&kategorie=…&tag=…&protein=…&zeit=…&favoriten=1&sortierung=…). */
export const recipeFilterSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  kategorie: z
    .enum(["pasta", "rice", "bowl", "soup", "salad", "casserole", "meat", "fish", "breakfast", "snack", "dessert", "drink"])
    .optional()
    .catch(undefined),
  tag: z.string().trim().max(40).optional().catch(undefined),
  protein: optionalNumber.catch(undefined),
  zeit: optionalNumber.catch(undefined),
  favoriten: z
    .string()
    .optional()
    .transform((v) => v === "1")
    .catch(false),
  sortierung: z.enum(SORTS).optional().catch(undefined),
  /** Phase 15 (Bar): Basisspirituose und Methode */
  basis: z.string().trim().max(60).optional().catch(undefined),
  methode: z.enum(["shaken", "stirred", "built", "blended"]).optional().catch(undefined),
  /** Phase 12: höchstens so viel € pro Portion */
  kosten: optionalNumber.catch(undefined),
  /** Phase 12: Ø-Bewertung mindestens (1–5) */
  bewertung: optionalNumber.catch(undefined),
  /** Phase 12: nur gut bewertete, lange nicht gekochte */
  lange: z
    .string()
    .optional()
    .transform((v) => v === "1")
    .catch(false),
});

export type RecipeFilter = z.infer<typeof recipeFilterSchema>;

export function parseRecipeFilter(params: Record<string, string | string[] | undefined>): RecipeFilter {
  const flat = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v === "" ? undefined : v]),
  );
  return recipeFilterSchema.parse(flat);
}

function normalize(s: string) {
  return s.toLocaleLowerCase("de-DE").normalize("NFKD").replace(/\p{Diacritic}/gu, "");
}

function matchesAutoTag(item: RecipeListItem, tag: AutoTag) {
  const n = item.nutrition;
  switch (tag) {
    case "high_protein":
      return Boolean(n?.is_high_protein);
    case "vegetarian":
      return Boolean(n?.is_vegetarian); // vegane Rezepte sind auch vegetarisch
    case "vegan":
      return Boolean(n?.is_vegan);
    case "low_carb":
      return Boolean(n?.is_low_carb);
    case "meal_prep":
      return item.is_meal_prep;
  }
}

function matchesTag(item: RecipeListItem, tag: string) {
  if (tag in AUTO_TAG_LABELS) return matchesAutoTag(item, tag as AutoTag);
  const wanted = normalize(tag);
  return item.tags.some((t) => normalize(t) === wanted);
}

/** Für „lange nicht gekocht“: heute und die Wochen-Grenze aus den Einstellungen. */
export type FilterContext = { today: string; longNotCookedWeeks: number };

export function filterRecipes(items: RecipeListItem[], filter: RecipeFilter, context?: FilterContext): RecipeListItem[] {
  const query = filter.q ? normalize(filter.q) : null;

  const result = items.filter((item) => {
    if (filter.favoriten && !item.isFavorite) return false;
    if (filter.kategorie && item.category !== filter.kategorie) return false;
    if (filter.basis && (item.cocktail?.baseSpirit ?? "") !== filter.basis) return false;
    if (filter.methode && item.cocktail?.method !== filter.methode) return false;
    if (filter.tag && !matchesTag(item, filter.tag)) return false;
    if (filter.protein != null && (item.nutrition?.protein_per_serving ?? 0) < filter.protein) return false;
    if (filter.zeit != null) {
      const minutes = totalMinutes(item);
      if (minutes == null || minutes > filter.zeit) return false;
    }
    if (filter.kosten != null && (item.costPerServing == null || item.costPerServing > filter.kosten)) return false;
    if (filter.bewertung != null && (item.avgRating ?? 0) < filter.bewertung) return false;
    if (filter.lange && context) {
      if ((item.avgRating ?? 0) < GOOD_RATING || !item.lastCooked) return false;
      if (daysBetween(item.lastCooked, context.today) < context.longNotCookedWeeks * 7) return false;
    }
    if (query) {
      const haystack = normalize([item.title, item.description ?? "", ...item.tags, item.author?.name ?? ""].join(" "));
      if (!query.split(/\s+/).every((word) => haystack.includes(word))) return false;
    }
    return true;
  });

  const sort = filter.sortierung ?? "neu";
  const byTitle = (a: RecipeListItem, b: RecipeListItem) => a.title.localeCompare(b.title, "de");
  result.sort((a, b) => {
    switch (sort) {
      case "name":
        return byTitle(a, b);
      case "protein":
        return (b.nutrition?.protein_per_serving ?? 0) - (a.nutrition?.protein_per_serving ?? 0) || byTitle(a, b);
      case "kcal":
        return (a.nutrition?.kcal_per_serving ?? Infinity) - (b.nutrition?.kcal_per_serving ?? Infinity) || byTitle(a, b);
      case "zeit":
        return (totalMinutes(a) ?? Infinity) - (totalMinutes(b) ?? Infinity) || byTitle(a, b);
      case "stark":
        return (b.cocktail?.abvPercent ?? -1) - (a.cocktail?.abvPercent ?? -1) || byTitle(a, b);
      case "leicht":
        return (a.cocktail?.abvPercent ?? Infinity) - (b.cocktail?.abvPercent ?? Infinity) || byTitle(a, b);
      default:
        return b.updated_at.localeCompare(a.updated_at) || byTitle(a, b);
    }
  });
  return result;
}

/** Phase 15: alle Basisspirituosen der Liste (für die Filterauswahl), alphabetisch. */
export function collectBaseSpirits(items: RecipeListItem[]): string[] {
  const set = new Set(items.flatMap((i) => (i.cocktail?.baseSpirit ? [i.cocktail.baseSpirit] : [])));
  return [...set].sort((a, b) => a.localeCompare(b, "de"));
}

/** Alle eigenen Tags (für die Filterauswahl), alphabetisch und ohne Doppelte. */
export function collectTags(items: RecipeListItem[]): string[] {
  const seen = new Map<string, string>();
  for (const item of items) for (const tag of item.tags) if (!seen.has(normalize(tag))) seen.set(normalize(tag), tag);
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "de"));
}

export function hasActiveFilter(filter: RecipeFilter) {
  return Boolean(
    filter.q ||
      filter.kategorie ||
      filter.basis ||
      filter.methode ||
      filter.tag ||
      filter.protein != null ||
      filter.zeit != null ||
      filter.favoriten ||
      filter.kosten != null ||
      filter.bewertung != null ||
      filter.lange,
  );
}
