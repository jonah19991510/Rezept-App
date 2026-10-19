import { describe, expect, it } from "vitest";
import { changeSummary, diffIngredients, diffSteps, parseSnapshot, snapshotMacros } from "./versions";

const ing = (id: string, amount: number | null, unit: string | null, grams: number | null, note: string | null = null) => ({
  ingredient_id: id,
  name: id,
  amount,
  unit,
  grams,
  note,
  step_position: null,
});

const v1 = parseSnapshot({
  title: "Lasagne",
  servings: 4,
  ingredients: [ing("pasta", 250, "g", 250), ing("bechamel", 500, "ml", 520), ing("salt", 1, "pinch", 0.5)],
  steps: [{ text: "Schichten", timer_seconds: null }, { text: "Backen", timer_seconds: 2400 }],
});
const v2 = parseSnapshot({
  title: "Lasagne",
  servings: 6,
  ingredients: [ing("pasta", 250, "g", 250), ing("bechamel", 300, "ml", 312), ing("cheese", 100, "g", 100)],
  steps: [{ text: "Schichten", timer_seconds: null }, { text: "Backen bei 180 °C", timer_seconds: 2400 }],
});

describe("Rezept-Versionen", () => {
  it("liest Snapshots robust ein", () => {
    const s = parseSnapshot({ title: "X", ingredients: [{ ingredient_id: "a" }] });
    expect(s.servings).toBe(1);
    expect(s.steps).toEqual([]);
    expect(s.ingredients[0]).toMatchObject({ ingredient_id: "a", name: "Zutat", amount: null });
  });

  it("vergleicht Zutaten: gleich, geändert, neu, entfernt", () => {
    const diff = diffIngredients(v1.ingredients, v2.ingredients);
    expect(diff.map((d) => [d.kind, "after" in d ? d.after.ingredient_id : d.before.ingredient_id])).toEqual([
      ["same", "pasta"],
      ["changed", "bechamel"],
      ["added", "cheese"],
      ["removed", "salt"],
    ]);
  });

  it("vergleicht Schritte nach Position", () => {
    expect(diffSteps(v1.steps, v2.steps).map((s) => s.kind)).toEqual(["same", "changed"]);
    expect(diffSteps(v1.steps, v1.steps.slice(0, 1)).map((s) => s.kind)).toEqual(["same", "removed"]);
  });

  it("rechnet Makros pro Portion einer Version", () => {
    const nutrition = new Map([
      ["pasta", { kcal: 350, protein: 12, carbs: 70, fat: 1.5 }],
      ["bechamel", { kcal: 100, protein: 3, carbs: 8, fat: 6 }],
    ]);
    const m = snapshotMacros(v1, nutrition);
    expect(m.kcal).toBeCloseTo((250 * 3.5 + 520 * 1) / 4);
    expect(m.protein).toBeCloseTo((250 * 0.12 + 520 * 0.03) / 4);
  });

  it("fasst Änderungen kurz zusammen", () => {
    expect(changeSummary(v1, v2)).toBe("1 Zutat geändert, 1 neu, 1 entfernt, 1 Schritt geändert, Portionen 4 → 6");
    expect(changeSummary(v1, v1)).toBe("keine inhaltlichen Änderungen");
  });
});
