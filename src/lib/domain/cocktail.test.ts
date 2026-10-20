import { describe, expect, it } from "vitest";
import {
  abvBucket,
  baseSpirit,
  bottleHints,
  computeAlcohol,
  DEFAULT_DILUTION,
  dilutionFromConfig,
  dilutionNote,
  lineVolumeMl,
  spiritLabel,
  type AlcoholIngredient,
  type MixRecipe,
} from "./cocktail";

const rum: AlcoholIngredient = { abv: 40, food_group: "spirits", density_g_per_ml: 0.95 };
const lime: AlcoholIngredient = { abv: null, food_group: "syrups_juices", density_g_per_ml: 1.03 };
const syrup: AlcoholIngredient = { abv: null, food_group: "syrups_juices", density_g_per_ml: 1.23 };
const mint: AlcoholIngredient = { abv: null, food_group: "spices_sauces", density_g_per_ml: null };
const bitters: AlcoholIngredient = { abv: 44.7, food_group: "spirits", density_g_per_ml: 0.95 };

const daiquiri = [
  { amount: 6, unit: "cl" as const, ingredient: rum },
  { amount: 3, unit: "cl" as const, ingredient: lime },
  { amount: 2, unit: "cl" as const, ingredient: syrup },
  { amount: 5, unit: "g" as const, ingredient: mint },
];

describe("lineVolumeMl", () => {
  it("Volumen-Einheiten über feste ml-Werte", () => {
    expect(lineVolumeMl({ amount: 6, unit: "cl", ingredient: rum })).toBe(60);
    expect(lineVolumeMl({ amount: 45, unit: "ml", ingredient: rum })).toBe(45);
    expect(lineVolumeMl({ amount: 2, unit: "dash", ingredient: bitters })).toBeCloseTo(1.2);
    expect(lineVolumeMl({ amount: 1, unit: "barspoon", ingredient: syrup })).toBe(5);
    expect(lineVolumeMl({ amount: 1, unit: "tsp", ingredient: syrup })).toBe(5);
    expect(lineVolumeMl({ amount: 1, unit: "tbsp", ingredient: syrup })).toBe(15);
  });

  it("Gramm nur bei Getränkezutaten, über die Dichte", () => {
    expect(lineVolumeMl({ amount: 57, unit: "g", ingredient: rum })).toBeCloseTo(60);
    expect(lineVolumeMl({ amount: 5, unit: "g", ingredient: mint })).toBe(0);
  });

  it("Stück, Prise und fehlende Mengen zählen nicht", () => {
    expect(lineVolumeMl({ amount: 1, unit: "piece", ingredient: lime })).toBe(0);
    expect(lineVolumeMl({ amount: 1, unit: "pinch", ingredient: syrup })).toBe(0);
    expect(lineVolumeMl({ amount: null, unit: "cl", ingredient: rum })).toBe(0);
    expect(lineVolumeMl({ amount: 4, unit: null, ingredient: rum })).toBe(0);
  });
});

describe("computeAlcohol", () => {
  it("Daiquiri geshaked: +25 % Verdünnung (gleiche Werte wie die View in der Datenbank)", () => {
    expect(computeAlcohol(daiquiri, "shaken", 1)).toEqual({
      dilution: 0.25,
      drinkVolumeMl: 137.5,
      alcoholMlPerDrink: 24,
      alcoholGramsPerDrink: 18.9,
      abvPercent: 17.5,
    });
  });

  it("gerührt +20 %, gebaut +10 %, geblendet +30 %", () => {
    expect(computeAlcohol(daiquiri, "stirred", 1).abvPercent).toBe(18.2);
    expect(computeAlcohol(daiquiri, "built", 1).abvPercent).toBe(19.8);
    expect(computeAlcohol(daiquiri, "blended", 1).abvPercent).toBe(16.8);
  });

  it("ohne Methode keine Verdünnung", () => {
    const r = computeAlcohol(daiquiri, null, 1);
    expect(r.dilution).toBe(0);
    expect(r.abvPercent).toBe(21.8);
    expect(r.drinkVolumeMl).toBe(110);
  });

  it("pro Drink: doppelte Menge für 2 Drinks ergibt dieselben Werte je Glas", () => {
    const double = daiquiri.map((l) => ({ ...l, amount: l.amount * 2 }));
    expect(computeAlcohol(double, "shaken", 2)).toEqual(computeAlcohol(daiquiri, "shaken", 1));
  });

  it("Gramm Alkohol = ml × 0,789", () => {
    const r = computeAlcohol([{ amount: 4, unit: "cl", ingredient: rum }], null, 1);
    expect(r.alcoholMlPerDrink).toBe(16);
    expect(r.alcoholGramsPerDrink).toBe(12.6);
    expect(r.abvPercent).toBe(40);
  });

  it("alkoholfrei und leer", () => {
    expect(computeAlcohol([{ amount: 20, unit: "cl", ingredient: lime }], "built", 1).abvPercent).toBe(0);
    expect(computeAlcohol([], "shaken", 1)).toEqual({
      dilution: 0.25,
      drinkVolumeMl: 0,
      alcoholMlPerDrink: 0,
      alcoholGramsPerDrink: 0,
      abvPercent: 0,
    });
  });

  it("eigene Verdünnung aus der Konfiguration", () => {
    const config = { ...DEFAULT_DILUTION, shaken: 0.5 };
    expect(computeAlcohol([{ amount: 10, unit: "cl", ingredient: rum }], "shaken", 1, config).abvPercent).toBe(26.7);
  });

  it("ungültige Portionen zählen als 1 Drink", () => {
    expect(computeAlcohol(daiquiri, "shaken", 0).alcoholMlPerDrink).toBe(24);
  });
});

describe("dilutionFromConfig", () => {
  it("liest Werte und ersetzt fehlende oder unplausible durch Standard", () => {
    expect(dilutionFromConfig([{ key: "cocktail_dilution", value: { shaken: 0.3, stirred: "x", built: 2 } }])).toEqual({
      ...DEFAULT_DILUTION,
      shaken: 0.3,
    });
    expect(dilutionFromConfig([])).toEqual(DEFAULT_DILUTION);
    expect(dilutionFromConfig([{ key: "cocktail_dilution", value: [1, 2] }])).toEqual(DEFAULT_DILUTION);
  });
});

describe("Basisspirituose", () => {
  it("Spirituose mit dem größten Volumen, Name ohne Zusatz", () => {
    expect(spiritLabel("Rum, weiß")).toBe("Rum");
    expect(spiritLabel("Tequila (Blanco)")).toBe("Tequila");
    expect(
      baseSpirit([
        { name: "Angostura Bitter", amount: 2, unit: "dash", ingredient: bitters },
        { name: "Rum, weiß", amount: 6, unit: "cl", ingredient: rum },
        { name: "Limettensaft", amount: 3, unit: "cl", ingredient: lime },
      ]),
    ).toBe("Rum");
  });

  it("ohne Spirituose: Likör/Wein, alkoholfrei: null", () => {
    const aperol: AlcoholIngredient = { abv: 11, food_group: "liqueurs_wine", density_g_per_ml: 1.05 };
    const prosecco: AlcoholIngredient = { abv: 11, food_group: "liqueurs_wine", density_g_per_ml: 0.99 };
    expect(
      baseSpirit([
        { name: "Prosecco", amount: 9, unit: "cl", ingredient: prosecco },
        { name: "Aperol", amount: 6, unit: "cl", ingredient: aperol },
      ]),
    ).toBe("Prosecco");
    expect(baseSpirit([{ name: "Limettensaft", amount: 3, unit: "cl", ingredient: lime }])).toBeNull();
  });
});

describe("abvBucket", () => {
  it("Grenzen", () => {
    expect(abvBucket(0)).toBe("none");
    expect(abvBucket(0.4)).toBe("none");
    expect(abvBucket(0.5)).toBe("light");
    expect(abvBucket(10)).toBe("light");
    expect(abvBucket(17.5)).toBe("medium");
    expect(abvBucket(30)).toBe("strong");
    expect(abvBucket(31)).toBe("very-strong");
  });
});

describe("bottleHints", () => {
  const line = (id: string, foodGroup: MixRecipe["lines"][number]["foodGroup"], isStaple = false) => ({
    ingredientId: id,
    name: id[0].toUpperCase() + id.slice(1),
    isStaple,
    foodGroup,
  });
  const recipes: MixRecipe[] = [
    { id: "1", title: "Daiquiri", lines: [line("rum", "spirits"), line("limette", "syrups_juices"), line("zucker", "other", true)] },
    { id: "2", title: "Mojito", lines: [line("rum", "spirits"), line("limette", "syrups_juices"), line("minze", "spices_sauces")] },
    { id: "3", title: "Cuba Libre", lines: [line("rum", "spirits"), line("cola", "syrups_juices")] },
    { id: "4", title: "Gimlet", lines: [line("gin", "spirits"), line("limette", "syrups_juices")] },
    { id: "5", title: "Negroni", lines: [line("gin", "spirits"), line("campari", "liqueurs_wine"), line("wermut", "liqueurs_wine")] },
  ];

  it("zählt Cocktails, denen genau diese eine Flasche fehlt", () => {
    const hints = bottleHints(recipes, new Set(["limette", "cola"]));
    expect(hints).toEqual([
      { ingredientId: "rum", name: "Rum", unlocks: ["Cuba Libre", "Daiquiri"] },
      { ingredientId: "gin", name: "Gin", unlocks: ["Gimlet"] },
    ]);
  });

  it("Grundzutaten zählen nicht, fehlende Küchenzutaten (Minze) sind keine Flasche", () => {
    const hints = bottleHints(recipes, new Set(["rum", "limette", "gin"]));
    // Mojito fehlt nur Minze (keine Flasche), Cuba Libre nur Cola, Negroni zwei Flaschen
    expect(hints).toEqual([{ ingredientId: "cola", name: "Cola", unlocks: ["Cuba Libre"] }]);
  });

  it("alles da oder nichts passend: leer", () => {
    expect(bottleHints(recipes, new Set(["rum", "limette", "cola", "minze", "gin", "campari", "wermut"]))).toEqual([]);
  });
});

describe("dilutionNote", () => {
  it("Text je Methode", () => {
    expect(dilutionNote("shaken", 0.25)).toBe("Geshaked: +25 % Schmelzwasser eingerechnet.");
    expect(dilutionNote("built", 0)).toBe("Gebaut: ohne Schmelzwasser gerechnet.");
    expect(dilutionNote(null, 0)).toBe("Ohne Methode ohne Schmelzwasser gerechnet.");
  });
});
