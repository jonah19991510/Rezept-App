import { describe, expect, it } from "vitest";
import {
  groupByFoodGroup,
  canDeleteIngredient,
  canEditIngredient,
  collectMyIngredients,
  defaultDiet,
  filterMyIngredients,
  ingredientOrigin,
  type IngredientRow,
  type MyIngredientPrice,
} from "./my-ingredients";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

const row = (id: string, name: string, extra: Partial<IngredientRow> = {}): IngredientRow => ({
  id, name, kcal: 100, protein: 1, carbs: 1, fat: 1, fiber: 0, sugar: 0, food_group: "other", diet: "vegan",
  piece_weight_g: null, density_g_per_ml: null, abv: null, source: "seed", is_staple: false, created_by: null, ...extra,
});

const ZUCKER = row("z", "Zucker");
const OMAS = row("o", "Omas Gewürz", { source: "user", created_by: ME });
const MUESLI = row("m", "Müsli Bio", { source: "openfoodfacts", created_by: ME });
const FREMD = row("f", "Ärger-Soße", { source: "user", created_by: OTHER });
const PRICE: MyIngredientPrice = { id: "p", price: 1.29, packageAmount: 1000, packageUnit: "g", store: null, perGram: 0.00129 };

describe("collectMyIngredients", () => {
  const items = collectMyIngredients({
    userId: ME,
    recipes: [
      { id: "r2", title: "Zimtschnecken", type: "dish", ingredients: [ZUCKER, OMAS, ZUCKER] },
      { id: "r1", title: "Apfelkuchen", type: "dish", ingredients: [ZUCKER, FREMD] },
    ],
    own: [OMAS, MUESLI],
    prices: new Map([["z", PRICE]]),
  });

  it("je Zutat einmal, nach Name sortiert (Umlaute richtig)", () => {
    expect(items.map((i) => i.ingredient.name)).toEqual(["Ärger-Soße", "Müsli Bio", "Omas Gewürz", "Zucker"]);
  });

  it("Rezepte je Zutat ohne Doppelte, alphabetisch; eigene Zutaten (auch übernommene) auch ohne Rezept", () => {
    const zucker = items.find((i) => i.ingredient.id === "z")!;
    expect(zucker.recipes.map((r) => r.title)).toEqual(["Apfelkuchen", "Zimtschnecken"]);
    expect(zucker.price).toEqual(PRICE);
    expect(items.find((i) => i.ingredient.id === "m")!.recipes).toEqual([]);
  });

  it("selbst angelegt (und bearbeitbar) nur eigene mit Quelle „user“, nicht aus Open Food Facts übernommene", () => {
    expect(Object.fromEntries(items.map((i) => [i.ingredient.id, i.isOwn]))).toEqual({ z: false, o: true, m: false, f: false });
    expect(items[0].ingredient).not.toHaveProperty("created_by");
    expect(canEditIngredient({ created_by: ME, source: "user" }, ME)).toBe(true);
    expect(canEditIngredient({ created_by: ME, source: "seed" }, ME)).toBe(false);
  });

  it("löschen auch selbst übernommene aus Open Food Facts, nie Grundbestand oder fremde", () => {
    expect(Object.fromEntries(items.map((i) => [i.ingredient.id, i.canDelete]))).toEqual({ z: false, o: true, m: true, f: false });
    expect(canDeleteIngredient({ created_by: ME, source: "openfoodfacts" }, ME)).toBe(true);
    expect(canDeleteIngredient({ created_by: OTHER, source: "openfoodfacts" }, ME)).toBe(false);
    expect(canDeleteIngredient({ created_by: null, source: "seed" }, ME)).toBe(false);
  });

  it("Ansichten und Suche", () => {
    const names = (view: Parameters<typeof filterMyIngredients>[1]) => filterMyIngredients(items, view).map((i) => i.ingredient.name);
    expect(names({ view: "rezepte" })).toEqual(["Ärger-Soße", "Omas Gewürz", "Zucker"]);
    expect(names({ view: "eigene" })).toEqual(["Omas Gewürz"]);
    expect(names({ view: "ohne-preis" })).toEqual(["Ärger-Soße", "Müsli Bio", "Omas Gewürz"]);
    expect(names({ q: "arger" })).toEqual(["Ärger-Soße"]);
    expect(names({ q: "bio mu" })).toEqual(["Müsli Bio"]);
    expect(names({ q: "bio mu", view: "eigene" })).toEqual([]);
    expect(names({ q: "  " })).toHaveLength(4);
  });

  it("Herkunft", () => {
    expect(items.map(ingredientOrigin)).toEqual([
      "von jemand anderem angelegt",
      "Open Food Facts",
      "selbst angelegt",
      "Grundbestand",
    ]);
  });
});

describe("defaultDiet", () => {
  it("wie der Trigger beim Anlegen", () => {
    expect(defaultDiet("meat")).toBe("none");
    expect(defaultDiet("other")).toBe("none");
    expect(defaultDiet("dairy")).toBe("vegetarian");
    expect(defaultDiet("vegetables")).toBe("vegan");
  });
});

describe("groupByFoodGroup", () => {
  it("gruppiert in Supermarkt-Reihenfolge und behält die Reihenfolge innerhalb", () => {
    const items = [
      { name: "Lachs", g: "fish" as const },
      { name: "Apfel", g: "fruit" as const },
      { name: "Butter", g: "dairy" as const },
      { name: "Kabeljau", g: "fish" as const },
    ];
    const sections = groupByFoodGroup(items, (i) => i.g);
    expect(sections.map((s) => s.label)).toEqual(["Obst", "Milchprodukte", "Fisch"]);
    expect(sections[2].items.map((i) => i.name)).toEqual(["Lachs", "Kabeljau"]);
  });
});
