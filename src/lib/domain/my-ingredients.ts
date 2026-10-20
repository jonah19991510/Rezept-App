import type { Enums } from "@/lib/supabase/database.types";
import type { IngredientOption } from "./ingredient-option";

// Seite „Zutaten“: alle Zutaten aus den eigenen Rezepten und alle selbst angelegten, mit eigenem Preis.
// Bearbeiten (Nährwerte, Dichte, Stückgewicht …) geht nur bei selbst angelegten Zutaten (Quelle „user“, RLS);
// Grundbestand und Open-Food-Facts-Daten sind für alle gleich. Preise sind immer eigene und gehen für jede Zutat.

export type IngredientRow = IngredientOption & { created_by: string | null };

export type MyIngredientPrice = {
  id: string;
  price: number;
  packageAmount: number;
  packageUnit: "g" | "ml" | "piece";
  store: string | null;
  /** Preis pro Gramm, null wenn nicht umrechenbar (Stück ohne Stückgewicht) */
  perGram: number | null;
};

export type MyIngredient = {
  ingredient: IngredientOption;
  /**
   * Selbst erstellt (Quelle „user“). Aus Open Food Facts übernommene Zutaten zählen nicht dazu: die hat der Nutzer
   * nur hinzugefügt, nicht erstellt. Selbst erstellte sind auch die einzigen, die er ändern darf (RLS).
   */
  isOwn: boolean;
  /** eigene Rezepte und Cocktails, in denen die Zutat vorkommt (alphabetisch, ohne Doppelte) */
  recipes: { id: string; title: string; type: Enums<"recipe_type"> }[];
  price: MyIngredientPrice | null;
};

export function canEditIngredient(row: { created_by: string | null; source: Enums<"ingredient_source"> }, userId: string): boolean {
  return row.created_by === userId && row.source === "user";
}

const collator = new Intl.Collator("de-DE", { sensitivity: "base", numeric: true });

/** Zutaten aus eigenen Rezepten und selbst angelegte zusammenführen, je Zutat einmal, nach Name sortiert. */
export function collectMyIngredients(input: {
  userId: string;
  recipes: { id: string; title: string; type: Enums<"recipe_type">; ingredients: IngredientRow[] }[];
  own: IngredientRow[];
  prices: Map<string, MyIngredientPrice>;
}): MyIngredient[] {
  const byId = new Map<string, MyIngredient>();
  const add = (row: IngredientRow) => {
    let item = byId.get(row.id);
    if (!item) {
      const { created_by, ...ingredient } = row;
      item = {
        ingredient,
        isOwn: canEditIngredient({ created_by, source: row.source }, input.userId),
        recipes: [],
        price: input.prices.get(row.id) ?? null,
      };
      byId.set(row.id, item);
    }
    return item;
  };
  for (const row of input.own) add(row);
  for (const recipe of input.recipes) {
    for (const row of recipe.ingredients) {
      const item = add(row);
      if (!item.recipes.some((r) => r.id === recipe.id)) item.recipes.push({ id: recipe.id, title: recipe.title, type: recipe.type });
    }
  }
  const result = [...byId.values()];
  for (const item of result) item.recipes.sort((a, b) => collator.compare(a.title, b.title));
  return result.sort((a, b) => collator.compare(a.ingredient.name, b.ingredient.name));
}

export const INGREDIENT_VIEWS = {
  alle: "Alle",
  rezepte: "In Rezepten",
  eigene: "Selbst angelegt",
  "ohne-preis": "Ohne Preis",
} as const;

export type IngredientView = keyof typeof INGREDIENT_VIEWS;

function normalize(s: string) {
  return s.toLocaleLowerCase("de-DE").normalize("NFKD").replace(/\p{Diacritic}/gu, "");
}

/** Ansicht und Suche (alle Wörter müssen im Namen vorkommen). */
export function filterMyIngredients(items: MyIngredient[], filter: { q?: string; view?: IngredientView }): MyIngredient[] {
  const words = normalize(filter.q ?? "").split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    switch (filter.view ?? "alle") {
      case "rezepte":
        if (item.recipes.length === 0) return false;
        break;
      case "eigene":
        if (!item.isOwn) return false;
        break;
      case "ohne-preis":
        if (item.price) return false;
        break;
    }
    const name = normalize(item.ingredient.name);
    return words.every((w) => name.includes(w));
  });
}

/** Herkunft für die Anzeige. */
export function ingredientOrigin(item: Pick<MyIngredient, "isOwn" | "ingredient">): string {
  if (item.ingredient.source === "seed") return "Grundbestand";
  if (item.ingredient.source === "openfoodfacts") return "Open Food Facts";
  return item.isOwn ? "selbst angelegt" : "von jemand anderem angelegt";
}

/** Ernährungsform, wenn „automatisch“ gewählt ist (wie der Trigger beim Anlegen). */
export function defaultDiet(group: Enums<"food_group">): Enums<"ingredient_diet"> {
  if (group === "meat" || group === "fish" || group === "other") return "none";
  if (group === "dairy" || group === "egg") return "vegetarian";
  return "vegan";
}
