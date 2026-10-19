import { describe, expect, it } from "vitest";
import { draftToEditorInitial, type ImportDraft } from "./import-draft";
import type { IngredientOption } from "./ingredient-option";
import { parseIngredientLine } from "./ingredient-line";
import { extractRecipe } from "./recipe-import";

const ing = (id: string, name: string, density: number | null): IngredientOption => ({
  id, name, kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, food_group: "other", diet: "none",
  piece_weight_g: null, density_g_per_ml: density, source: "seed", is_staple: false,
});

describe("Import mit Einheiten-Umrechnung", () => {
  const flour = ing("1", "Weizenmehl Type 405", 0.53);
  const milk = ing("2", "Milch 3,5 %", 1.03);
  const draft: ImportDraft = {
    sourceUrl: "https://example.com/pancakes",
    title: "Pancakes",
    description: "",
    servings: 4,
    prepMinutes: null,
    cookMinutes: null,
    category: "breakfast",
    lines: [
      { ...parseIngredientLine("2 cups flour"), match: flour, exact: false },
      { ...parseIngredientLine("1 cup milk"), match: milk, exact: false },
      { ...parseIngredientLine("2 tbsp sugar"), match: null, exact: false },
    ],
    steps: [],
  };

  it("cups werden mit der Dichte der gewählten Zutat in Gramm umgerechnet, Flüssigkeiten bleiben ml", () => {
    const { initial } = draftToEditorInitial(draft, [
      { ingredient: flour, skip: false },
      { ingredient: milk, skip: false },
      { ingredient: ing("3", "Zucker", 0.85), skip: false },
    ]);
    expect(initial.ingredients.map((l) => [l.amount, l.unit, l.note])).toEqual([
      [254, "g", "aus 2 cup"],
      [240, "ml", "aus 1 cup"],
      [2, "tbsp", ""],
    ]);
  });

  it("Wechselt der Nutzer die Zutat, gilt deren Dichte", () => {
    const { initial } = draftToEditorInitial(draft, [
      { ingredient: ing("4", "Haferflocken", 0.41), skip: false },
      { ingredient: milk, skip: true },
      { ingredient: null, skip: false },
    ]);
    expect(initial.ingredients[0]).toMatchObject({ amount: 197, unit: "g" });
  });

  it("°F im Schritttext wird beim Import zu °C", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "Recipe",
      name: "Cookies",
      recipeIngredient: ["1 cup flour"],
      recipeInstructions: [{ "@type": "HowToStep", text: "Preheat oven to 350°F." }],
    })}</script>`;
    expect(extractRecipe(html)?.steps).toEqual(["Preheat oven to 175 °C."]);
  });
});
