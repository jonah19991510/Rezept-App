import { describe, expect, it } from "vitest";
import {
  authorLabel,
  authorName,
  planRecipeOptions,
  toDiscoverItems,
  UNKNOWN_AUTHOR,
  type PublicRecipeRow,
} from "./community";
import { filterRecipes, parseRecipeFilter, type RecipeListItem, type RecipeListNutrition } from "./recipe-filter";

const ME = "user-me";
const ANNA = "user-anna";

function row(partial: Partial<PublicRecipeRow> & { id: string; title: string; owner_id: string }): PublicRecipeRow {
  return {
    description: null,
    category: null,
    tags: [],
    is_meal_prep: false,
    prep_minutes: null,
    cook_minutes: null,
    updated_at: "2026-10-01T00:00:00Z",
    display_name: null,
    ...partial,
  };
}

const nutrition = (kcal: number, protein: number): RecipeListNutrition => ({
  kcal_per_serving: kcal,
  protein_per_serving: protein,
  carbs_per_serving: 0,
  fat_per_serving: 0,
  is_high_protein: false,
  is_low_carb: false,
  is_vegetarian: false,
  is_vegan: false,
});

describe("authorName / authorLabel", () => {
  it("zeigt den Anzeigenamen, sonst „Unbekannt“", () => {
    expect(authorName("  Anna ")).toBe("Anna");
    expect(authorName("")).toBe(UNKNOWN_AUTHOR);
    expect(authorName(null)).toBe(UNKNOWN_AUTHOR);
  });

  it("eigene Rezepte heißen „von dir“", () => {
    expect(authorLabel({ name: "Jonah", isOwn: true })).toBe("von dir");
    expect(authorLabel({ name: "Anna", isOwn: false })).toBe("von Anna");
  });
});

describe("toDiscoverItems", () => {
  const rows = [
    row({ id: "r1", title: "Dal", owner_id: ANNA, display_name: "Anna" }),
    row({ id: "r2", title: "Bolognese", owner_id: ME, display_name: "Jonah" }),
    row({ id: "r3", title: "Shakshuka", owner_id: "user-ohne-namen", display_name: null }),
  ];
  const items = toDiscoverItems(rows, {
    userId: ME,
    nutritionById: new Map([["r1", nutrition(300, 18)]]),
    favoriteIds: new Set(["r3"]),
    // r2 steht hier, obwohl es mein eigenes ist: darf trotzdem nicht als „übernommen“ gelten
    copiedIds: new Set(["r1", "r2"]),
  });

  it("setzt Autor, Makros, Favorit und Kopie-Markierung", () => {
    expect(items[0]).toMatchObject({
      id: "r1",
      isPublic: true,
      author: { name: "Anna", isOwn: false },
      copied: true,
      isFavorite: false,
      nutrition: { kcal_per_serving: 300 },
    });
    expect(items[1]).toMatchObject({ author: { name: "Jonah", isOwn: true }, copied: false, nutrition: null });
    expect(items[2]).toMatchObject({ author: { name: UNKNOWN_AUTHOR, isOwn: false }, isFavorite: true, copied: false });
  });

  it("gibt keine Owner-ID und keine Datenbankfelder des Profils weiter", () => {
    for (const item of items) {
      expect(item).not.toHaveProperty("owner_id");
      expect(item).not.toHaveProperty("display_name");
    }
  });

  it("die Suche findet Rezepte auch über den Anzeigenamen", () => {
    expect(filterRecipes(items, parseRecipeFilter({ q: "anna" })).map((r) => r.id)).toEqual(["r1"]);
    expect(filterRecipes(items, parseRecipeFilter({ q: "dal anna" })).map((r) => r.id)).toEqual(["r1"]);
    expect(filterRecipes(items, parseRecipeFilter({ favoriten: "1" })).map((r) => r.id)).toEqual(["r3"]);
  });
});

describe("planRecipeOptions", () => {
  const base = { description: null, category: null, tags: [], is_meal_prep: false, prep_minutes: null, cook_minutes: null, updated_at: "2026-10-01T00:00:00Z" };
  const own: RecipeListItem[] = [
    { ...base, id: "o1", title: "Mein Curry", nutrition: nutrition(500, 30), isFavorite: true },
    { ...base, id: "r2", title: "Bolognese", nutrition: null, isFavorite: false, isPublic: true },
  ];

  const community = toDiscoverItems(
    [
      row({ id: "r1", title: "Dal", owner_id: ANNA, display_name: "Anna" }),
      row({ id: "r2", title: "Bolognese", owner_id: ME, display_name: "Jonah" }),
    ],
    { userId: ME, nutritionById: new Map([["r1", nutrition(300, 18)]]), favoriteIds: new Set(), copiedIds: new Set() },
  );

  it("trennt eigenes Buch und Rezepte anderer, eigene öffentliche nur einmal", () => {
    const options = planRecipeOptions(own, community);
    expect(options.own.map((o) => o.id)).toEqual(["o1", "r2"]);
    expect(options.own.every((o) => o.authorName === null)).toBe(true);
    expect(options.community).toEqual([
      { id: "r1", title: "Dal", kcal: 300, protein: 18, carbs: 0, fat: 0, isMealPrep: false, isFavorite: false, authorName: "Anna" },
    ]);
  });

  it("übernimmt Makros pro Portion und Favoriten", () => {
    expect(planRecipeOptions(own, []).own[0]).toEqual({
      id: "o1",
      title: "Mein Curry",
      kcal: 500,
      protein: 30,
      carbs: 0,
      fat: 0,
      isMealPrep: false,
      isFavorite: true,
      authorName: null,
    });
  });
});
