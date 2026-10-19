import { describe, expect, it } from "vitest";
import { baseOf, leftoverIdeas, recipeBases } from "./leftovers";

describe("Basis-Zutaten für Reste", () => {
  it("erkennt Reis, Nudeln und Kartoffeln in Zutatennamen", () => {
    expect(baseOf("Basmatireis")).toBe("rice");
    expect(baseOf("Reis, gekocht")).toBe("rice");
    expect(baseOf("Spaghetti")).toBe("pasta");
    expect(baseOf("Vollkornnudeln")).toBe("pasta");
    expect(baseOf("Kartoffeln, festkochend")).toBe("potatoes");
  });

  it("verwechselt nichts Ähnliches", () => {
    expect(baseOf("Reisessig")).toBeNull();
    expect(baseOf("Kartoffelstärke")).toBeNull();
    expect(baseOf("Süßkartoffel")).toBeNull();
    expect(baseOf("Preiselbeeren")).toBeNull();
    expect(baseOf("Mais")).toBeNull();
  });

  it("sammelt die Basen eines Rezepts ohne Doppelte", () => {
    expect(recipeBases(["Reis", "Hähnchen", "Jasminreis"])).toEqual(["rice"]);
  });
});

describe("Reste-Vorschläge", () => {
  const bases = { curry: ["rice" as const], bratreis: ["rice" as const], reissalat: ["rice" as const], bolo: ["pasta" as const] };
  const candidates = [
    { id: "curry", title: "Curry mit Reis", isFavorite: false },
    { id: "bratreis", title: "Bratreis", isFavorite: false },
    { id: "reissalat", title: "Reissalat", isFavorite: true },
    { id: "bolo", title: "Bolognese", isFavorite: false },
  ];

  it("schlägt am Folgetag Rezepte mit derselben Basis vor, Favoriten zuerst", () => {
    const ideas = leftoverIdeas("2026-10-20", { "2026-10-19": ["curry"] }, bases, candidates);
    expect(ideas).toEqual([
      {
        base: "rice",
        fromDate: "2026-10-19",
        recipes: [
          { id: "reissalat", title: "Reissalat" },
          { id: "bratreis", title: "Bratreis" },
        ],
      },
    ]);
  });

  it("schlägt nichts vor, wenn die Basis am Tag schon verplant ist", () => {
    expect(leftoverIdeas("2026-10-20", { "2026-10-19": ["curry"], "2026-10-20": ["bratreis"] }, bases, candidates)).toEqual([]);
  });

  it("schaut höchstens zwei Tage zurück", () => {
    expect(leftoverIdeas("2026-10-21", { "2026-10-19": ["curry"] }, bases, candidates)).toHaveLength(1);
    expect(leftoverIdeas("2026-10-22", { "2026-10-19": ["curry"] }, bases, candidates)).toEqual([]);
  });
});
