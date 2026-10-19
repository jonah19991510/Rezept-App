import { describe, expect, it } from "vitest";
import { needsManualGrams, resolveLineGrams, roundGrams, toGrams } from "./units";

const water = {};
const oil = { density_g_per_ml: 0.92 };
const egg = { piece_weight_g: 58 };

describe("toGrams", () => {
  it("übernimmt Gramm direkt", () => {
    expect(toGrams(250, "g", water)).toBe(250);
  });

  it("rechnet ml über die Dichte um, sonst 1 g/ml", () => {
    expect(toGrams(100, "ml", oil)).toBeCloseTo(92);
    expect(toGrams(100, "ml", water)).toBe(100);
  });

  it("kennt cl, EL, TL, Dash und Barlöffel", () => {
    expect(toGrams(4, "cl", water)).toBe(40);
    expect(toGrams(1, "tbsp", oil)).toBeCloseTo(13.8);
    expect(toGrams(2, "tsp", water)).toBe(10);
    expect(toGrams(2, "dash", water)).toBeCloseTo(1.2);
    expect(toGrams(1, "barspoon", water)).toBe(5);
  });

  it("rechnet Stück über das Stückgewicht um", () => {
    expect(toGrams(2, "piece", egg)).toBe(116);
    expect(toGrams(0.5, "piece", { piece_weight_g: 100 })).toBe(50);
  });

  it("gibt null zurück, wenn kein Stückgewicht bekannt ist", () => {
    expect(toGrams(1, "piece", water)).toBeNull();
  });

  it("zählt eine Prise als 0,5 g", () => {
    expect(toGrams(2, "pinch", water)).toBe(1);
  });

  it("ohne Menge oder Einheit gibt es kein Gewicht", () => {
    expect(toGrams(null, "g", water)).toBeNull();
    expect(toGrams(0, "g", water)).toBeNull();
    expect(toGrams(5, null, water)).toBeNull();
  });
});

describe("resolveLineGrams", () => {
  it("bevorzugt den berechneten Wert", () => {
    expect(resolveLineGrams(2, "piece", egg, 999)).toBe(116);
  });

  it("nimmt die manuelle Angabe, wenn nichts zu berechnen ist", () => {
    expect(resolveLineGrams(1, "piece", water, 120)).toBe(120);
    expect(resolveLineGrams(1, "piece", water, null)).toBeNull();
  });

  it("rundet sinnvoll", () => {
    expect(roundGrams(13.8456)).toBe(13.8);
    expect(roundGrams(0.333)).toBe(0.33);
  });
});

describe("needsManualGrams", () => {
  it("fragt nur bei Stück ohne Stückgewicht nach", () => {
    expect(needsManualGrams(1, "piece", water)).toBe(true);
    expect(needsManualGrams(1, "piece", egg)).toBe(false);
    expect(needsManualGrams(100, "g", water)).toBe(false);
  });
});
