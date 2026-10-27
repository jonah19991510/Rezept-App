import { describe, expect, it } from "vitest";
import {
  bmi,
  bmiCategory,
  bodyFatCategory,
  navyBodyFat,
  changeStats,
  inChartRange,
  longDay,
  normalizeBodySettings,
  seriesOf,
  signed,
  sparklinePath,
  weekdayDay,
  whr,
  type Measurement,
} from "./body";

const empty = { neck: null, shoulder: null, chest: null, waist: null, belly: null, hip: null, upperArm: null, thigh: null, calf: null, note: null };

// Werte aus den Screenshots der früheren App (187 cm)
const measurements: Measurement[] = [
  { ...empty, id: "c", date: "2026-10-24", weight: 112.1, chest: 110, waist: 103, belly: 102, hip: 112, upperArm: 41 },
  { ...empty, id: "a", date: "2026-10-09", weight: 113.7, shoulder: 130.5, chest: 114, waist: 104.5, belly: 106, hip: 113.5, upperArm: 41.5, thigh: 70.6, calf: 43.8 },
  { ...empty, id: "b", date: "2026-10-15", weight: 112.5, chest: 115.3, waist: 104, belly: 105, hip: 112, upperArm: 41.8, thigh: 69, calf: 43.4 },
];

describe("Veränderungen und Trend", () => {
  it("Gewicht wie in der früheren App", () => {
    const s = changeStats(seriesOf(measurements, "weight", 187))!;
    expect(s.first).toEqual({ date: "2026-10-09", value: 113.7 });
    expect(s.last.value).toBe(112.1);
    expect(signed(s.change)).toBe("−1,6");
    expect(signed(s.changePercent)).toBe("−1,4");
    expect(signed(s.sinceLast!)).toBe("−0,4");
    expect(s.previous?.date).toBe("2026-10-15");
    expect(signed(s.perWeek!, 2)).toBe("−0,71");
    expect(signed(s.perMonth!)).toBe("−3,1");
  });

  it("Umfänge: Brust −4,0 cm, −3,5 %, letzte −5,3 cm, −2,04 cm/Woche", () => {
    const s = changeStats(seriesOf(measurements, "chest", 187))!;
    expect(signed(s.change)).toBe("−4,0");
    expect(signed(s.changePercent)).toBe("−3,5");
    expect(signed(s.sinceLast!)).toBe("−5,3");
    expect(signed(s.perWeek!, 2)).toBe("−2,04");
  });

  it("nur eine Messung: kein Trend, keine letzte Veränderung", () => {
    const s = changeStats(seriesOf(measurements, "shoulder", 187))!;
    expect(s.count).toBe(1);
    expect(s.sinceLast).toBeNull();
    expect(s.perWeek).toBeNull();
    expect(changeStats([])).toBeNull();
  });
});

describe("BMI und WHR", () => {
  it("BMI mit Körpergröße", () => {
    expect(bmi(112.1, 187)!.toFixed(1)).toBe("32.1");
    expect(bmi(112.1, null)).toBeNull();
    expect(bmiCategory(32.1)).toBe("Adipositas Grad I");
    expect(bmiCategory(22)).toBe("Normalgewicht");
    const s = changeStats(seriesOf(measurements, "bmi", 187))!;
    expect(signed(s.change)).toBe("−0,5");
  });

  it("Taille-Hüft-Verhältnis", () => {
    expect(whr(103, 112)!.toFixed(2)).toBe("0.92");
    expect(signed(changeStats(seriesOf(measurements, "whr", 187))!.change, 2)).toBe("±0,00");
  });
});

describe("Anzeige und Einstellungen", () => {
  it("Datum", () => {
    expect(longDay("2026-10-24")).toBe("24. Okt. 2026");
    expect(weekdayDay("2026-10-24")).toBe("Sa., 24. Okt. 2026");
  });

  it("Zeitraum und Sparkline", () => {
    const points = seriesOf(measurements, "weight", 187);
    expect(inChartRange(points, "1m", "2026-11-20").map((p) => p.date)).toEqual(["2026-10-24"]);
    expect(sparklinePath([3, 2, 1], 100, 20)).toBe("M2.0,2.0 L50.0,10.0 L98.0,18.0");
    expect(sparklinePath([3], 100, 20)).toBe("");
  });

  it("Einstellungen: Größe und Geschlecht aus dem Energierechner als Vorgabe, Gewicht nie ausblendbar", () => {
    expect(normalizeBodySettings(null, 187, "m")).toEqual({ heightCm: 187, sex: "m", hidden: [] });
    expect(normalizeBodySettings({ heightCm: 180, sex: "w", hidden: ["calf", "weight", "x"] }, 187, "m")).toEqual({ heightCm: 180, sex: "w", hidden: ["calf"] });
  });
});

describe("Körperfett nach der Navy-Methode", () => {
  it("Männer: Bauch (Nabelhöhe) und Hals", () => {
    expect(navyBodyFat("m", 187, { neck: 42, belly: 102, waist: 103, hip: null })!.toFixed(1)).toBe("24.0");
    // ohne Bauch die Taille
    expect(navyBodyFat("m", 187, { neck: 42, belly: null, waist: 102, hip: null })!.toFixed(1)).toBe("24.0");
  });

  it("Frauen: Taille, Hüfte und Hals", () => {
    expect(navyBodyFat("w", 168, { neck: 32, waist: 72, hip: 98, belly: null })!.toFixed(1)).toBe("26.6");
    expect(navyBodyFat("w", 168, { neck: 32, waist: 72, hip: null, belly: null })).toBeNull();
  });

  it("ohne Hals, Größe oder Geschlecht kein Wert; Einordnung", () => {
    expect(navyBodyFat("m", 187, { neck: null, belly: 102, waist: null, hip: null })).toBeNull();
    expect(navyBodyFat(null, 187, { neck: 42, belly: 102, waist: null, hip: null })).toBeNull();
    expect(navyBodyFat("m", null, { neck: 42, belly: 102, waist: null, hip: null })).toBeNull();
    expect(bodyFatCategory(24, "m")).toBe("durchschnittlich");
    expect(bodyFatCategory(26.6, "w")).toBe("durchschnittlich");
    expect(bodyFatCategory(12, "m")).toBe("sportlich");
  });

  it("als Verlauf", () => {
    const withNeck = measurements.map((m) => ({ ...m, neck: 42 }));
    expect(seriesOf(withNeck, "kfa", 187, "m").map((p) => p.value.toFixed(1))).toEqual(["26.4", "25.8", "24.0"]);
  });
});
