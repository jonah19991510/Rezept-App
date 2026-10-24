import { describe, expect, it } from "vitest";
import { categoryNameSchema, categoryOptions, matchCategory, normalizeCategory, sameCategory } from "./categories";

describe("Kategorien", () => {
  it("normalisiert Text und alte Schlüssel", () => {
    expect(normalizeCategory("  Ofen   gericht ")).toBe("Ofen gericht");
    expect(normalizeCategory("pasta")).toBe("Pasta");
    expect(normalizeCategory("drink")).toBe("Getränk");
    expect(normalizeCategory("")).toBeNull();
    expect(normalizeCategory(null)).toBeNull();
    expect(normalizeCategory("x".repeat(50))).toHaveLength(40);
  });

  it("vergleicht ohne Groß-/Kleinschreibung und nimmt die eigene Schreibweise", () => {
    expect(sameCategory("Frühstück", "FRÜHSTÜCK")).toBe(true);
    expect(sameCategory("Pasta", null)).toBe(false);
    expect(matchCategory("pasta", ["Pasta", "Reis"])).toBe("Pasta");
    expect(matchCategory("reis", ["Pasta", "Reis"])).toBe("Reis");
    expect(matchCategory("Auflauf", ["Pasta"])).toBeNull();
  });

  it("Auswahl: eigene Reihenfolge, dann weitere aus Rezepten alphabetisch, ohne Doppelte", () => {
    expect(categoryOptions(["Pasta", "Bowl"], ["Ofengericht", "bowl", null, "Brot", "ofengericht"])).toEqual([
      "Pasta",
      "Bowl",
      "Brot",
      "Ofengericht",
    ]);
  });

  it("prüft Namen", () => {
    expect(categoryNameSchema.safeParse("  Brot ").data).toBe("Brot");
    expect(categoryNameSchema.safeParse("   ").success).toBe(false);
    expect(categoryNameSchema.safeParse("x".repeat(41)).success).toBe(false);
  });
});
