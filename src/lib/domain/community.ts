import type { RecipeListItem, RecipeListNutrition } from "./recipe-filter";

// Community (Phase 6): öffentliche Rezepte, Autorenanzeige, Auswahl im Wochenplan.
// Andere Nutzer sehen nur den Anzeigenamen, nie die E-Mail-Adresse (die liegt nur in auth.users).

export const UNKNOWN_AUTHOR = "Unbekannt";

/** Titel für Plan-Einträge, deren (fremdes) Rezept wieder privat ist oder gelöscht wurde. */
export const UNAVAILABLE_TITLE = "Rezept nicht mehr verfügbar";

/** Autor eines Rezepts, wie er in Entdecken angezeigt wird. */
export type RecipeAuthor = { name: string; isOwn: boolean };

/** Anzeigename oder „Unbekannt“, falls leer. */
export function authorName(displayName: string | null | undefined): string {
  const name = displayName?.trim();
  return name ? name : UNKNOWN_AUTHOR;
}

/** „von dir“ für eigene Rezepte, sonst „von <Anzeigename>“. */
export function authorLabel(author: RecipeAuthor): string {
  return author.isOwn ? "von dir" : `von ${author.name}`;
}

/** Öffentliches Rezept, wie es aus der Datenbank kommt (mit Anzeigename des Owners). */
export type PublicRecipeRow = Omit<RecipeListItem, "nutrition" | "isFavorite" | "isPublic" | "author" | "copied"> & {
  owner_id: string;
  display_name: string | null;
};

/**
 * Öffentliche Rezepte für „Entdecken“ aufbereiten: Makros, Favorit, Autor und ob der Nutzer
 * schon eine eigene Kopie hat (copiedIds = forked_from_id seiner Rezepte).
 */
export function toDiscoverItems(
  rows: PublicRecipeRow[],
  context: {
    userId: string;
    nutritionById: Map<string, RecipeListNutrition>;
    favoriteIds: Set<string>;
    copiedIds: Set<string>;
  },
): RecipeListItem[] {
  return rows.map(({ owner_id, display_name, ...recipe }) => {
    const isOwn = owner_id === context.userId;
    return {
      ...recipe,
      nutrition: context.nutritionById.get(recipe.id) ?? null,
      isFavorite: context.favoriteIds.has(recipe.id),
      isPublic: true,
      author: { name: authorName(display_name), isOwn },
      copied: !isOwn && context.copiedIds.has(recipe.id),
    };
  });
}

/** Rezept zur Auswahl im Wochenplan: aus dem eigenen Buch oder öffentlich von anderen. */
export type PlanRecipeOption = {
  id: string;
  title: string;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  /** Rezept ist als Meal Prep markiert (Phase 11: „Für mehrere Tage kochen“ vorschlagen) */
  isMealPrep: boolean;
  isFavorite: boolean;
  /** null = eigenes Rezept */
  authorName: string | null;
};

/**
 * Auswahl für den Wochenplan: eigene Rezepte und öffentliche Rezepte anderer.
 * Eigene öffentliche Rezepte stehen nur einmal drin (unter „Mein Buch“).
 */
export function planRecipeOptions(
  own: RecipeListItem[],
  community: RecipeListItem[],
): { own: PlanRecipeOption[]; community: PlanRecipeOption[] } {
  const toOption = (r: RecipeListItem, author: string | null): PlanRecipeOption => ({
    id: r.id,
    title: r.title,
    kcal: r.nutrition?.kcal_per_serving ?? null,
    protein: r.nutrition?.protein_per_serving ?? null,
    carbs: r.nutrition?.carbs_per_serving ?? null,
    fat: r.nutrition?.fat_per_serving ?? null,
    isMealPrep: r.is_meal_prep,
    isFavorite: r.isFavorite,
    authorName: author,
  });
  const ownIds = new Set(own.map((r) => r.id));
  return {
    own: own.map((r) => toOption(r, null)),
    community: community
      .filter((r) => !r.author?.isOwn && !ownIds.has(r.id))
      .map((r) => toOption(r, r.author?.name ?? UNKNOWN_AUTHOR)),
  };
}
