import { describe, expect, it } from "vitest";
import {
  addDays,
  isIsoDate,
  isoWeekNumber,
  isoWeekday,
  mondayOf,
  resolveWeekParam,
  todayInBerlin,
  weekDays,
  relativeWeekLabel,
  weekLabel,
  weekRangeLabel,
  weekdayShort,
} from "./week";

describe("Kalender", () => {
  it("erkennt gültige ISO-Daten", () => {
    expect(isIsoDate("2026-10-19")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("19.10.2026")).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });

  it("rechnet Tage über Monats- und Jahresgrenzen", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-28", 7)).toBe("2027-01-04");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("überlebt die Zeitumstellung (25.10.2026)", () => {
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
  });

  it("findet den Montag und die Wochentage", () => {
    expect(isoWeekday("2026-10-19")).toBe(1);
    expect(isoWeekday("2026-10-25")).toBe(7);
    expect(mondayOf("2026-10-25")).toBe("2026-10-19");
    expect(mondayOf("2026-10-19")).toBe("2026-10-19");
    expect(weekDays("2026-10-19")).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ]);
    expect(weekdayShort("2026-10-21")).toBe("Mi");
  });

  it("berechnet die Kalenderwoche nach ISO 8601", () => {
    expect(isoWeekNumber("2026-10-19")).toBe(43);
    expect(isoWeekNumber("2027-01-01")).toBe(53); // Freitag, gehört zur KW 53/2026
    expect(isoWeekNumber("2026-01-01")).toBe(1);
    expect(weekLabel("2026-10-19")).toBe("KW 43 · 19.10.–25.10.2026");
  });

  it("nimmt aus der URL den Montag, sonst die aktuelle Woche", () => {
    expect(resolveWeekParam("2026-10-22", "2026-01-07")).toBe("2026-10-19");
    expect(resolveWeekParam("quatsch", "2026-01-07")).toBe("2026-01-05");
    expect(resolveWeekParam(undefined, "2026-01-07")).toBe("2026-01-05");
  });

  it("bestimmt heute in deutscher Zeit", () => {
    // 23:30 UTC am 18.10. ist in Berlin (Sommerzeit) schon der 19.10.
    expect(todayInBerlin(new Date("2026-10-18T23:30:00Z"))).toBe("2026-10-19");
  });
});

describe("Wochenleiste", () => {
  it("KW und Zeitraum ohne Jahr", () => {
    expect(weekRangeLabel("2026-10-19")).toBe("KW 43 · 19.10.–25.10.");
  });

  it("Woche relativ zu heute", () => {
    const today = "2026-10-24";
    expect(relativeWeekLabel("2026-10-19", today)).toBe("Diese Woche");
    expect(relativeWeekLabel("2026-10-12", today)).toBe("Letzte Woche");
    expect(relativeWeekLabel("2026-10-26", today)).toBe("Nächste Woche");
    expect(relativeWeekLabel("2026-11-02", today)).toBe("In 2 Wochen");
    expect(relativeWeekLabel("2026-09-28", today)).toBe("Vor 3 Wochen");
    // über den Jahreswechsel
    expect(relativeWeekLabel("2027-01-04", "2026-12-31")).toBe("Nächste Woche");
  });
});
