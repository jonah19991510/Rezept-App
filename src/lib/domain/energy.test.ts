import { describe, expect, it } from "vitest";
import { calculateEnergy, DEFAULT_PROFILE, henry, katch, mifflin, normalizeProfile, palDescription, type EnergyProfile } from "./energy";

// Werte aus dem Screenshot der früheren App: Mann, 26 J., 187 cm, 113 kg, PAL 1,5, eigenes Ziel 2.400 kcal,
// Wunschgewicht 95 kg, 1,8 g Protein/kg, 30 % Fett
const jonah: EnergyProfile = {
  ...DEFAULT_PROFILE,
  sex: "m",
  age: 26,
  heightCm: 187,
  weightKg: 113,
  pal: 1.5,
  goal: "eigen",
  customKcal: 2400,
  targetWeightKg: 95,
  proteinPerKg: 1.8,
  fatPercent: 30,
};

describe("Formeln für den Grundumsatz", () => {
  it("Mifflin-St Jeor", () => {
    expect(Math.round(mifflin(jonah))).toBe(2174);
    expect(Math.round(mifflin({ sex: "w", age: 30, heightCm: 168, weightKg: 62 }))).toBe(1359);
  });

  it("Henry / Oxford je Altersgruppe", () => {
    expect(Math.round(henry(jonah))).toBe(2319);
    expect(henry({ ...jonah, age: 45 })).toBeLessThan(henry(jonah));
    expect(Math.round(henry({ sex: "w", age: 30, heightCm: 168, weightKg: 62 }))).toBe(1338);
  });

  it("Katch-McArdle nur mit Körperfett", () => {
    expect(katch(jonah)).toBeNull();
    expect(Math.round(katch({ weightKg: 113, bodyFat: 25 })!)).toBe(2201);
  });
});

describe("Gesamtrechnung", () => {
  it("rechnet wie die frühere App", () => {
    const r = calculateEnergy(jonah);
    expect(r.used).toBe("mifflin");
    expect(Math.round(r.bmr)).toBe(2174);
    expect(Math.round(r.formulas.find((f) => f.key === "mittel")!.value!)).toBe(2246);
    expect(r.formulas.find((f) => f.key === "mittel")!.sub).toBe("2 Formeln");
    expect(Math.round(r.tdee)).toBe(3261);
    expect(r.target).toBe(2400);
    expect(Math.round(r.diff)).toBe(-861);
    expect(Math.round(r.diffPercent)).toBe(-26);
    expect(r.kgPerWeek.toFixed(2)).toBe("-0.78");
    expect(r.protein).toMatchObject({ grams: 171, kcal: 684 });
    expect(r.fat).toMatchObject({ grams: 80, kcal: 720, share: 30 });
    expect(r.carbs).toMatchObject({ grams: 249, kcal: 996 });
    expect(r.protein.share + r.fat.share + r.carbs.share).toBe(100);
    expect(r.carbsPerKg.toFixed(1)).toBe("2.2");
    expect(r.warnings).toEqual(["Mehr als 25 % Defizit sind schwer durchzuhalten und kosten leicht Muskeln. Plane lieber etwas langsamer."]);
  });

  it("Sport-Zuschlag und Ziele", () => {
    const r = calculateEnergy({ ...jonah, sport: 0.3, goal: "ab" });
    expect(r.palTotal).toBe(1.8);
    expect(r.target).toBe(Math.round(r.tdee) - 500);
  });

  it("Automatisch nimmt mit Körperfett Katch-McArdle", () => {
    const r = calculateEnergy({ ...jonah, bodyFat: 25 });
    expect(r.used).toBe("katch");
    expect(r.formulas.find((f) => f.key === "mittel")!.sub).toBe("3 Formeln");
  });

  it("Katch-McArdle gewählt, aber ohne Körperfett: Mifflin", () => {
    expect(calculateEnergy({ ...jonah, formula: "katch" }).used).toBe("mifflin");
  });

  it("warnt unter dem Grundumsatz und wenn für Kohlenhydrate nichts bleibt", () => {
    const r = calculateEnergy({ ...jonah, customKcal: 1400, proteinPerKg: 3, fatPercent: 40 });
    expect(r.warnings.length).toBe(3);
    expect(r.carbs.grams).toBe(0);
  });
});

describe("Hilfen", () => {
  it("PAL-Beschreibung", () => {
    expect(palDescription(1.5)).toBe("Bürojob, in der Freizeit wenig aktiv.");
    expect(palDescription(2.2)).toContain("schwere Arbeit");
  });

  it("gespeicherte Eingaben einlesen", () => {
    expect(normalizeProfile(null)).toEqual(DEFAULT_PROFILE);
    expect(normalizeProfile({ ...jonah, age: 12, sport: 0.7, formula: "x" })).toEqual({ ...jonah, age: DEFAULT_PROFILE.age, sport: 0, formula: "auto" });
  });
});
