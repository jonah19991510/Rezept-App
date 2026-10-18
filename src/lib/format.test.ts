import { describe, expect, it } from "vitest";
import { formatDate, formatDayShort, formatEuro, formatGrams, formatKcal, formatNumber } from "./format";

// Intl kann je nach Node-Version ein schmales geschütztes Leerzeichen vor dem € setzen
const normalize = (s: string) => s.replace(/[  ]/g, " ");

describe("Zahlenformat", () => {
  it("nutzt Punkt als Tausender- und Komma als Dezimaltrenner", () => {
    expect(formatNumber(1234.5)).toBe("1.234,5");
    expect(formatGrams(1234.5)).toBe("1.234,5 g");
  });

  it("rundet auf die gewünschte Stellenzahl", () => {
    expect(formatNumber(2.345, 2)).toBe("2,35");
    expect(formatNumber(2.04)).toBe("2");
  });

  it("zeigt kcal als ganze Zahl", () => {
    expect(formatKcal(512.6)).toBe("513 kcal");
  });

  it("formatiert Euro", () => {
    expect(normalize(formatEuro(3.49))).toBe("3,49 €");
    expect(normalize(formatEuro(1234))).toBe("1.234,00 €");
  });
});

describe("Datumsformat", () => {
  it("formatiert ein volles Datum", () => {
    expect(formatDate("2026-10-19T10:00:00Z")).toBe("19.10.2026");
  });

  it("formatiert Wochentag und Tag kurz", () => {
    expect(formatDayShort("2026-10-19T10:00:00Z")).toBe("Mo, 19.10.");
  });

  it("rechnet in deutscher Zeit (kurz vor Mitternacht UTC ist schon der nächste Tag)", () => {
    expect(formatDate("2026-10-18T22:30:00Z")).toBe("19.10.2026");
  });
});
