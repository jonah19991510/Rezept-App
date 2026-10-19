import { describe, expect, it } from "vitest";
import { computeRecipeNutrition, thresholdsFromConfig, type IngredientNutrients } from "./nutrition";
import { toGrams } from "./units";

const chicken: IngredientNutrients = { kcal: 110, protein: 23.1, carbs: 0, fat: 1.2, fiber: 0, sugar: 0, food_group: "meat", diet: "none" };
const broccoli: IngredientNutrients = { kcal: 34, protein: 2.8, carbs: 4, fat: 0.4, fiber: 2.6, sugar: 1.7, food_group: "vegetables", diet: "vegan" };
const tofu: IngredientNutrients = { kcal: 122, protein: 12, carbs: 1.5, fat: 7.5, fiber: 1, sugar: 0.5, food_group: "legumes", diet: "vegan" };
const pasta: IngredientNutrients = { kcal: 359, protein: 12.5, carbs: 71, fat: 1.5, fiber: 3, sugar: 3, food_group: "grains", diet: "vegan" };
const oil: IngredientNutrients = { kcal: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, sugar: 0, food_group: "oils_fats", diet: "vegan" };
const feta: IngredientNutrients = { kcal: 264, protein: 14.2, carbs: 4.1, fat: 21.3, fiber: 0, sugar: 4.1, food_group: "dairy", diet: "vegetarian" };

describe("computeRecipeNutrition", () => {
  it("summiert Makros und teilt durch die Portionen", () => {
    const n = computeRecipeNutrition(
      [
        { grams: 300, ingredient: chicken },
        { grams: 200, ingredient: broccoli },
      ],
      2,
    );
    expect(n.total.kcal).toBeCloseTo(398);
    expect(n.total.protein).toBeCloseTo(74.9);
    expect(n.perServing.kcal).toBeCloseTo(199);
    expect(n.perServing.protein).toBeCloseTo(37.45);
    expect(n.gramsByFoodGroup).toEqual({ meat: 300, vegetables: 200 });
  });

  it("stimmt mit der Datenbank-View überein (Testfall aus rls_check.sql)", () => {
    const n = computeRecipeNutrition([{ grams: 200, ingredient: chicken }], 2);
    expect(n.perServing.kcal).toBeCloseTo(110);
    expect(n.perServing.protein).toBeCloseTo(23.1);
  });

  it("rechnet Einheiten vorher in Gramm um (2 EL Öl)", () => {
    const grams = toGrams(2, "tbsp", { density_g_per_ml: 0.92 });
    const n = computeRecipeNutrition([{ grams, ingredient: oil }], 1);
    expect(n.total.fat).toBeCloseTo(27.6);
    expect(n.total.kcal).toBeCloseTo(244, 0);
  });

  it("zählt Zeilen ohne Gramm mit 0 und meldet sie", () => {
    const n = computeRecipeNutrition([{ grams: null, ingredient: pasta }, { grams: 100, ingredient: pasta }], 1);
    expect(n.total.kcal).toBe(359);
    expect(n.linesWithoutGrams).toBe(1);
  });

  it("behandelt 0 Portionen wie 1 Portion", () => {
    const n = computeRecipeNutrition([{ grams: 100, ingredient: pasta }], 0);
    expect(n.perServing.kcal).toBe(359);
  });

  describe("Auto-Tags", () => {
    it("High Protein ab 30 g Protein pro Portion", () => {
      expect(computeRecipeNutrition([{ grams: 130, ingredient: chicken }], 1).isHighProtein).toBe(true); // 30,03 g
      expect(computeRecipeNutrition([{ grams: 400, ingredient: pasta }], 4).isHighProtein).toBe(false); // 12,5 g, 14 %
    });

    it("High Protein auch bei ≥ 30 % der kcal aus Protein (kleine Portion)", () => {
      const n = computeRecipeNutrition([{ grams: 50, ingredient: chicken }], 1);
      expect(n.perServing.protein).toBeLessThan(30);
      expect(n.isHighProtein).toBe(true);
    });

    it("Low Carb bis 20 g Kohlenhydrate pro Portion", () => {
      expect(computeRecipeNutrition([{ grams: 300, ingredient: tofu }], 1).isLowCarb).toBe(true);
      expect(computeRecipeNutrition([{ grams: 100, ingredient: pasta }], 1).isLowCarb).toBe(false);
    });

    it("vegan/vegetarisch hängt an der schwächsten Zutat", () => {
      const vegan = computeRecipeNutrition([{ grams: 100, ingredient: tofu }, { grams: 100, ingredient: broccoli }], 1);
      expect(vegan.isVegan).toBe(true);
      expect(vegan.isVegetarian).toBe(true);

      const veggie = computeRecipeNutrition([{ grams: 100, ingredient: tofu }, { grams: 50, ingredient: feta }], 1);
      expect(veggie.isVegan).toBe(false);
      expect(veggie.isVegetarian).toBe(true);

      const meat = computeRecipeNutrition([{ grams: 100, ingredient: chicken }, { grams: 100, ingredient: broccoli }], 1);
      expect(meat.isVegetarian).toBe(false);
    });

    it("ein leeres Rezept bekommt keine Tags", () => {
      const n = computeRecipeNutrition([], 2);
      expect([n.isHighProtein, n.isLowCarb, n.isVegan, n.isVegetarian]).toEqual([false, false, false, false]);
    });

    it("nutzt die Schwellenwerte aus app_config", () => {
      const thresholds = thresholdsFromConfig([
        { key: "high_protein_min_protein_g", value: 25 },
        { key: "high_protein_min_kcal_share", value: "0.5" },
        { key: "low_carb_max_carbs_g", value: 10 },
      ]);
      expect(thresholds).toEqual({ highProteinMinGrams: 25, highProteinMinKcalShare: 0.5, lowCarbMaxGrams: 10 });
      const n = computeRecipeNutrition([{ grams: 200, ingredient: pasta }], 2, thresholds);
      expect(n.isLowCarb).toBe(false);
    });
  });
});
