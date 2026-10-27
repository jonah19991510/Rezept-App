import { describe, expect, it } from "vitest";
import {
  caffeineSources,
  caffeineSummary,
  dayTotals,
  daysOf,
  drinkFacts,
  drinkRanking,
  entryValues,
  formatLiters,
  goalStreak,
  longDate,
  mixValues,
  paceStatus,
  paceTarget,
  paceText,
  periodLabel,
  periodRange,
  periodSummary,
  personalTips,
  quickLabel,
  shiftPeriod,
  slotOf,
  timeOfDay,
  type DrinkEntry,
} from "./drinks";

function entry(date: string, time: string, ml: number, extra: Partial<DrinkEntry> = {}): DrinkEntry {
  const [h, m] = time.split(":").map(Number);
  return { id: `${date}-${time}-${ml}`, drinkId: "wasser", name: "Wasser", color: "blau", at: `${date}T${time}:00Z`, date, minutes: h * 60 + m, ml, caffeine: 0, sugar: 0, water: ml, ...extra };
}
const kaffee = { drinkId: "kaffee", name: "Kaffee", color: "braun", water: 0 };

describe("Mischgetränke", () => {
  it("rechnet Koffein, Zucker und Wasseranteil aus den Zutaten", () => {
    const flexpresso = mixValues([
      { name: "Milch 1,5 %", ml: 300, caffeine: 0, sugar: 4.8, water: false },
      { name: "Wasser", ml: 200, caffeine: 0, sugar: 0, water: true },
    ]);
    expect(flexpresso).toEqual({ totalMl: 500, caffeinePer100: 0, sugarPer100: 2.9, waterPercent: 40 });
  });

  it("mit Espresso: Koffein verteilt sich auf die ganze Menge", () => {
    const v = mixValues([
      { name: "Espresso", ml: 60, caffeine: 130, sugar: 0, water: false },
      { name: "Milch", ml: 240, caffeine: 0, sugar: 4.8, water: false },
    ]);
    expect(v.caffeinePer100).toBe(26);
    expect(v.waterPercent).toBe(0);
  });

  it("ohne Menge alles 0", () => {
    expect(mixValues([{ name: "x", ml: 0, caffeine: 50, sugar: 5, water: true }]).caffeinePer100).toBe(0);
  });

  it("Eintrag hält Koffein, Zucker und Wasser für die Menge fest", () => {
    expect(entryValues({ caffeinePer100: 50, sugarPer100: 10.6, waterPercent: 40 }, 330)).toEqual({ caffeine: 165, sugar: 35, water: 132 });
  });
});

describe("Anzeige", () => {
  it("Liter mit Komma", () => {
    expect(formatLiters(500)).toBe("0,50 l");
    expect(formatLiters(2000, 1)).toBe("2,0 l");
    expect(quickLabel(250)).toBe("0,25");
    expect(quickLabel(330)).toBe("0,33");
    expect(quickLabel(1000)).toBe("1,0");
  });

  it("Koffein und Zucker pro 100 ml", () => {
    expect(drinkFacts({ caffeinePer100: 0, sugarPer100: 0 })).toBe("koffeinfrei · zuckerfrei");
    expect(drinkFacts({ caffeinePer100: 32, sugarPer100: 11 })).toBe("32 mg Koffein · 11 g Zucker");
  });

  it("Datum ausgeschrieben", () => {
    expect(longDate("2026-10-27")).toBe("Dienstag, 27. Oktober");
  });
});

describe("Tempo", () => {
  it("Soll steigt von 7 bis 21 Uhr gleichmäßig", () => {
    expect(paceTarget(2000, 6 * 60)).toBe(0);
    expect(paceTarget(2000, 14 * 60)).toBe(1000);
    expect(paceTarget(2000, 22 * 60)).toBe(2000);
  });

  it("Farbe nach Abstand zum Soll", () => {
    expect(paceStatus(1000, 2000, 14 * 60).tone).toBe("good");
    expect(paceStatus(700, 2000, 14 * 60).tone).toBe("behind");
    expect(paceStatus(300, 2000, 14 * 60).tone).toBe("far");
    expect(paceStatus(2100, 2000, 14 * 60).tone).toBe("done");
  });

  it("Satz mit Uhrzeit und Rest", () => {
    expect(paceText(500, 2000, 14 * 60 + 30)).toBe("0,57 l hinter dem Soll für 14:30 Uhr · noch 1,50 l bis zum Ziel");
    expect(paceText(1500, 2000, 14 * 60)).toBe("0,50 l vor dem Soll für 14:00 Uhr · noch 0,50 l bis zum Ziel");
    expect(paceText(0, 2000, 6 * 60)).toBe("Der Tag fängt gerade an · noch 2,00 l bis zum Ziel");
    expect(paceText(2250, 2000, 20 * 60)).toBe("Ziel erreicht · 0,25 l darüber");
  });
});

describe("Zeiträume", () => {
  it("Woche und Monat", () => {
    expect(periodRange("woche", "2026-10-28")).toEqual({ from: "2026-10-26", to: "2026-11-01" });
    expect(periodRange("monat", "2026-02-10")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(periodLabel("woche", "2026-10-28")).toBe("KW 44 · 26.10.–1.11.");
    expect(periodLabel("monat", "2026-10-28")).toBe("Oktober 2026");
  });

  it("blättern", () => {
    expect(shiftPeriod("woche", "2026-10-28", -1)).toBe("2026-10-21");
    expect(shiftPeriod("monat", "2026-03-31", -1)).toBe("2026-02-28");
    expect(shiftPeriod("monat", "2026-12-15", 1)).toBe("2027-01-15");
  });
});

describe("Statistik", () => {
  const days = daysOf("2026-10-26", "2026-11-01");
  const entries = [
    entry("2026-10-26", "08:00", 1000),
    entry("2026-10-26", "15:00", 1200),
    entry("2026-10-27", "09:00", 500),
    entry("2026-10-27", "10:00", 300, { ...kaffee, caffeine: 150 }),
    entry("2026-10-28", "19:00", 2000, { ...kaffee, caffeine: 1000 }),
  ];
  const totals = dayTotals(entries, days);

  it("Kennzahlen: Ø nur über Tage mit Einträgen, Ziel bis heute", () => {
    const s = periodSummary(totals, 2000, "2026-10-29");
    expect(s.total).toBe(5000);
    expect(s.avg).toBe(1667);
    expect(s.reached).toBe(2);
    expect(s.elapsed).toBe(4);
    expect(s.best?.date).toBe("2026-10-26");
  });

  it("Serie zählt heute nur, wenn erreicht", () => {
    const map = new Map([
      ["2026-10-25", 2000],
      ["2026-10-26", 2200],
      ["2026-10-27", 800],
      ["2026-10-28", 2000],
    ]);
    expect(goalStreak(map, 2000, "2026-10-28")).toBe(1);
    expect(goalStreak(map, 2000, "2026-10-29")).toBe(1);
    expect(goalStreak(map, 2000, "2026-10-27")).toBe(2);
  });

  it("Koffein", () => {
    const c = caffeineSummary(totals);
    expect(c.total).toBe(1150);
    expect(c.over).toBe(1);
    expect(c.free).toBe(1);
    expect(c.max?.date).toBe("2026-10-28");
    expect(caffeineSources(entries)).toEqual([expect.objectContaining({ name: "Kaffee", caffeine: 1150, share: 1 })]);
  });

  it("Rangliste nach Menge", () => {
    const r = drinkRanking(entries);
    expect(r.map((x) => [x.name, x.count, x.ml])).toEqual([
      ["Wasser", 3, 2700],
      ["Kaffee", 2, 2300],
    ]);
    expect(r[0].share).toBeCloseTo(0.54);
  });

  it("Tageszeiten", () => {
    expect(slotOf(5 * 60)).toBe("morgens");
    expect(slotOf(11 * 60)).toBe("mittags");
    expect(slotOf(17 * 60 + 59)).toBe("nachmittags");
    expect(slotOf(22 * 60 + 59)).toBe("abends");
    expect(slotOf(2 * 60)).toBe("nachts");
    const slots = timeOfDay(entries);
    expect(slots.map((s) => s.key)).toEqual(["morgens", "mittags", "nachmittags", "abends"]);
    expect(slots[0].ml).toBe(1800);
  });
});

describe("Tipps", () => {
  it("erst ab drei eingetragenen Tagen", () => {
    expect(personalTips([entry("2026-10-27", "09:00", 500)], ["2026-10-27"], 2000)).toEqual([]);
  });

  it("findet wenig am Morgen und Koffein am Nachmittag", () => {
    const days = daysOf("2026-10-20", "2026-10-23");
    const entries = days.flatMap((d) => [entry(d, "16:00", 330, { ...kaffee, caffeine: 165 }), entry(d, "19:00", 1500)]);
    const titles = personalTips(entries, days, 2000).map((t) => t.title);
    expect(titles).toContain("Ziel öfter erreichen");
    expect(titles).toContain("Morgens trinkst du wenig");
    expect(titles).toContain("Viel am Abend");
    expect(titles).toContain("Koffein am Nachmittag");
  });
});
