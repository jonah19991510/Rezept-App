import { describe, expect, it } from "vitest";
import { candidateDisplayName, guessDiet, guessFoodGroup, mapOffHit } from "./openfoodfacts";

describe("mapOffHit", () => {
  it("übernimmt Name, Marke und Nährwerte pro 100 g", () => {
    const c = mapOffHit({
      code: "29084302",
      product_name: "Rolled oats",
      product_name_de: "Haferflocken",
      brands: ["Ideal"],
      categories_tags: ["en:plant-based-foods", "en:cereals-and-potatoes", "en:oat-flakes"],
      ingredients_analysis_tags: ["en:palm-oil-free", "en:vegan", "en:vegetarian"],
      nutriments: { "energy-kcal_100g": 372, proteins_100g: 13.5, carbohydrates_100g: 58.7, fat_100g: 7, fiber_100g: 10, sugars_100g: 0.7 },
    });
    expect(c).toEqual({
      externalId: "29084302",
      name: "Haferflocken",
      brand: "Ideal",
      kcal: 372,
      protein: 13.5,
      carbs: 58.7,
      fat: 7,
      fiber: 10,
      sugar: 0.7,
      food_group: "grains",
      diet: "vegan",
    });
  });

  it("rechnet kcal aus kJ, wenn kcal fehlen", () => {
    const c = mapOffHit({ code: "1", product_name: "X", nutriments: { "energy-kj_100g": 418.4, proteins_100g: 1, carbohydrates_100g: 1, fat_100g: 1 } });
    expect(c?.kcal).toBe(100);
  });

  it("schätzt kcal aus den Makros, wenn gar keine Energie angegeben ist", () => {
    const c = mapOffHit({ code: "1", product_name: "X", nutriments: { proteins_100g: 13, carbohydrates_100g: 59, fat_100g: 7, fiber_100g: 10 } });
    expect(c?.kcal).toBe(371);
  });

  it("verwirft Treffer ohne Nährwerte oder ohne Namen", () => {
    expect(mapOffHit({ code: "1", product_name: "X", nutriments: {} })).toBeNull();
    expect(mapOffHit({ code: "1", nutriments: { "energy-kcal_100g": 1, proteins_100g: 1, carbohydrates_100g: 1, fat_100g: 1 } })).toBeNull();
  });
});

describe("guessFoodGroup", () => {
  it("ordnet typische Kategorien zu", () => {
    expect(guessFoodGroup(["en:dairies", "en:fermented-milk-products", "en:skyrs"])).toBe("dairy");
    expect(guessFoodGroup(["en:dairies", "en:fats", "en:butters"])).toBe("dairy");
    expect(guessFoodGroup(["en:beverages", "en:plant-based-milk-alternatives", "en:milks"])).toBe("other");
    expect(guessFoodGroup(["en:meats", "en:poultries"])).toBe("meat");
    expect(guessFoodGroup(["en:seafood", "en:fishes", "en:tunas"])).toBe("fish");
    expect(guessFoodGroup(["en:plant-based-foods", "en:legumes", "en:lentils"])).toBe("legumes");
    expect(guessFoodGroup(["en:fats", "en:vegetable-oils", "en:olive-oils"])).toBe("oils_fats");
    expect(guessFoodGroup(["en:alcoholic-beverages", "en:spirits", "en:gins"])).toBe("spirits");
    expect(guessFoodGroup([])).toBe("other");
  });
});

describe("guessDiet", () => {
  it("liest die Analyse-Tags von Open Food Facts", () => {
    expect(guessDiet(["en:vegan", "en:vegetarian"])).toBe("vegan");
    expect(guessDiet(["en:non-vegan", "en:vegetarian"])).toBe("vegetarian");
    expect(guessDiet(["en:non-vegan", "en:non-vegetarian"])).toBe("none");
    expect(guessDiet(["en:vegan-status-unknown"])).toBeNull();
  });
});

describe("candidateDisplayName", () => {
  it("hängt die Marke an, wenn sie nicht schon im Namen steht", () => {
    expect(candidateDisplayName({ name: "Haferflocken", brand: "ja!" })).toBe("Haferflocken (ja!)");
    expect(candidateDisplayName({ name: "Isey Skyr Natur", brand: "Isey Skyr" })).toBe("Isey Skyr Natur");
    expect(candidateDisplayName({ name: "Tofu", brand: null })).toBe("Tofu");
  });
});
