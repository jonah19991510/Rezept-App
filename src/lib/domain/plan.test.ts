import { describe, expect, it } from "vitest";
import { clampServings, entryMacros, goalProgress, summarizeWeek, totalsByDay } from "./plan";

const bowl = { kcal: 557, protein: 46, carbs: 67, fat: 10 };
const oats = { kcal: 462, protein: 29, carbs: 53, fat: 11 };

describe("Makros im Wochenplan", () => {
  it("multipliziert mit den Portionen des Eintrags", () => {
    expect(entryMacros({ servings: 1.5, perServing: bowl })).toEqual({ kcal: 835.5, protein: 69, carbs: 100.5, fat: 15 });
    expect(entryMacros({ servings: 2, perServing: null })).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it("summiert pro Tag und lässt leere Tage bei 0", () => {
    const days = ["2026-10-19", "2026-10-20"];
    const byDay = totalsByDay(days, [
      { date: "2026-10-19", servings: 1, perServing: bowl },
      { date: "2026-10-19", servings: 1, perServing: oats },
      { date: "2026-10-27", servings: 1, perServing: bowl }, // andere Woche, ignoriert
    ]);
    expect(byDay["2026-10-19"].kcal).toBe(1019);
    expect(byDay["2026-10-20"].kcal).toBe(0);
  });

  it("bildet Wochensumme und Durchschnitt über die geplanten Tage", () => {
    const byDay = {
      "2026-10-19": { kcal: 2000, protein: 150, carbs: 200, fat: 60 },
      "2026-10-20": { kcal: 1000, protein: 50, carbs: 100, fat: 30 },
      "2026-10-21": { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    };
    const summary = summarizeWeek(byDay, new Set(["2026-10-19", "2026-10-20"]));
    expect(summary.total.kcal).toBe(3000);
    expect(summary.plannedDays).toBe(2);
    expect(summary.averagePerPlannedDay.kcal).toBe(1500);
  });
});

describe("goalProgress", () => {
  it("ohne Ziel gibt es keinen Fortschritt", () => {
    expect(goalProgress(1000, null, "kcal").state).toBe("none");
    expect(goalProgress(1000, 0, "kcal").state).toBe("none");
  });

  it("unterscheidet unter, erreicht und über dem Ziel", () => {
    expect(goalProgress(1500, 2000, "kcal")).toMatchObject({ state: "under", remaining: 500 });
    expect(goalProgress(1950, 2000, "kcal").state).toBe("reached");
    expect(goalProgress(2300, 2000, "kcal").state).toBe("over");
  });

  it("mehr Protein ist kein Problem", () => {
    expect(goalProgress(200, 150, "protein").state).toBe("reached");
  });
});

describe("clampServings", () => {
  it("rundet auf Viertel und begrenzt", () => {
    expect(clampServings(1.3)).toBe(1.25);
    expect(clampServings(0)).toBe(0.25);
    expect(clampServings(99)).toBe(20);
    expect(clampServings(Number.NaN)).toBe(1);
  });
});
