import { describe, expect, it } from "vitest";
import { batchRemaining, cookedServings, followingDates, openBatchesFor, portionsToBuy } from "./mealprep";

describe("Meal Prep", () => {
  it("liefert die Folgetage, auch über das Wochenende hinaus", () => {
    expect(followingDates("2026-10-24", 3)).toEqual(["2026-10-25", "2026-10-26", "2026-10-27"]);
  });

  it("kocht mindestens so viele Portionen, wie eingeplant sind", () => {
    expect(cookedServings(4, [1, 1, 1])).toBe(4);
    expect(cookedServings(2, [1, 1, 1])).toBe(3);
  });

  it("rechnet übrige Portionen aus", () => {
    expect(batchRemaining(4, [1, 1])).toBe(2);
    expect(batchRemaining(3, [1, 1, 1])).toBe(0);
    expect(batchRemaining(3, [2, 2])).toBe(0);
  });

  it("zählt einen Batch auf der Einkaufsliste nur einmal, Reste gar nicht", () => {
    const entries = [
      { recipeId: "chili", servings: 1, batchId: "b1" },
      { recipeId: "chili", servings: 1, batchId: "b1" },
      { recipeId: "chili", servings: 1, batchId: "b1" },
      { recipeId: "salat", servings: 2, batchId: null },
    ];
    const batches = [{ id: "b1", recipeId: "chili", cookDate: "2026-10-19", servingsCooked: 4 }];
    expect(portionsToBuy(entries, batches, "2026-10-19", "2026-10-25")).toEqual([
      { recipeId: "salat", servings: 2 },
      { recipeId: "chili", servings: 4 },
    ]);
    // Kochtag vor dem Zeitraum: schon eingekauft, Reste zählen nicht
    expect(portionsToBuy(entries.slice(1), batches, "2026-10-20", "2026-10-25")).toEqual([{ recipeId: "salat", servings: 2 }]);
  });

  it("schlägt übrige Portionen 1 bis 3 Tage nach dem Kochen vor", () => {
    const batches = [
      { id: "a", recipeId: "r", title: "Chili", cookDate: "2026-10-19", remaining: 2 },
      { id: "b", recipeId: "r", title: "Curry", cookDate: "2026-10-19", remaining: 0 },
    ];
    expect(openBatchesFor("2026-10-21", batches).map((b) => b.id)).toEqual(["a"]);
    expect(openBatchesFor("2026-10-23", batches)).toEqual([]);
    expect(openBatchesFor("2026-10-19", batches)).toEqual([]); // am Kochtag selbst nicht
    expect(openBatchesFor("2026-10-18", batches)).toEqual([]);
  });
});
