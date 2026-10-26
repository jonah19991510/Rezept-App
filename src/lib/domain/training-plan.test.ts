import { describe, expect, it } from "vitest";
import {
  durationLabel,
  filterPublicPlans,
  nextDayName,
  planMainMuscles,
  planSummary,
  repsRange,
  restLabel,
  suggestedFocus,
  targetLabel,
} from "./training-plan";

describe("repsRange", () => {
  it("zeigt Bereiche, feste Werte und offene Grenzen", () => {
    expect(repsRange(8, 12)).toBe("8–12");
    expect(repsRange(10, 10)).toBe("10");
    expect(repsRange(8, null)).toBe("ab 8");
    expect(repsRange(null, 12)).toBe("bis 12");
    expect(repsRange(null, null)).toBe("");
  });
});

describe("durationLabel", () => {
  it("formatiert Sekunden, Minuten und Stunden", () => {
    expect(durationLabel(45)).toBe("45 s");
    expect(durationLabel(120)).toBe("2 Min.");
    expect(durationLabel(150)).toBe("2:30 Min.");
    expect(durationLabel(3900)).toBe("1 Std. 5 Min.");
  });
});

describe("targetLabel", () => {
  it("nimmt Wiederholungen oder Zeit je nach Übung", () => {
    expect(targetLabel({ sets: 3, repsMin: 8, repsMax: 12, targetSeconds: null, tracking: "weight_reps" })).toBe("3 × 8–12");
    expect(targetLabel({ sets: 3, repsMin: null, repsMax: null, targetSeconds: 45, tracking: "time" })).toBe("3 × 45 s");
    expect(targetLabel({ sets: 4, repsMin: null, repsMax: null, targetSeconds: null, tracking: "weight_reps" })).toBe("4 Sätze");
    expect(targetLabel({ sets: 1, repsMin: null, repsMax: null, targetSeconds: null, tracking: "distance_time" })).toBe("1 Satz");
  });
});

describe("restLabel", () => {
  it("beschreibt die Pause", () => {
    expect(restLabel(90)).toBe("1:30 Min. Pause");
    expect(restLabel(0)).toBe("ohne Pause");
    expect(restLabel(null)).toBeNull();
  });
});

describe("nextDayName", () => {
  it("nimmt den ersten freien Buchstaben", () => {
    expect(nextDayName([])).toBe("Tag A");
    expect(nextDayName(["Tag A", "tag b"])).toBe("Tag C");
    expect(nextDayName(["Push", "Tag B"])).toBe("Tag A");
  });
});

describe("suggestedFocus", () => {
  it("nennt die zwei Muskelgruppen mit den meisten Sätzen", () => {
    expect(
      suggestedFocus([
        { muscleGroup: "chest", sets: 4 },
        { muscleGroup: "triceps", sets: 3 },
        { muscleGroup: "chest", sets: 3 },
        { muscleGroup: "shoulders", sets: 2 },
      ]),
    ).toBe("Brust, Trizeps");
    expect(suggestedFocus([])).toBe("");
  });
});

describe("planSummary", () => {
  it("zählt Tage und Übungen", () => {
    expect(planSummary([{ exercises: [1, 2] }, { exercises: [3] }])).toBe("2 Tage · 3 Übungen");
    expect(planSummary([{ exercises: [1] }])).toBe("1 Tag · 1 Übung");
  });
});

describe("Entdecken", () => {
  const plans = [
    { title: "Push / Pull / Beine", description: "Klassiker", authorName: "Mia", days: [{ name: "Push", focus: "Brust" }, { name: "Pull", focus: null }, { name: "Beine", focus: null }], muscleSets: { chest: 9, back: 9, quads: 6 } },
    { title: "Ganzkörper", description: null, authorName: "Jonah", days: [{ name: "Tag A", focus: null }, { name: "Tag B", focus: null }], muscleSets: { full_body: 6, core: 3 } },
  ];

  it("filtert nach Text, Tagen und Muskelgruppe", () => {
    expect(filterPublicPlans(plans, { query: "jonah", days: null, muscle: null }).map((p) => p.title)).toEqual(["Ganzkörper"]);
    expect(filterPublicPlans(plans, { query: "", days: "3", muscle: null }).map((p) => p.title)).toEqual(["Push / Pull / Beine"]);
    expect(filterPublicPlans(plans, { query: "", days: "1-2", muscle: "chest" })).toEqual([]);
    expect(filterPublicPlans(plans, { query: "brust", days: null, muscle: "back" })).toHaveLength(1);
  });

  it("nennt die Schwerpunkte nach Sätzen", () => {
    expect(planMainMuscles({ chest: 9, back: 12, quads: 6, core: 0 }, 2)).toEqual(["back", "chest"]);
  });
});
