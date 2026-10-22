import { describe, expect, it } from "vitest";
import { linesCost, missingPricesText, packageGrams, pricePer100, pricePerGram, shoppingEstimate, shoppingGrams, unpricedIngredients } from "./costs";

const plain = { density_g_per_ml: null, piece_weight_g: null };
const milk = { density_g_per_ml: 1.03, piece_weight_g: null };
const egg = { density_g_per_ml: null, piece_weight_g: 60 };

describe("Kostenberechnung", () => {
  it("rechnet Packungen in Gramm um", () => {
    expect(packageGrams(500, "g", plain)).toBe(500);
    expect(packageGrams(1000, "ml", milk)).toBeCloseTo(1030);
    expect(packageGrams(70, "cl", plain)).toBe(700);
    expect(packageGrams(10, "piece", egg)).toBe(600);
    expect(packageGrams(10, "piece", plain)).toBeNull();
    expect(packageGrams(2, "tbsp", plain)).toBeNull();
  });

  it("ergibt den Preis pro Gramm", () => {
    expect(pricePerGram({ price: 3.49, packageAmount: 500, packageUnit: "g" }, plain)).toBeCloseTo(0.00698);
    expect(pricePerGram({ price: 2.99, packageAmount: 10, packageUnit: "piece" }, egg)).toBeCloseTo(2.99 / 600);
    expect(pricePerGram({ price: 1, packageAmount: 1, packageUnit: "piece" }, plain)).toBeNull();
  });

  it("summiert Rezeptzeilen und zählt Zeilen ohne Preis", () => {
    const perGram = new Map([
      ["pasta", 0.002],
      ["tomato", 0.004],
    ]);
    const result = linesCost(
      [
        { ingredientId: "pasta", grams: 500 },
        { ingredientId: "tomato", grams: 400 },
        { ingredientId: "basil", grams: 10 },
        { ingredientId: "pasta", grams: null },
      ],
      perGram,
    );
    expect(result.total).toBeCloseTo(2.6);
    expect(result.priced).toBe(2);
    expect(result.count).toBe(4);
    expect(missingPricesText(result.priced, result.count)).toBe("2 von 4 Zutaten ohne Preis");
    expect(missingPricesText(4, 4)).toBeNull();
  });

  it("schätzt die Einkaufsliste in g, ml und Stück", () => {
    expect(shoppingGrams(2, "Stück", egg)).toBe(120);
    expect(shoppingGrams(500, "ml", milk)).toBeCloseTo(515);
    expect(shoppingGrams(null, "g", plain)).toBeNull();
    const prices = new Map([
      ["egg", { perGram: 2.99 / 600, info: egg }],
      ["milk", { perGram: 1.19 / 1030, info: milk }],
    ]);
    const estimate = shoppingEstimate(
      [
        { ingredientId: "egg", amount: 6, unit: "Stück" },
        { ingredientId: "milk", amount: 1000, unit: "ml" },
        { ingredientId: null, amount: null, unit: null },
      ],
      prices,
    );
    expect(estimate.total).toBeCloseTo(2.99 * 0.6 + 1.19);
    expect(estimate.priced).toBe(2);
    expect(estimate.count).toBe(3);
  });

  it("zeigt Preise pro 100 g bzw. 100 ml", () => {
    expect(pricePer100(0.00698, "g", plain)).toBeCloseTo(0.698);
    expect(pricePer100(1.19 / 1030, "ml", milk)).toBeCloseTo(0.119);
  });
});

describe("unpricedIngredients", () => {
  const line = (ingredientId: string, name: string, grams: number | null, isOptional = false) => ({ ingredientId, name, grams, isOptional });

  it("nennt Zutaten ohne Preis, mit nicht umrechenbarem Preis und ohne Gramm, je Zutat einmal", () => {
    const perGram = new Map<string, number | null>([
      ["nudeln", 0.002],
      ["ei", null],
      ["salz", 0.001],
    ]);
    const result = unpricedIngredients(
      [
        line("nudeln", "Spaghetti", 500),
        line("ei", "Ei", 120),
        line("speck", "Speck", 100),
        line("speck", "Speck", 20),
        line("salz", "Salz", null),
        line("petersilie", "Petersilie", 5, true),
      ],
      perGram,
    );
    expect(result).toEqual([
      { ingredientId: "ei", name: "Ei", reason: "convert" },
      { ingredientId: "speck", name: "Speck", reason: "price" },
      { ingredientId: "salz", name: "Salz", reason: "grams" },
    ]);
  });
});
