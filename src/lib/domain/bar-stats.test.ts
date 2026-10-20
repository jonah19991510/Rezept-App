import { describe, expect, it } from "vitest";
import { barStats, countSlices, type BarStatsItem } from "./bar-stats";

const item = (
  id: string,
  baseSpirit: string | null,
  method: BarStatsItem["cocktail"]["method"],
  abvPercent: number | null,
  timesMixed = 0,
): BarStatsItem => ({
  id,
  title: `Drink ${id}`,
  cocktail: { method, glass: null, abvPercent, alcoholGrams: abvPercent != null ? abvPercent : null, baseSpirit },
  kcal: 150,
  timesMixed,
});

describe("countSlices", () => {
  it("größte zuerst, ab dem sechsten Wert „Weitere“", () => {
    const keys = ["a", "a", "a", "b", "b", "c", "d", "e", "f"].map((k) => ({ key: k, label: k.toUpperCase(), filter: k }));
    const slices = countSlices(keys);
    expect(slices.map((s) => [s.label, s.count, s.colorSlot])).toEqual([
      ["A", 3, 1],
      ["B", 2, 2],
      ["C", 1, 3],
      ["D", 1, 4],
      ["Weitere (2)", 2, null],
    ]);
    expect(slices[4].filter).toBeNull();
  });

  it("bis fünf Werte ohne „Weitere“", () => {
    expect(countSlices([{ key: "x", label: "X", filter: "x" }])).toEqual([{ key: "x", label: "X", count: 1, colorSlot: 1, filter: "x" }]);
  });
});

describe("barStats", () => {
  const items = [
    item("1", "Rum", "shaken", 17.5, 3),
    item("2", "Rum", "stirred", 30),
    item("3", "Gin", "stirred", 26, 5),
    item("4", null, "built", 0),
    item("5", "Gin", null, null),
  ];
  const stats = barStats(items);

  it("Kennzahlen", () => {
    expect(stats.total).toBe(5);
    expect(stats.avgAbv).toBeCloseTo((17.5 + 30 + 26 + 0) / 4);
    expect(stats.avgKcal).toBe(150);
  });

  it("nach Basisspirituose und Methode, mit Filterwerten", () => {
    expect(stats.bySpirit.map((s) => [s.label, s.count, s.filter])).toEqual([
      ["Gin", 2, "Gin"],
      ["Rum", 2, "Rum"],
      ["alkoholfrei", 1, null],
    ]);
    expect(stats.byMethod.map((s) => [s.label, s.count, s.filter])).toEqual([
      ["gerührt", 2, "stirred"],
      ["gebaut", 1, "built"],
      ["geshaked", 1, "shaken"],
      ["ohne Angabe", 1, null],
    ]);
  });

  it("nach Alkoholgehalt (alle Stufen, auch leere)", () => {
    expect(stats.byAbv.map((b) => b.count)).toEqual([1, 0, 1, 2, 0]);
  });

  it("stärkste und meistgemixte", () => {
    expect(stats.strongest.map((s) => s.id)).toEqual(["2", "3", "1"]);
    expect(stats.mostMixed).toEqual([
      { id: "3", title: "Drink 3", times: 5 },
      { id: "1", title: "Drink 1", times: 3 },
    ]);
  });

  it("leer", () => {
    expect(barStats([])).toMatchObject({ total: 0, avgAbv: null, avgKcal: null, bySpirit: [], strongest: [] });
  });
});
