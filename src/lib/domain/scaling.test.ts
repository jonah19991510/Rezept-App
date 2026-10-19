import { describe, expect, it } from "vitest";
import { scaleAmount, scaleFactor, stepServings } from "./scaling";

describe("scaleFactor", () => {
  it("gewünschte durch Rezept-Portionen", () => {
    expect(scaleFactor(6, 4)).toBe(1.5);
    expect(scaleFactor(1, 4)).toBe(0.25);
    expect(scaleFactor(2, 0)).toBe(1);
  });
});

describe("scaleAmount", () => {
  it("Eier und Stück: halbe, darunter Viertel, mit „ca.“", () => {
    expect(scaleAmount(3, "piece", 1 / 8)).toEqual({ amount: 0.5, approx: true }); // 0,375 Eier → ca. ½
    expect(scaleAmount(2, "piece", 1.5)).toEqual({ amount: 3, approx: false });
    expect(scaleAmount(1, "piece", 0.25)).toEqual({ amount: 0.25, approx: false });
    expect(scaleAmount(3, "piece", 0.5)).toEqual({ amount: 1.5, approx: false });
    expect(scaleAmount(1, "piece", 0.1)).toEqual({ amount: 0.25, approx: true });
  });

  it("Gramm und Milliliter ganzzahlig, große Mengen auf 5, nie „ca.“", () => {
    expect(scaleAmount(250, "g", 1.5)).toEqual({ amount: 375, approx: false });
    expect(scaleAmount(125, "g", 1 / 3)).toEqual({ amount: 42, approx: false });
    expect(scaleAmount(400, "ml", 0.75)).toEqual({ amount: 300, approx: false });
    expect(scaleAmount(333, "g", 1.1)).toEqual({ amount: 365, approx: false });
    expect(scaleAmount(7, "g", 0.5)).toEqual({ amount: 3.5, approx: false });
    expect(scaleAmount(1, "g", 0.1)).toEqual({ amount: 0.5, approx: false });
  });

  it("Löffel in halben, unter 1 in Vierteln", () => {
    expect(scaleAmount(1, "tbsp", 1.5)).toEqual({ amount: 1.5, approx: false });
    expect(scaleAmount(1, "tsp", 0.5)).toEqual({ amount: 0.5, approx: false });
    expect(scaleAmount(2, "tbsp", 0.66)).toEqual({ amount: 1.5, approx: true });
    expect(scaleAmount(1, "tsp", 0.3)).toEqual({ amount: 0.25, approx: true });
  });

  it("Prise und Dash mindestens 1", () => {
    expect(scaleAmount(1, "pinch", 0.5)).toEqual({ amount: 1, approx: true });
    expect(scaleAmount(2, "dash", 2)).toEqual({ amount: 4, approx: false });
  });

  it("ohne Menge oder Faktor 1 unverändert", () => {
    expect(scaleAmount(null, null, 2)).toEqual({ amount: null, approx: false });
    expect(scaleAmount(0.37, "piece", 1)).toEqual({ amount: 0.37, approx: false });
  });
});

describe("stepServings", () => {
  it("ganze Portionen, unter 1 halbe", () => {
    expect(stepServings(4, 1)).toBe(5);
    expect(stepServings(4, -1)).toBe(3);
    expect(stepServings(1, -1)).toBe(0.5);
    expect(stepServings(0.5, -1)).toBe(0.5);
    expect(stepServings(0.5, 1)).toBe(1);
    expect(stepServings(2.5, 1)).toBe(3);
    expect(stepServings(2.5, -1)).toBe(2);
    expect(stepServings(100, 1)).toBe(100);
  });
});
