import { describe, expect, it } from "vitest";
import { dayGap, gapSuggestions, goalsForDay, hasAnyGoal, isTrainingDay, type GapCandidate } from "./training";

const defaults = { kcal: 2000, protein: 120, carbs: 220, fat: 70 };
const training = { kcal: 2500, protein: 160, carbs: null, fat: null };

describe("Trainingstage", () => {
  it("nimmt die Standard-Wochentage, im Plan umgeschaltete Tage gehen vor", () => {
    // 19.10.2026 ist ein Montag, 21.10. ein Mittwoch
    expect(isTrainingDay("2026-10-19", [1, 3], {})).toBe(true);
    expect(isTrainingDay("2026-10-20", [1, 3], {})).toBe(false);
    expect(isTrainingDay("2026-10-19", [1, 3], { "2026-10-19": false })).toBe(false);
    expect(isTrainingDay("2026-10-20", [], { "2026-10-20": true })).toBe(true);
  });

  it("nutzt am Trainingstag das Trainingsziel, leere Felder vom Standardziel", () => {
    expect(goalsForDay(false, defaults, training)).toEqual(defaults);
    expect(goalsForDay(true, defaults, training)).toEqual({ kcal: 2500, protein: 160, carbs: 220, fat: 70 });
    expect(goalsForDay(true, defaults, { kcal: null, protein: null, carbs: null, fat: null })).toEqual(defaults);
  });

  it("erkennt, ob überhaupt ein Ziel gesetzt ist", () => {
    expect(hasAnyGoal({ kcal: null, protein: null, carbs: null, fat: null })).toBe(false);
    expect(hasAnyGoal({ kcal: null, protein: 100, carbs: null, fat: null })).toBe(true);
  });
});

describe("Lücken-Hinweis", () => {
  it("meldet nur erwähnenswerte Lücken", () => {
    expect(dayGap({ kcal: 1580, protein: 85, carbs: 0, fat: 0 }, defaults)).toEqual({ kcal: 420, protein: 35 });
    expect(dayGap({ kcal: 1950, protein: 118, carbs: 0, fat: 0 }, defaults)).toBeNull();
    expect(dayGap({ kcal: 1950, protein: 100, carbs: 0, fat: 0 }, defaults)).toEqual({ kcal: null, protein: 20 });
    expect(dayGap({ kcal: 0, protein: 0, carbs: 0, fat: 0 }, { kcal: null, protein: null, carbs: null, fat: null })).toBeNull();
  });

  const quark: GapCandidate = { id: "q", title: "Skyr mit Beeren", kcal: 250, protein: 30, carbs: 25, fat: 3, isFavorite: false };
  const pasta: GapCandidate = { id: "p", title: "Lasagne", kcal: 900, protein: 40, carbs: 90, fat: 40, isFavorite: false };
  const shake: GapCandidate = { id: "s", title: "Proteinshake", kcal: 180, protein: 32, carbs: 6, fat: 3, isFavorite: true };
  const empty: GapCandidate = { id: "e", title: "Ohne Nährwerte", kcal: null, protein: null, carbs: null, fat: null, isFavorite: false };

  it("schlägt vor, was Protein bringt, ohne über das kcal-Ziel zu schießen", () => {
    const actual = { kcal: 1700, protein: 90, carbs: 190, fat: 62 };
    const result = gapSuggestions(actual, defaults, [pasta, quark, shake, empty]);
    expect(result.map((r) => r.id)).toEqual(["q", "s"]);
    expect(result[0].servings).toBe(1);
    expect(result[0].adds.protein).toBe(30);
  });

  it("nimmt eine halbe Portion, wenn eine ganze deutlich zu viel wäre", () => {
    const actual = { kcal: 1500, protein: 100, carbs: 170, fat: 45 };
    const result = gapSuggestions(actual, defaults, [pasta]);
    expect(result).toHaveLength(1);
    expect(result[0].servings).toBe(0.5);
    expect(result[0].adds.kcal).toBe(450);
  });

  it("schlägt nichts vor, wenn das Ziel erreicht ist", () => {
    expect(gapSuggestions({ kcal: 2000, protein: 125, carbs: 220, fat: 70 }, defaults, [quark, shake])).toEqual([]);
  });
});
