import { describe, expect, it } from "vitest";
import {
  applySelection,
  autoTagShares,
  averageMacroDistribution,
  categorySlices,
  categoryTable,
  compositionRows,
  mostPlanned,
  proteinPerEuro,
  weeklyFoodCosts,
  weeklyPlanSeries,
  type StatsRecipe,
} from "./stats";
import { mondayOf } from "./week";

function recipe(p: Partial<StatsRecipe> & Pick<StatsRecipe, "id">): StatsRecipe {
  return {
    title: p.id,
    category: null,
    servings: 1,
    isMealPrep: false,
    ingredientCount: 1,
    kcal: 500,
    protein: 20,
    carbs: 50,
    fat: 20,
    isHighProtein: false,
    isLowCarb: false,
    isVegetarian: false,
    isVegan: false,
    gramsByFoodGroup: {},
    ...p,
  };
}

describe("categorySlices", () => {
  it("zeigt bis zu 5 Kategorien einzeln", () => {
    const slices = categorySlices([
      recipe({ id: "a", category: "Pasta" }),
      recipe({ id: "b", category: "Pasta" }),
      recipe({ id: "c", category: "Suppe/Eintopf" }),
      recipe({ id: "d" }),
    ]);
    expect(slices.map((s) => [s.label, s.count, s.colorSlot])).toEqual([
      ["Pasta", 2, 1],
      ["Ohne Kategorie", 1, 2],
      ["Suppe/Eintopf", 1, 3],
    ]);
  });

  it("fasst ab der 6. Kategorie zu „Weitere“ zusammen", () => {
    const cats = ["pasta", "rice", "bowl", "soup", "salad", "dessert"] as const;
    const slices = categorySlices(cats.map((c, i) => recipe({ id: String(i), category: c })));
    expect(slices).toHaveLength(5);
    expect(slices[4]).toMatchObject({ key: "other", label: "Weitere", count: 2, colorSlot: null });
    expect(slices[4].members).toHaveLength(2);
  });

  it("liefert für die Tabelle alle Kategorien", () => {
    expect(categoryTable([recipe({ id: "a", category: "Pasta" }), recipe({ id: "b" })])).toEqual([
      { key: "", label: "Ohne Kategorie", count: 1 },
      { key: "Pasta", label: "Pasta", count: 1 },
    ]);
  });
});

describe("autoTagShares", () => {
  it("zählt Anteile; vegane Rezepte zählen auch als vegetarisch", () => {
    const shares = autoTagShares([
      recipe({ id: "a", isVegan: true, isVegetarian: true }),
      recipe({ id: "b", isVegetarian: true, isHighProtein: true }),
      recipe({ id: "c", isMealPrep: true }),
      recipe({ id: "d" }),
    ]);
    const byTag = Object.fromEntries(shares.map((s) => [s.tag, s.share]));
    expect(byTag).toEqual({ high_protein: 0.25, vegetarian: 0.5, vegan: 0.25, low_carb: 0, meal_prep: 0.25 });
  });
});

describe("compositionRows", () => {
  it("rechnet Gramm pro Portion je Gruppe und sortiert", () => {
    const rows = compositionRows([
      recipe({ id: "bolo", servings: 4, gramsByFoodGroup: { meat: 500, vegetables: 870, grains: 400, dairy: 40 } }),
      recipe({ id: "dal", servings: 4, gramsByFoodGroup: { legumes: 250, vegetables: 630, spices_sauces: 750 } }),
      recipe({ id: "leer", ingredientCount: 0 }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["bolo", "dal"]);
    expect(rows[0]).toMatchObject({ veg: 218, meatfish: 125, grains: 100, dairy: 10, total: 453 });
    expect(rows[1]).toMatchObject({ veg: 158, legumes: 63, rest: 188 });
    expect(compositionRows([rows[0], rows[1]].map((r) => recipe({ id: r.id, gramsByFoodGroup: { meat: r.id === "dal" ? 0 : 1 } })), "meatfish")[0].id).toBe("bolo");
  });
});

describe("averageMacroDistribution", () => {
  it("mittelt die Energieanteile der Rezepte", () => {
    const avg = averageMacroDistribution([
      recipe({ id: "a", protein: 25, carbs: 25, fat: 0 }), // 50/50/0
      recipe({ id: "b", protein: 0, carbs: 0, fat: 10 }), // 0/0/100
    ]);
    expect(avg?.shares.protein).toBeCloseTo(0.25);
    expect(avg?.shares.carbs).toBeCloseTo(0.25);
    expect(avg?.shares.fat).toBeCloseTo(0.5);
    expect(averageMacroDistribution([])).toBeNull();
  });
});

describe("Wochenplan-Statistik", () => {
  const bowl = { kcal: 600, protein: 50, carbs: 60, fat: 10 };
  const entries = [
    { date: "2026-10-12", recipeId: "bowl", servings: 1, perServing: bowl },
    { date: "2026-10-12", recipeId: "bowl", servings: 2, perServing: bowl },
    { date: "2026-10-13", recipeId: "dal", servings: 1, perServing: { kcal: 300, protein: 18, carbs: 40, fat: 5 } },
  ];

  it("bildet den Durchschnitt pro geplantem Tag je Woche, leere Wochen bleiben leer", () => {
    const series = weeklyPlanSeries(entries, ["2026-10-05", "2026-10-12"], mondayOf);
    expect(series[0]).toEqual({
      monday: "2026-10-05",
      plannedDays: 0,
      trainingDays: 0,
      kcal: null,
      protein: null,
      goalKcal: null,
      goalProtein: null,
    });
    expect(series[1]).toMatchObject({ plannedDays: 2, kcal: (1800 + 300) / 2, protein: (150 + 18) / 2 });
  });

  it("markiert Trainingstage und mittelt die Tagesziele der geplanten Tage", () => {
    const plannedDates = [...new Set(entries.filter((e) => mondayOf(e.date) === "2026-10-12").map((e) => e.date))].sort();
    const training = new Set([plannedDates[0]]);
    const series = weeklyPlanSeries(entries, ["2026-10-12"], mondayOf, (date) =>
      training.has(date)
        ? { training: true, goals: { kcal: 2600, protein: 160, carbs: null, fat: null } }
        : { training: false, goals: { kcal: 2000, protein: null, carbs: null, fat: null } },
    );
    expect(series[0]).toMatchObject({ trainingDays: 1, goalKcal: 2300, goalProtein: 160 });
  });

  it("zählt die meistgeplanten Rezepte", () => {
    expect(mostPlanned(entries, new Map([["bowl", "Bowl"], ["dal", "Dal"]]))).toEqual([
      { recipeId: "bowl", title: "Bowl", count: 2 },
      { recipeId: "dal", title: "Dal", count: 1 },
    ]);
  });
});

describe("applySelection", () => {
  const list = [recipe({ id: "a", category: "Pasta", isVegan: true }), recipe({ id: "b" })];
  it("filtert nach Kategorie, Tag oder Rezept", () => {
    expect(applySelection(list, { kind: "category", label: "Pasta", members: ["Pasta"] }).map((r) => r.id)).toEqual(["a"]);
    expect(applySelection(list, { kind: "category", label: "Ohne", members: [""] }).map((r) => r.id)).toEqual(["b"]);
    expect(applySelection(list, { kind: "tag", label: "Vegan", tag: "vegan" }).map((r) => r.id)).toEqual(["a"]);
    expect(applySelection(list, { kind: "recipes", label: "b", ids: ["b"] }).map((r) => r.id)).toEqual(["b"]);
    expect(applySelection(list, null)).toHaveLength(2);
  });
});

describe("Kosten-Statistik", () => {
  const entries = [
    { date: "2026-10-12", recipeId: "bowl", servings: 2, perServing: null },
    { date: "2026-10-13", recipeId: "dal", servings: 1, perServing: null },
    { date: "2026-10-20", recipeId: "dal", servings: 1, perServing: null },
  ];
  const costs = { bowl: { perServing: 2.5, complete: true }, dal: { perServing: 1.2, complete: false } };

  it("summiert die Essenskosten pro Woche", () => {
    const weeks = weeklyFoodCosts(entries, ["2026-10-05", "2026-10-12", "2026-10-19"], mondayOf, costs);
    expect(weeks[0]).toEqual({ monday: "2026-10-05", total: null, complete: false });
    expect(weeks[1].total).toBeCloseTo(6.2);
    expect(weeks[1].complete).toBe(false);
    expect(weeks[2].total).toBeCloseTo(1.2);
  });

  it("rechnet Protein pro Euro nur mit vollständigen Preisen", () => {
    const result = proteinPerEuro(
      [recipe({ id: "bowl", protein: 40 }), recipe({ id: "dal", protein: 20 }), recipe({ id: "x", protein: 10 })],
      costs,
    );
    expect(result).toEqual([{ id: "bowl", title: "bowl", cost: 2.5, protein: 40, proteinPerEuro: 16 }]);
  });
});
