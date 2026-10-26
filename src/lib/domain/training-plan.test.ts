import { describe, expect, it } from "vitest";
import { durationLabel, nextDayName, planSummary, repsRange, restLabel, suggestedFocus, targetLabel } from "./training-plan";

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
