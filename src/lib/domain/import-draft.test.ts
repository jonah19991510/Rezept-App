import { describe, expect, it } from "vitest";
import { importUrlSchema } from "@/lib/validation/import";
import { draftToEditorInitial, initialChoices, type ImportDraft } from "./import-draft";
import type { IngredientOption } from "./ingredient-option";
import { parseIngredientLine } from "./ingredient-line";

const ing = (id: string, name: string): IngredientOption => ({
  id, name, kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, food_group: "other", diet: "none",
  piece_weight_g: null, density_g_per_ml: null, abv: null, source: "seed", is_staple: false,
});

const linsen = ing("i1", "Rote Linsen");
const salz = ing("i2", "Salz");

const draft: ImportDraft = {
  sourceUrl: "https://example.com/dal",
  title: "Dal",
  description: "",
  servings: null,
  prepMinutes: 10,
  cookMinutes: 25,
  category: "soup",
  lines: [
    { ...parseIngredientLine("200 g rote Linsen"), match: linsen, exact: true },
    { ...parseIngredientLine("Salz"), match: salz, exact: true },
    { ...parseIngredientLine("1 Stück Ingwer (daumengroß)"), match: null, exact: false },
  ],
  steps: ["Waschen.", "Kochen."],
};

describe("draftToEditorInitial", () => {
  it("übernimmt Vorschläge, lässt Zeilen ohne Zutat weg und nennt sie", () => {
    const { initial, dropped } = draftToEditorInitial(draft, initialChoices(draft));
    expect(initial.ingredients).toEqual([
      { ingredient: linsen, amount: 200, unit: "g", grams: null, note: "", step_position: null },
      { ingredient: salz, amount: null, unit: null, grams: null, note: "", step_position: null },
    ]);
    expect(dropped).toEqual(["1 Stück Ingwer (daumengroß)"]);
    expect(initial).toMatchObject({ title: "Dal", servings: 2, prep_minutes: 10, cook_minutes: 25, category: "soup", source_url: "https://example.com/dal" });
    expect(initial.steps).toEqual([{ text: "Waschen.", timer_seconds: null }, { text: "Kochen.", timer_seconds: null }]);
  });

  it("berücksichtigt geänderte Zutaten und „weglassen“", () => {
    const ingwer = ing("i3", "Ingwer");
    const { initial, dropped } = draftToEditorInitial(draft, [
      { ingredient: linsen, skip: false },
      { ingredient: salz, skip: true },
      { ingredient: ingwer, skip: false },
    ]);
    expect(initial.ingredients.map((l) => l.ingredient.id)).toEqual(["i1", "i3"]);
    expect(initial.ingredients[1]).toMatchObject({ amount: 1, unit: "piece", note: "daumengroß" });
    expect(dropped).toEqual(["Salz"]);
  });
});

describe("importUrlSchema", () => {
  it("ergänzt https:// und lehnt Unsinn ab", () => {
    expect(importUrlSchema.parse({ url: " chefkoch.de/rezepte/1 " }).url).toBe("https://chefkoch.de/rezepte/1");
    expect(importUrlSchema.safeParse({ url: "ftp://x.de" }).success).toBe(false);
    expect(importUrlSchema.safeParse({ url: "" }).success).toBe(false);
  });
});
