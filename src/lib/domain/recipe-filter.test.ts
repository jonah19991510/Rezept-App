import { describe, expect, it } from "vitest";
import { autoTagsFor, collectTags, filterRecipes, parseRecipeFilter, type RecipeListItem } from "./recipe-filter";

function recipe(partial: Partial<RecipeListItem> & { id: string; title: string }): RecipeListItem {
  return {
    description: null,
    category: null,
    tags: [],
    is_meal_prep: false,
    prep_minutes: null,
    cook_minutes: null,
    updated_at: "2026-10-01T00:00:00Z",
    nutrition: null,
    isFavorite: false,
    ...partial,
  };
}

const nutrition = (protein: number, kcal: number, flags: Partial<Record<"hp" | "lc" | "veg" | "vegan", boolean>> = {}) => ({
  kcal_per_serving: kcal,
  protein_per_serving: protein,
  carbs_per_serving: 0,
  fat_per_serving: 0,
  is_high_protein: flags.hp ?? false,
  is_low_carb: flags.lc ?? false,
  is_vegetarian: flags.veg ?? false,
  is_vegan: flags.vegan ?? false,
});

const items = [
  recipe({ id: "1", title: "Spaghetti Bolognese", category: "pasta", tags: ["Klassiker"], prep_minutes: 15, cook_minutes: 45, nutrition: nutrition(40, 800, { hp: true }), updated_at: "2026-10-03T00:00:00Z" }),
  recipe({ id: "2", title: "Rote-Linsen-Dal", category: "soup", tags: ["Wohlfühlessen"], prep_minutes: 10, cook_minutes: 25, is_meal_prep: true, nutrition: nutrition(18, 300, { veg: true, vegan: true }), isFavorite: true, updated_at: "2026-10-02T00:00:00Z" }),
  recipe({ id: "3", title: "Shakshuka mit Feta", category: "breakfast", tags: ["Brunch"], prep_minutes: 10, cook_minutes: 20, nutrition: nutrition(23, 420, { lc: true, veg: true }), updated_at: "2026-10-01T00:00:00Z" }),
];

const ids = (list: RecipeListItem[]) => list.map((r) => r.id);

describe("parseRecipeFilter", () => {
  it("liest gültige Werte und verwirft ungültige", () => {
    expect(parseRecipeFilter({ q: "dal", kategorie: "soup", protein: "20,5", favoriten: "1", sortierung: "name" })).toEqual({
      q: "dal",
      kategorie: "soup",
      tag: undefined,
      protein: 20.5,
      zeit: undefined,
      favoriten: true,
      sortierung: "name",
    });
    const bad = parseRecipeFilter({ kategorie: "pizza", protein: "viel", sortierung: "x" });
    expect(bad.kategorie).toBeUndefined();
    expect(bad.protein).toBeUndefined();
    expect(bad.sortierung).toBeUndefined();
  });
});

describe("filterRecipes", () => {
  const all = parseRecipeFilter({});

  it("sortiert standardmäßig nach zuletzt geändert", () => {
    expect(ids(filterRecipes(items, all))).toEqual(["1", "2", "3"]);
  });

  it("sucht im Titel, ohne auf Groß/Klein und Umlaute zu achten", () => {
    expect(ids(filterRecipes(items, parseRecipeFilter({ q: "linsen" })))).toEqual(["2"]);
    expect(ids(filterRecipes(items, parseRecipeFilter({ q: "wohlfuhl" })))).toEqual(["2"]);
  });

  it("filtert nach Kategorie, Auto-Tag und eigenem Tag", () => {
    expect(ids(filterRecipes(items, parseRecipeFilter({ kategorie: "pasta" })))).toEqual(["1"]);
    expect(ids(filterRecipes(items, parseRecipeFilter({ tag: "vegetarian" })))).toEqual(["2", "3"]);
    expect(ids(filterRecipes(items, parseRecipeFilter({ tag: "vegan" })))).toEqual(["2"]);
    expect(ids(filterRecipes(items, parseRecipeFilter({ tag: "meal_prep" })))).toEqual(["2"]);
    expect(ids(filterRecipes(items, parseRecipeFilter({ tag: "brunch" })))).toEqual(["3"]);
  });

  it("filtert nach Mindest-Protein und Gesamtzeit", () => {
    expect(ids(filterRecipes(items, parseRecipeFilter({ protein: "20" })))).toEqual(["1", "3"]);
    expect(ids(filterRecipes(items, parseRecipeFilter({ zeit: "35" })))).toEqual(["2", "3"]);
  });

  it("zeigt nur Favoriten", () => {
    expect(ids(filterRecipes(items, parseRecipeFilter({ favoriten: "1" })))).toEqual(["2"]);
  });

  it("sortiert nach Protein, kcal und Name", () => {
    expect(ids(filterRecipes(items, parseRecipeFilter({ sortierung: "protein" })))).toEqual(["1", "3", "2"]);
    expect(ids(filterRecipes(items, parseRecipeFilter({ sortierung: "kcal" })))).toEqual(["2", "3", "1"]);
    expect(ids(filterRecipes(items, parseRecipeFilter({ sortierung: "name" })))).toEqual(["2", "3", "1"]);
  });
});

describe("autoTagsFor / collectTags", () => {
  it("zeigt vegan statt doppelt vegan + vegetarisch", () => {
    expect(autoTagsFor(items[1])).toEqual(["vegan", "meal_prep"]);
    expect(autoTagsFor(items[2])).toEqual(["vegetarian", "low_carb"]);
  });

  it("sammelt eigene Tags ohne Doppelte", () => {
    const withDup = [...items, recipe({ id: "4", title: "X", tags: ["klassiker", "Abendessen"] })];
    expect(collectTags(withDup)).toEqual(["Abendessen", "Brunch", "Klassiker", "Wohlfühlessen"]);
  });
});
