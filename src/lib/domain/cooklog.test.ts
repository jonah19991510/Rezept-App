import { describe, expect, it } from "vitest";
import { cookedPerWeek, cookSummary, longNotCooked, mostCooked, notesNewestFirst, sinceText } from "./cooklog";

const log = (recipeId: string, date: string, rating: number | null, note: string | null = null) => ({ recipeId, date, rating, note });

describe("Koch-Log", () => {
  it("fasst Anzahl, letztes Datum und Durchschnitt zusammen", () => {
    const s = cookSummary([log("a", "2026-09-01", 4), log("a", "2026-10-10", null), log("a", "2026-10-01", 5)]);
    expect(s).toEqual({ count: 3, lastDate: "2026-10-10", avgRating: 4.5, ratingCount: 2 });
    expect(cookSummary([])).toEqual({ count: 0, lastDate: null, avgRating: null, ratingCount: 0 });
  });

  it("formuliert, wie lange es her ist", () => {
    expect(sinceText("2026-10-19", "2026-10-19")).toBe("heute");
    expect(sinceText("2026-10-18", "2026-10-19")).toBe("gestern");
    expect(sinceText("2026-10-14", "2026-10-19")).toBe("vor 5 Tagen");
    expect(sinceText("2026-09-28", "2026-10-19")).toBe("vor 3 Wochen");
    expect(sinceText("2026-06-01", "2026-10-19")).toBe("vor 4 Monaten");
  });

  it("sortiert Notizen, neueste zuerst, ohne leere", () => {
    const notes = notesNewestFirst([log("a", "2026-09-01", 4, "mehr Chili"), log("a", "2026-10-01", 5, "  "), log("a", "2026-10-05", 5, "perfekt")]);
    expect(notes.map((n) => n.note)).toEqual(["perfekt", "mehr Chili"]);
  });

  it("findet gut bewertete Rezepte, die lange nicht gekocht wurden", () => {
    const logs = [
      log("lasagne", "2026-07-01", 5),
      log("lasagne", "2026-08-01", 4),
      log("curry", "2026-10-10", 5),
      log("suppe", "2026-06-01", 3),
      log("salat", "2026-05-01", null),
    ];
    const result = longNotCooked(logs, "2026-10-19", 6);
    expect(result.map((r) => r.recipeId)).toEqual(["lasagne"]);
    expect(result[0]).toMatchObject({ lastDate: "2026-08-01", avgRating: 4.5, weeksAgo: 11 });
  });

  it("zählt gekochte Gerichte pro Woche", () => {
    const result = cookedPerWeek([log("a", "2026-10-12", 4), log("b", "2026-10-18", null), log("c", "2026-10-19", null)], ["2026-10-12", "2026-10-19"]);
    expect(result).toEqual([
      { monday: "2026-10-12", count: 2 },
      { monday: "2026-10-19", count: 1 },
    ]);
  });

  it("listet die meistgekochten Rezepte mit Bewertung", () => {
    const top = mostCooked([log("a", "2026-10-01", 4), log("a", "2026-10-08", 5), log("b", "2026-10-02", 3)], new Map([["a", "Curry"], ["b", "Suppe"]]));
    expect(top.map((t) => [t.title, t.count, t.avgRating])).toEqual([
      ["Curry", 2, 4.5],
      ["Suppe", 1, 3],
    ]);
  });
});
