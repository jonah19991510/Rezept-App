import { describe, expect, it } from "vitest";
import {
  amountStep,
  dropLine,
  formatMinutes,
  groupLinesByStep,
  ingredientChipText,
  macroEnergyShares,
  moveItem,
  removeStep,
  stepAmount,
  stepPositions,
  stepTimerChip,
  timerModeOf,
  timerShortLabel,
} from "./recipe-editor";

const steps = [{ key: 10 }, { key: 11 }, { key: 12 }];
const lines = [
  { key: 1, stepKey: 10 },
  { key: 2, stepKey: 11 },
  { key: 3, stepKey: 11 },
  { key: 4, stepKey: null },
  { key: 5, stepKey: 12 },
];

describe("ingredientChipText", () => {
  it("zeigt die ersten zwei Namen und den Rest als +n", () => {
    expect(ingredientChipText(["Zwiebeln", "Knoblauch", "Möhren", "Sellerie"])).toBe("Zwiebeln, Knoblauch +2");
  });
  it("ohne Rest ohne +n", () => {
    expect(ingredientChipText(["Tomatenmark", "Rotwein"])).toBe("Tomatenmark, Rotwein");
    expect(ingredientChipText(["Rinderhack"])).toBe("Rinderhack");
    expect(ingredientChipText([])).toBe("");
  });
});

describe("Schrittzuordnung wandert mit", () => {
  it("Verschieben eines Schritts ändert die step_position der Zutaten", () => {
    expect(stepPositions(lines, steps)).toEqual([1, 2, 2, null, 3]);
    // Schritt 3 nach vorne
    const moved = moveItem(steps, 2, 0);
    expect(stepPositions(lines, moved)).toEqual([2, 3, 3, null, 1]);
  });
  it("Löschen eines Schritts: seine Zutaten sind ohne Schritt, spätere rücken auf", () => {
    const r = removeStep(steps, lines, 11);
    expect(r.steps.map((s) => s.key)).toEqual([10, 12]);
    expect(stepPositions(r.lines, r.steps)).toEqual([1, null, null, null, 2]);
  });
});

describe("groupLinesByStep", () => {
  it("eine Gruppe je Schritt (auch leer) und „Ohne Schritt“ am Ende", () => {
    const groups = groupLinesByStep(lines, [...steps, { key: 13 }]);
    expect(groups.map((g) => [g.number, g.lines.map((l) => l.key)])).toEqual([
      [1, [1]],
      [2, [2, 3]],
      [3, [5]],
      [4, []],
      [null, [4]],
    ]);
  });
  it("Zutaten mit verschwundenem Schritt zählen als ohne Schritt", () => {
    const groups = groupLinesByStep([{ key: 1, stepKey: 99 }], steps);
    expect(groups.at(-1)?.lines.map((l) => l.key)).toEqual([1]);
  });
});

describe("dropLine", () => {
  it("auf eine Zutat in einer anderen Gruppe: übernimmt Schritt und Platz", () => {
    const r = dropLine(lines, 1, { overLineKey: 3 });
    expect(r.map((l) => l.key)).toEqual([2, 3, 1, 4, 5]);
    expect(r.find((l) => l.key === 1)?.stepKey).toBe(11);
  });
  it("innerhalb der Gruppe nur umsortieren", () => {
    const r = dropLine(lines, 3, { overLineKey: 2 });
    expect(r.map((l) => [l.key, l.stepKey])).toEqual([[1, 10], [3, 11], [2, 11], [4, null], [5, 12]]);
  });
  it("auf eine Gruppe: ans Ende dieser Gruppe", () => {
    const r = dropLine(lines, 5, { groupStepKey: 10 });
    expect(r.map((l) => [l.key, l.stepKey])).toEqual([[1, 10], [5, 10], [2, 11], [3, 11], [4, null]]);
  });
  it("auf „Ohne Schritt“", () => {
    const r = dropLine(lines, 2, { groupStepKey: null });
    expect(r.find((l) => l.key === 2)?.stepKey).toBeNull();
  });
  it("auf eine leere Gruppe: Platz bleibt", () => {
    const r = dropLine(lines, 2, { groupStepKey: 13 });
    expect(r.map((l) => [l.key, l.stepKey])).toEqual([[1, 10], [2, 13], [3, 11], [4, null], [5, 12]]);
  });
});

describe("Menge −/+", () => {
  it("Schrittweite je Einheit", () => {
    expect(amountStep("g", 5)).toBe(1);
    expect(amountStep("g", 60)).toBe(5);
    expect(amountStep("g", 200)).toBe(10);
    expect(amountStep("g", 1000)).toBe(50);
    expect(amountStep("piece", 2)).toBe(1);
    expect(amountStep("tbsp", 2)).toBe(0.5);
    expect(amountStep("pinch", 1)).toBe(1);
  });
  it("rastet ein und wechselt die Stufe an den Grenzen", () => {
    expect(stepAmount(100, "g", -1)).toBe(95);
    expect(stepAmount(95, "g", 1)).toBe(100);
    expect(stepAmount(100, "g", 1)).toBe(110);
    expect(stepAmount(1000, "g", 1)).toBe(1050);
    expect(stepAmount(123, "g", 1)).toBe(130);
    expect(stepAmount(2, "tbsp", 1)).toBe(2.5);
    expect(stepAmount(1, "piece", -1)).toBe(0.5);
    expect(stepAmount(0.5, "piece", -1)).toBe(0.5);
    expect(stepAmount(null, "g", 1)).toBe(1);
  });
});

describe("macroEnergyShares", () => {
  it("kcal-Anteile mit 4/4/9", () => {
    const s = macroEnergyShares({ protein: 25, carbs: 25, fat: 0 });
    expect(s).toEqual({ protein: 0.5, carbs: 0.5, fat: 0 });
    const t = macroEnergyShares({ protein: 27, carbs: 14, fat: 40 });
    expect(t.fat).toBeCloseTo(360 / 524);
    expect(t.protein + t.carbs + t.fat).toBeCloseTo(1);
  });
  it("ohne Nährwerte alles 0", () => {
    expect(macroEnergyShares({ protein: 0, carbs: 0, fat: 0 })).toEqual({ protein: 0, carbs: 0, fat: 0 });
  });
});

describe("Zeiten und Timer", () => {
  it("formatMinutes", () => {
    expect(formatMinutes(180)).toBe("3 Std.");
    expect(formatMinutes(210)).toBe("3 Std. 30 Min.");
    expect(formatMinutes(45)).toBe("45 Min.");
    expect(formatMinutes(0)).toBeNull();
    expect(formatMinutes(null)).toBeNull();
  });
  it("timerModeOf", () => {
    expect(timerModeOf({ timer_seconds: 600 })).toBe("custom");
    expect(timerModeOf({ timer_seconds: null })).toBe("text");
    expect(timerModeOf({ timer_seconds: null, timer_from_text: false })).toBe("none");
  });
  it("Kurzform erkannter Timer", () => {
    expect(timerShortLabel({ seconds: 600, maxSeconds: null })).toBe("10 Min.");
    expect(timerShortLabel({ seconds: 7200, maxSeconds: 10800 })).toBe("2–3 Std.");
    expect(timerShortLabel({ seconds: 1200, maxSeconds: 1500 })).toBe("20–25 Min.");
  });
  it("Timer-Chip je Modus", () => {
    const text = "Zugedeckt 2–3 Stunden köcheln lassen.";
    expect(stepTimerChip(text, "text", null)).toBe("2–3 Std.");
    expect(stepTimerChip("10 Minuten braten, dann 5 Minuten ruhen", "text", null)).toBe("10 Min. +1");
    expect(stepTimerChip(text, "custom", 900)).toBe("15 Min.");
    expect(stepTimerChip(text, "none", null)).toBeNull();
    expect(stepTimerChip("Servieren.", "text", null)).toBeNull();
  });
});
