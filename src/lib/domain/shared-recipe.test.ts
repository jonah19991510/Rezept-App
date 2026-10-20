import { describe, expect, it } from "vitest";
import {
  isShareToken,
  missingGramNames,
  parseSharedRecipe,
  shareDescription,
  shareImageFileName,
  shareUrl,
  sharedMacros,
} from "./shared-recipe";

// So liefert get_shared_recipe die Daten (numeric als Zahl, fehlende Werte als null)
const ROW = {
  title: "Linsen-Dal",
  description: "Schnell und wärmend.",
  recipe_type: "dish",
  servings: 4,
  prep_minutes: 10,
  cook_minutes: 25,
  category: "soup",
  tags: ["schnell"],
  is_meal_prep: true,
  source_url: null,
  image_url: "u/r/f.webp",
  updated_at: "2026-10-20T08:00:00+00:00",
  author: "Jonah",
  nutrition: { kcal: 412.4, protein: 21.2, carbs: 50, fat: 12, fiber: null },
  ingredients: [
    { position: 0, amount: 250, unit: "g", grams: 250, note: null, name: "Rote Linsen" },
    { position: 1, amount: 1, unit: "piece", grams: null, note: "Dose", name: "Kokosmilch" },
    { position: 2, amount: null, unit: null, grams: null, note: null, name: "Salz" },
  ],
  steps: [{ position: 1, text: "Kochen.", timer_seconds: 600 }],
};

describe("parseSharedRecipe", () => {
  it("liest die Antwort der Datenbank", () => {
    const recipe = parseSharedRecipe(ROW);
    expect(recipe?.title).toBe("Linsen-Dal");
    expect(recipe && sharedMacros(recipe)).toEqual({ kcal: 412.4, protein: 21.2, carbs: 50, fat: 12, fiber: 0 });
    expect(recipe && missingGramNames(recipe)).toEqual(["Kokosmilch"]);
  });

  it("gibt null bei ungültigem Link oder unerwartetem Format", () => {
    expect(parseSharedRecipe(null)).toBeNull();
    expect(parseSharedRecipe({ ...ROW, servings: "4" })).toBeNull();
  });
});

describe("Hilfsfunktionen", () => {
  it("isShareToken", () => {
    expect(isShareToken("nsywEZA0ROCUkOLagGRxtQ")).toBe(true);
    expect(isShareToken("a-b_c".padEnd(22, "x"))).toBe(true);
    expect(isShareToken("zu-kurz")).toBe(false);
    expect(isShareToken("nsywEZA0ROCUkOLagGRxt/")).toBe(false);
  });

  it("shareUrl", () => {
    expect(shareUrl("https://unser-rezeptbuch.vercel.app/", "abc")).toBe("https://unser-rezeptbuch.vercel.app/r/abc");
  });

  it("shareDescription", () => {
    const recipe = parseSharedRecipe(ROW)!;
    expect(shareDescription(recipe)).toBe("Schnell und wärmend. · 4 Portionen · 412 kcal und 21 g Eiweiß pro Portion");
    expect(shareDescription({ ...recipe, description: null, nutrition: null, servings: 1 })).toBe("1 Portion");
    expect(shareDescription({ ...recipe, description: "x".repeat(300) }).length).toBe(198);
  });

  it("shareImageFileName", () => {
    expect(shareImageFileName("Käsespätzle mit Röstzwiebeln")).toBe("kaesespaetzle-mit-roestzwiebeln.jpg");
  });
});

describe("Cocktails (Phase 15)", () => {
  const COCKTAIL = {
    ...ROW,
    title: "Daiquiri",
    description: null,
    recipe_type: "cocktail",
    servings: 1,
    category: "drink",
    nutrition: { kcal: 152.4, protein: 0.1, carbs: 15, fat: 0, fiber: 0 },
    cocktail: { glass: "coupette", method: "shaken", ice: null, garnish: "Limettenrad" },
    alcohol: { abv_percent: 17.5, alcohol_g: 18.9, volume_ml: 137.5, dilution: 0.25 },
  };

  it("liest Cocktail-Felder und Alkoholgehalt", () => {
    const recipe = parseSharedRecipe(COCKTAIL);
    expect(recipe?.cocktail).toEqual({ glass: "coupette", method: "shaken", ice: null, garnish: "Limettenrad" });
    expect(recipe?.alcohol?.abv_percent).toBe(17.5);
  });

  it("ältere Antwort ohne die neuen Felder bleibt gültig", () => {
    expect(parseSharedRecipe(ROW)).toMatchObject({ cocktail: null, alcohol: null });
  });

  it("Vorschautext mit Drinks, % vol und kcal pro Drink", () => {
    expect(shareDescription(parseSharedRecipe(COCKTAIL)!)).toBe("1 Drink · 17,5 % vol · 152 kcal pro Drink");
  });
});
