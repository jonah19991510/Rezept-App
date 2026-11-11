import { describe, expect, it } from "vitest";
import { buildSeries, changes, normalizeValues, statusOf, type BloodTest } from "./blood";
import { addMonths, complaintStats, dueInfo, episodeDays, medicationSummaries, normalizeTemperatures, relativeDays, sickDaysBetween, sickStats, sortCheckups, topTitles, type SickEpisode } from "./medical";
import { checkNutrient, checkSupplement, dailyTotals, matchNutrient, monthlyCost, normalizeIngredients, nutrientOf, servingText, supplementCost, toNutrientUnit, type Supplement } from "./supplements";

const supp = (over: Partial<Supplement>): Supplement => ({
  id: "s1",
  name: "Vitamin D3",
  brand: null,
  form: "kapsel",
  packAmount: null,
  servingAmount: 1,
  priceEur: null,
  shop: null,
  servingsPerDay: 1,
  active: true,
  ingredients: [],
  note: null,
  ...over,
});

describe("Supplemente", () => {
  it("rechnet IE und Einheiten um", () => {
    expect(toNutrientUnit(1000, "IE", nutrientOf("vitamin_d")!)).toBe(25);
    expect(toNutrientUnit(0.5, "g", nutrientOf("magnesium")!)).toBe(500);
    expect(toNutrientUnit(100, "IE", nutrientOf("zink")!)).toBeNull();
  });

  it("ordnet Ergebnisse ein", () => {
    const d = nutrientOf("vitamin_d")!;
    expect(checkNutrient(d, 10, "m").verdict).toBe("unter");
    expect(checkNutrient(d, 20, "m").verdict).toBe("passt");
    expect(checkNutrient(d, 125, "m").verdict).toBe("zu_viel");
    expect(checkNutrient(d, 90, "m").nearLimit).toBe(true);
    // B12: keine EFSA-Obergrenze, aber BfR-Höchstmenge
    expect(checkNutrient(nutrientOf("vitamin_b12")!, 500, null).verdict).toBe("ueber_bfr");
    // Eisen: Empfehlung für Frauen höher
    expect(checkNutrient(nutrientOf("eisen")!, 12, "m").verdict).toBe("ueber_bfr");
    expect(checkNutrient(nutrientOf("kreatin")!, 5, "m").verdict).toBe("passt");
  });

  it("summiert Stoffe über aktive Supplemente", () => {
    const list = [
      supp({ id: "a", name: "D3", ingredients: [{ nutrient: "vitamin_d", name: "Vitamin D", amount: 2000, unit: "IE" }] }),
      supp({ id: "b", name: "Multi", servingsPerDay: 2, ingredients: [{ nutrient: "vitamin_d", name: "Vitamin D", amount: 25, unit: "µg" }, { nutrient: "magnesium", name: "Magnesium", amount: 150, unit: "mg" }] }),
      supp({ id: "c", name: "Pausiert", active: false, ingredients: [{ nutrient: "magnesium", name: "Magnesium", amount: 400, unit: "mg" }] }),
    ];
    const totals = dailyTotals(list, "m");
    const d = totals.find((t) => t.nutrient.key === "vitamin_d")!;
    expect(d.amount).toBe(100);
    expect(d.sources).toHaveLength(2);
    const mg = totals.find((t) => t.nutrient.key === "magnesium")!;
    expect(mg.amount).toBe(300);
    expect(mg.verdict).toBe("zu_viel");
    expect(totals[0].verdict).toBe("zu_viel");
  });

  it("rechnet EPA und DHA zu Omega-3 zusammen", () => {
    const fish = supp({ id: "f", name: "Fischöl", servingsPerDay: 2, ingredients: [{ nutrient: "epa", name: "EPA (Omega-3)", amount: 300, unit: "mg" }, { nutrient: "dha", name: "DHA (Omega-3)", amount: 200, unit: "mg" }] });
    const check = checkSupplement(fish, "m");
    expect(check.ingredients.every((c) => c.check == null)).toBe(true);
    expect(check.combined).toHaveLength(1);
    expect(check.combined[0]).toMatchObject({ amount: 1000, verdict: "passt" });
    expect(check.combined[0].nutrient.key).toBe("omega3");
    // Summe auf der Packung angegeben: Teile zählen nicht doppelt
    const withTotal = supp({ id: "g", name: "Algenöl", ingredients: [{ nutrient: "omega3", name: "Omega-3", amount: 500, unit: "mg" }, { nutrient: "epa", name: "EPA", amount: 200, unit: "mg" }, { nutrient: "dha", name: "DHA", amount: 300, unit: "mg" }] });
    expect(checkSupplement(withTotal, "m").combined).toHaveLength(0);
    const totals = dailyTotals([fish, withTotal], "m");
    expect(totals.find((t) => t.nutrient.key === "omega3")).toMatchObject({ amount: 1500 });
    expect(totals.some((t) => t.nutrient.key === "epa")).toBe(false);
    expect(matchNutrient("EPA")?.key).toBe("epa");
    expect(matchNutrient("Fischöl")?.key).toBe("omega3");
  });

  it("rechnet Kosten", () => {
    const c = supplementCost({ priceEur: 18, packAmount: 90, servingAmount: 1, servingsPerDay: 2 });
    expect(c.perServing).toBeCloseTo(0.2);
    expect(c.perMonth).toBeCloseTo(12);
    expect(c.packDays).toBe(45);
    expect(monthlyCost([supp({ priceEur: 18, packAmount: 90, servingsPerDay: 2 }), supp({})])).toEqual({ total: expect.closeTo(12), missing: 1 });
    // 90 Kapseln, 3 je Portion, 1 Portion am Tag: 30 Portionen, Packung reicht 30 Tage
    const c3 = supplementCost({ priceEur: 10.49, packAmount: 90, servingAmount: 3, servingsPerDay: 1 });
    expect(c3.packDays).toBe(30);
    expect(c3.perServing).toBeCloseTo(10.49 / 30);
    expect(c3.perMonth).toBeCloseTo(10.49);
    expect(servingText({ form: "kapsel", servingAmount: 3 })).toBe("3 Kapseln");
    expect(servingText({ form: "kapsel", servingAmount: 1 })).toBe("1 Kapsel");
  });

  it("prüft Inhaltsstoffe und erkennt Namen", () => {
    expect(normalizeIngredients([{ nutrient: "zink", name: "", amount: 10, unit: "mg" }, { name: "x", amount: -1, unit: "mg" }, "kaputt"])).toEqual([
      { nutrient: "zink", name: "Zink", amount: 10, unit: "mg" },
    ]);
    expect(matchNutrient("D3")?.key).toBe("vitamin_d");
    expect(matchNutrient("Ashwagandha")).toBeNull();
  });
});

describe("Blutwerte", () => {
  const tests: BloodTest[] = [
    { id: "t2", date: "2026-06-01", lab: null, note: null, values: [{ marker: "vitamin_d", name: "Vitamin D (25-OH)", value: 34, unit: "ng/ml", low: null, high: null }, { marker: "ldl", name: "LDL-Cholesterin", value: 130, unit: "mg/dl", low: null, high: null }] },
    { id: "t1", date: "2026-01-10", lab: null, note: null, values: [{ marker: "vitamin_d", name: "Vitamin D (25-OH)", value: 18, unit: "ng/ml", low: null, high: null }, { marker: "ldl", name: "LDL-Cholesterin", value: 110, unit: "mg/dl", low: null, high: null }, { marker: null, name: "Eigenwert", value: 1, unit: "x", low: null, high: null }] },
  ];

  it("ordnet Werte ein, Laborbereich geht vor", () => {
    expect(statusOf(tests[1].values[0], "m")).toBe("niedrig");
    expect(statusOf({ ...tests[1].values[0], low: 10, high: 20 }, "m")).toBe("normal");
    expect(statusOf(tests[1].values[2], "m")).toBe("unbekannt");
    // andere Einheit als im Katalog: kein Bereich
    expect(statusOf({ ...tests[1].values[0], unit: "nmol/l" }, "m")).toBe("unbekannt");
  });

  it("erkennt Veränderungen", () => {
    const series = buildSeries(tests, "m");
    expect(series.map((s) => s.key)).toEqual(["vitamin_d", "ldl", "eigen:eigenwert|x"]);
    const list = changes(series);
    expect(list).toHaveLength(2);
    // beide Status geändert; Vitamin D besser, LDL schlechter
    const d = list.find((c) => c.series.key === "vitamin_d")!;
    expect(d.direction).toBe("besser");
    expect(d.statusChanged).toBe(true);
    expect(d.delta).toBe(16);
    expect(list.find((c) => c.series.key === "ldl")!.direction).toBe("schlechter");
  });

  it("verwirft kaputte Werte", () => {
    expect(normalizeValues([{ marker: "tsh", value: 2 }, { name: "", value: 1 }, { name: "A", value: "x" }])).toEqual([
      { marker: "tsh", name: "TSH", value: 2, unit: "mU/l", low: null, high: null },
    ]);
  });
});

describe("Medizin & Vorsorge", () => {
  const ep = (start: string, end: string | null, over: Partial<SickEpisode> = {}): SickEpisode => ({
    id: start,
    kind: "krank",
    severity: null,
    title: "Erkältung",
    start,
    end,
    symptoms: [],
    sickNote: false,
    temperatures: [],
    note: null,
    ...over,
  });

  it("zählt Krankheitstage ohne doppelte Tage", () => {
    expect(episodeDays(ep("2026-11-01", "2026-11-03"), "2026-11-11")).toBe(3);
    expect(episodeDays(ep("2026-11-09", null), "2026-11-11")).toBe(3);
    const list = [ep("2025-12-30", "2026-01-02"), ep("2026-01-02", "2026-01-04", { sickNote: true }), ep("2026-11-10", null)];
    expect(sickDaysBetween(list, "2026-01-01", "2026-11-11", "2026-11-11")).toBe(6);
    expect(sickStats(list, "2026-11-11")).toEqual({ thisYear: 6, last12Months: 8, episodesThisYear: 3, withSickNote: 1 });
  });

  it("zählt Beschwerden getrennt", () => {
    const list = [
      ep("2026-11-02", "2026-11-02", { kind: "beschwerde", title: "Kopfschmerzen", severity: 6 }),
      ep("2026-11-05", "2026-11-06", { kind: "beschwerde", title: "kopfschmerzen", severity: 4 }),
      ep("2026-03-01", "2026-03-01", { kind: "beschwerde", title: "Migräne", severity: null }),
    ];
    expect(complaintStats(list, "2026-11-11")).toEqual({ daysThisYear: 4, daysLast30: 3, countThisYear: 3, avgSeverity: 5 });
    expect(topTitles(list)).toEqual([
      { title: "Kopfschmerzen", count: 2 },
      { title: "Migräne", count: 1 },
    ]);
  });

  it("prüft Fiebermessungen", () => {
    expect(normalizeTemperatures([{ date: "2026-11-02", time: "20:00", celsius: 38.4 }, { date: "2026-11-02", time: "08:00", celsius: 37.2 }, { date: "x", celsius: 39 }, { date: "2026-11-01", celsius: 60 }])).toEqual([
      { date: "2026-11-02", time: "08:00", celsius: 37.2 },
      { date: "2026-11-02", time: "20:00", celsius: 38.4 },
    ]);
  });

  it("fasst Medikamente zusammen", () => {
    const s = medicationSummaries([
      { id: "1", name: "Ibuprofen", dose: "400 mg", date: "2026-11-01", time: "08:00", reason: "Kopfschmerzen", episodeId: null, note: null },
      { id: "2", name: "ibuprofen", dose: "600 mg", date: "2026-11-03", time: null, reason: "Fieber", episodeId: null, note: null },
      { id: "3", name: "Paracetamol", dose: null, date: "2026-10-01", time: null, reason: null, episodeId: null, note: null },
    ]);
    expect(s[0]).toMatchObject({ name: "ibuprofen", count: 2, lastDate: "2026-11-03", lastDose: "600 mg", reasons: ["Fieber", "Kopfschmerzen"] });
    expect(s[1].name).toBe("Paracetamol");
  });

  it("berechnet die Fälligkeit der Vorsorge", () => {
    expect(addMonths("2026-08-31", 6)).toBe("2027-02-28");
    const today = "2026-11-11";
    const visits = [{ id: "v", date: "2026-03-01", note: null }];
    expect(dueInfo({ intervalMonths: 6, nextOn: null, visits }, today)).toMatchObject({ due: "2026-09-01", source: "rhythmus", state: "ueberfaellig" });
    expect(dueInfo({ intervalMonths: 6, nextOn: "2026-12-01", visits }, today)).toMatchObject({ due: "2026-12-01", source: "termin", state: "bald" });
    // alter Termin vor dem letzten Besuch zählt nicht mehr
    expect(dueInfo({ intervalMonths: null, nextOn: "2026-02-01", visits }, today).state).toBe("offen");
    const sorted = sortCheckups(
      [
        { id: "a", name: "Augenarzt", doctor: null, intervalMonths: null, nextOn: null, note: null, visits: [] },
        { id: "z", name: "Zahnarzt", doctor: null, intervalMonths: 6, nextOn: null, note: null, visits },
      ],
      today,
    );
    expect(sorted.map((c) => c.id)).toEqual(["z", "a"]);
    expect(relativeDays(-71)).toBe("vor 2 Monaten");
    expect(relativeDays(20)).toBe("in 3 Wochen");
  });
});
