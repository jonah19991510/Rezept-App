// Supplement-Archiv: Inhaltsstoffe, Preise und der Abgleich mit Referenzwerten.
//
// Referenzwerte für Erwachsene (25 bis unter 51 Jahre): Empfehlung nach DGE (D-A-CH-Referenzwerte, sonst EFSA),
// Obergrenze als tolerierbare Gesamtzufuhr der EFSA (UL) und, wo vorhanden, die vom BfR vorgeschlagene Höchstmenge je
// Tagesdosis in Nahrungsergänzungsmitteln. Die Werte sind Orientierung, keine ärztliche Beratung. Gezählt wird nur,
// was die Supplemente liefern; die Ernährung kommt dazu.

export type Sex = "m" | "w";
export type NutrientUnit = "mg" | "µg" | "g";
/** Einheiten, die man bei einem Inhaltsstoff eintragen kann (IE wird in die Einheit des Stoffs umgerechnet). */
export const AMOUNT_UNITS = ["mg", "µg", "g", "IE"] as const;
export type AmountUnit = (typeof AMOUNT_UNITS)[number];

export type Nutrient = {
  key: string;
  label: string;
  unit: NutrientUnit;
  /** Empfehlung pro Tag (DGE/EFSA), getrennt nach Geschlecht */
  rec?: { m: number; w: number; source: string };
  /** Obergrenze (EFSA): darüber „zu viel“ */
  ul?: { value: number; source: string; /** gilt nur für Supplemente (z. B. Magnesium) */ note?: string };
  /** BfR-Höchstmenge je Tagesdosis eines Nahrungsergänzungsmittels: darüber ein milder Hinweis */
  bfr?: number;
  /** 1 IE entspricht so viel in der Einheit des Stoffs */
  perIU?: number;
  /** weitere Namen, an denen ein frei eingetragener Inhaltsstoff erkannt wird */
  aliases?: string[];
  /** kurzer Hinweis unter dem Stoff */
  hint?: string;
  /** Teil eines Sammelstoffs (EPA, DHA → Omega-3): zählt in dessen Summe, hat selbst keinen Richtwert */
  partOf?: string;
};

const DGE = "DGE";
const EFSA = "EFSA";

export const NUTRIENTS: Nutrient[] = [
  { key: "vitamin_d", label: "Vitamin D", unit: "µg", rec: { m: 20, w: 20, source: `${DGE} (ohne eigene Bildung über die Haut)` }, ul: { value: 100, source: EFSA }, perIU: 0.025, aliases: ["vit d", "d3", "vitamin d3", "cholecalciferol"] },
  { key: "vitamin_a", label: "Vitamin A", unit: "µg", rec: { m: 850, w: 700, source: DGE }, ul: { value: 3000, source: EFSA, note: "als Retinol" }, bfr: 200, perIU: 0.3, aliases: ["retinol"] },
  { key: "vitamin_e", label: "Vitamin E", unit: "mg", rec: { m: 14, w: 12, source: DGE }, ul: { value: 300, source: EFSA }, bfr: 30, perIU: 0.67, aliases: ["tocopherol"] },
  { key: "vitamin_k", label: "Vitamin K", unit: "µg", rec: { m: 70, w: 60, source: DGE }, bfr: 80, aliases: ["k2", "vitamin k2", "mk-7", "mk7", "menachinon"] },
  { key: "vitamin_c", label: "Vitamin C", unit: "mg", rec: { m: 110, w: 95, source: DGE }, bfr: 250, aliases: ["ascorbinsäure"] },
  { key: "vitamin_b1", label: "Vitamin B1", unit: "mg", rec: { m: 1.2, w: 1.0, source: DGE }, bfr: 4, aliases: ["thiamin", "b1"] },
  { key: "vitamin_b2", label: "Vitamin B2", unit: "mg", rec: { m: 1.4, w: 1.1, source: DGE }, aliases: ["riboflavin", "b2"] },
  { key: "niacin", label: "Niacin (B3)", unit: "mg", rec: { m: 15, w: 12, source: DGE }, bfr: 160, aliases: ["nicotinamid", "b3", "vitamin b3"], hint: "Als Nicotinsäure gilt schon ab 10 mg eine Obergrenze (EFSA)." },
  { key: "pantothensaeure", label: "Pantothensäure (B5)", unit: "mg", rec: { m: 5, w: 5, source: DGE }, aliases: ["b5", "vitamin b5"] },
  { key: "vitamin_b6", label: "Vitamin B6", unit: "mg", rec: { m: 1.6, w: 1.4, source: DGE }, ul: { value: 12, source: EFSA }, bfr: 3.5, aliases: ["pyridoxin", "b6"] },
  { key: "biotin", label: "Biotin (B7)", unit: "µg", rec: { m: 40, w: 40, source: DGE }, aliases: ["b7", "vitamin b7", "vitamin h"] },
  { key: "folat", label: "Folsäure / Folat", unit: "µg", rec: { m: 300, w: 300, source: DGE }, ul: { value: 1000, source: EFSA, note: "als Folsäure" }, bfr: 200, aliases: ["folsäure", "folat", "b9", "vitamin b9", "methylfolat", "5-mthf"] },
  { key: "vitamin_b12", label: "Vitamin B12", unit: "µg", rec: { m: 4, w: 4, source: DGE }, bfr: 25, aliases: ["b12", "cobalamin", "methylcobalamin", "cyanocobalamin"], hint: "Hohe Einzeldosen nimmt der Körper nur zu einem kleinen Teil auf." },
  { key: "calcium", label: "Calcium", unit: "mg", rec: { m: 1000, w: 1000, source: DGE }, ul: { value: 2500, source: EFSA }, bfr: 500, aliases: ["kalzium"] },
  { key: "magnesium", label: "Magnesium", unit: "mg", rec: { m: 350, w: 300, source: DGE }, ul: { value: 250, source: EFSA, note: "aus Supplementen" }, aliases: ["mg"] },
  { key: "eisen", label: "Eisen", unit: "mg", rec: { m: 11, w: 16, source: DGE }, ul: { value: 40, source: EFSA, note: "sichere Menge" }, bfr: 6, aliases: ["iron"], hint: "Eisen nur nach Blutwert (Ferritin) ergänzen." },
  { key: "zink", label: "Zink", unit: "mg", rec: { m: 14, w: 8, source: `${DGE} (mittlere Phytatzufuhr)` }, ul: { value: 25, source: EFSA }, bfr: 6.5, aliases: ["zinc"] },
  { key: "selen", label: "Selen", unit: "µg", rec: { m: 70, w: 60, source: DGE }, ul: { value: 255, source: EFSA }, bfr: 45, aliases: ["selenium"] },
  { key: "jod", label: "Jod", unit: "µg", rec: { m: 200, w: 200, source: DGE }, ul: { value: 600, source: EFSA }, bfr: 100, aliases: ["iod", "jodid"] },
  { key: "kupfer", label: "Kupfer", unit: "mg", rec: { m: 1.6, w: 1.3, source: EFSA }, ul: { value: 5, source: EFSA }, aliases: ["copper"] },
  { key: "kalium", label: "Kalium", unit: "mg", rec: { m: 4000, w: 4000, source: DGE }, aliases: ["potassium"] },
  { key: "mangan", label: "Mangan", unit: "mg", rec: { m: 3, w: 3, source: EFSA }, bfr: 0.5, aliases: ["manganese", "mangansulfat", "mangangluconat"], hint: "Die Ernährung liefert meist genug (Vollkorn, Nüsse, Tee)." },
  { key: "molybdaen", label: "Molybdän", unit: "µg", rec: { m: 65, w: 65, source: EFSA }, ul: { value: 600, source: EFSA }, aliases: ["molybdän", "molybdenum", "natriummolybdat"] },
  { key: "bor", label: "Bor", unit: "mg", ul: { value: 10, source: EFSA }, aliases: ["boron", "borsäure", "natriumborat"], hint: "Kein festgelegter Bedarf." },
  { key: "chrom", label: "Chrom", unit: "µg", bfr: 60, aliases: ["chromium", "chrom(iii)", "chrompicolinat", "chromchlorid"], hint: "Kein festgelegter Bedarf (DGE, EFSA)." },
  { key: "omega3", label: "Omega-3 (EPA + DHA)", unit: "mg", rec: { m: 250, w: 250, source: EFSA }, ul: { value: 5000, source: EFSA, note: "als sicher bewertet" }, aliases: ["omega 3", "omega-3", "fischöl", "algenöl", "epa+dha", "epa + dha"], hint: "Zählt EPA und DHA zusammen." },
  { key: "epa", label: "EPA (Omega-3)", unit: "mg", partOf: "omega3", aliases: ["epa", "eicosapentaensäure"] },
  { key: "dha", label: "DHA (Omega-3)", unit: "mg", partOf: "omega3", aliases: ["dha", "docosahexaensäure"] },
  { key: "q10", label: "Coenzym Q10", unit: "mg", aliases: ["q10", "coq10", "coenzym q10", "co-enzym q10", "ubichinon", "ubiquinol"], hint: "Bildet der Körper selbst; kein offizieller Richtwert." },
  { key: "kreatin", label: "Kreatin", unit: "g", rec: { m: 3, w: 3, source: "EFSA (wirksame Menge)" }, aliases: ["creatin", "creatine", "kreatin-monohydrat", "creatin monohydrat"] },
  { key: "koffein", label: "Koffein", unit: "mg", ul: { value: 400, source: EFSA, note: "pro Tag, höchstens 200 mg auf einmal" }, aliases: ["caffeine", "coffein"], hint: "Kaffee und Energydrinks kommen dazu (Getränke-Tracker)." },
];

const BY_KEY = new Map(NUTRIENTS.map((n) => [n.key, n]));
export const nutrientOf = (key: string | null | undefined) => (key ? BY_KEY.get(key) ?? null : null);

/** Freien Namen einem bekannten Stoff zuordnen (für eingetragene oder kopierte Listen). */
export function matchNutrient(name: string): Nutrient | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  return NUTRIENTS.find((x) => x.label.toLowerCase() === n || x.aliases?.includes(n)) ?? null;
}

export const SUPPLEMENT_FORMS = [
  { value: "kapsel", label: "Kapsel" },
  { value: "tablette", label: "Tablette" },
  { value: "pulver", label: "Pulver" },
  { value: "tropfen", label: "Tropfen" },
  { value: "fluessig", label: "Flüssig" },
  { value: "sonstiges", label: "Sonstiges" },
] as const;
export type SupplementForm = (typeof SUPPLEMENT_FORMS)[number]["value"];
export const formLabel = (f: SupplementForm) => SUPPLEMENT_FORMS.find((x) => x.value === f)?.label ?? "Sonstiges";

/** Einheit, in der Packungsinhalt und Portion gezählt werden (je Form; Einzahl/Mehrzahl). */
const FORM_UNIT: Record<SupplementForm, [string, string]> = {
  kapsel: ["Kapsel", "Kapseln"],
  tablette: ["Tablette", "Tabletten"],
  pulver: ["g", "g"],
  tropfen: ["Tropfen", "Tropfen"],
  fluessig: ["ml", "ml"],
  sonstiges: ["Stück", "Stück"],
};
export const formUnit = (f: SupplementForm, amount = 2) => FORM_UNIT[f][amount === 1 ? 0 : 1];

const fmtAmount = (v: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(v);

/** „3 Kapseln“, „5 g“ */
export const servingText = (s: { form: SupplementForm; servingAmount: number }) => `${fmtAmount(s.servingAmount)} ${formUnit(s.form, s.servingAmount)}`;

/** Portionen je Packung aus Packungsinhalt und Menge je Portion (90 Kapseln, 3 je Portion → 30). */
export function servingsPerPack(packAmount: number | null, servingAmount: number): number | null {
  return packAmount != null && packAmount > 0 && servingAmount > 0 ? packAmount / servingAmount : null;
}

export type Ingredient = {
  /** bekannter Stoff (Schlüssel aus NUTRIENTS) oder null für einen freien Namen */
  nutrient: string | null;
  name: string;
  amount: number;
  unit: AmountUnit;
};

export type Supplement = {
  id: string;
  name: string;
  brand: string | null;
  form: SupplementForm;
  /** Packungsinhalt in der Einheit der Form (z. B. 90 Kapseln) */
  packAmount: number | null;
  /** Menge je Portion in derselben Einheit (z. B. 3 Kapseln); die Inhaltsstoffe gelten je Portion */
  servingAmount: number;
  priceEur: number | null;
  shop: string | null;
  servingsPerDay: number;
  active: boolean;
  ingredients: Ingredient[];
  note: string | null;
};

/** Inhalt aus der Datenbank (jsonb) prüfen; Unbrauchbares fällt weg. */
export function normalizeIngredients(raw: unknown): Ingredient[] {
  if (!Array.isArray(raw)) return [];
  const out: Ingredient[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const amount = typeof r.amount === "number" && Number.isFinite(r.amount) && r.amount >= 0 ? r.amount : null;
    const unit = AMOUNT_UNITS.includes(r.unit as AmountUnit) ? (r.unit as AmountUnit) : null;
    const nutrient = typeof r.nutrient === "string" && BY_KEY.has(r.nutrient) ? r.nutrient : null;
    const name = typeof r.name === "string" && r.name.trim() ? r.name.trim().slice(0, 60) : (nutrientOf(nutrient)?.label ?? null);
    if (amount == null || !unit || !name) continue;
    out.push({ nutrient, name, amount, unit });
  }
  return out;
}

const FACTOR: Record<NutrientUnit, number> = { g: 1_000_000, mg: 1000, "µg": 1 };

/** Menge in die Einheit des Stoffs umrechnen; IE nur bei Stoffen mit Umrechnung. Nicht umrechenbar: null. */
export function toNutrientUnit(amount: number, unit: AmountUnit, nutrient: Nutrient): number | null {
  if (unit === "IE") return nutrient.perIU != null ? amount * nutrient.perIU : null;
  return (amount * FACTOR[unit]) / FACTOR[nutrient.unit];
}

/** Menge je Tag eines Inhaltsstoffs: Menge je Portion × Portionen pro Tag. */
export const dailyAmount = (ingredient: Ingredient, servingsPerDay: number) => ingredient.amount * servingsPerDay;

export type Verdict = "zu_viel" | "ueber_bfr" | "passt" | "unter" | "ohne";

export type NutrientCheck = {
  nutrient: Nutrient;
  /** Menge je Tag in der Einheit des Stoffs */
  amount: number;
  rec: number | null;
  /** Anteil der Empfehlung in Prozent */
  percentOfRec: number | null;
  verdict: Verdict;
  /** liegt nah an der Obergrenze (ab 80 %) */
  nearLimit: boolean;
};

/**
 * Abgleich einer Tagesmenge mit den Referenzwerten. „zu viel“ über der EFSA-Obergrenze; „über BfR“ über der
 * Höchstmenge für Nahrungsergänzung (milder Hinweis); „passt“ ab der Empfehlung; „unter“ darunter (die Ernährung liefert
 * den Rest); „ohne“, wenn es keinen Wert zum Vergleichen gibt.
 */
export function checkNutrient(nutrient: Nutrient, amount: number, sex: Sex | null): NutrientCheck {
  const rec = nutrient.rec ? nutrient.rec[sex ?? "m"] : null;
  const percentOfRec = rec ? (amount / rec) * 100 : null;
  const ul = nutrient.ul?.value ?? null;
  let verdict: Verdict;
  if (ul != null && amount > ul + 1e-9) verdict = "zu_viel";
  else if (nutrient.bfr != null && amount > nutrient.bfr + 1e-9) verdict = "ueber_bfr";
  else if (rec != null) verdict = amount + 1e-9 >= rec ? "passt" : "unter";
  else verdict = ul != null ? "passt" : "ohne";
  return { nutrient, amount, rec, percentOfRec, verdict, nearLimit: ul != null && verdict !== "zu_viel" && amount >= ul * 0.8 };
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  zu_viel: "Zu viel",
  ueber_bfr: "Über BfR-Höchstmenge",
  passt: "Passt",
  unter: "Unter Empfehlung",
  ohne: "Ohne Richtwert",
};

/** Satz, der ein Ergebnis erklärt (mit Werten). */
export function verdictText(check: NutrientCheck): string {
  const n = check.nutrient;
  const u = n.unit;
  switch (check.verdict) {
    case "zu_viel":
      return `Über der Obergrenze von ${fmt(n.ul!.value)} ${u} (${n.ul!.source}${n.ul!.note ? `, ${n.ul!.note}` : ""}).`;
    case "ueber_bfr":
      return `Über der BfR-Höchstmenge für Nahrungsergänzung (${fmt(n.bfr!)} ${u}).${n.ul ? ` Obergrenze ${fmt(n.ul.value)} ${u} (${n.ul.source}).` : ""}`;
    case "passt":
      return check.rec != null ? `Deckt die Empfehlung von ${fmt(check.rec)} ${u} (${n.rec!.source}).` : `Unter der Obergrenze von ${fmt(n.ul!.value)} ${u} (${n.ul!.source}).`;
    case "unter":
      return `${fmt(Math.round(check.percentOfRec ?? 0))} % der Empfehlung von ${fmt(check.rec!)} ${u}; den Rest liefert die Ernährung.`;
    case "ohne":
      return "Für diesen Stoff gibt es keinen offiziellen Richtwert.";
  }
}

const fmt = (v: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: v < 10 ? 2 : v < 100 ? 1 : 0 }).format(v);
export { fmt as formatAmount };

/**
 * Tagesmengen eines Supplements je bewertbarem Stoff. Teile (EPA, DHA) zählen in ihren Sammelstoff (Omega-3) – außer
 * die Packung nennt die Summe selbst, dann sind die Teile nur die Aufschlüsselung und zählen nicht doppelt.
 */
export function supplementAmounts(s: Pick<Supplement, "ingredients" | "servingsPerDay">): Map<string, number> {
  const explicit = new Set(s.ingredients.map((i) => i.nutrient).filter((k): k is string => k != null));
  const sums = new Map<string, number>();
  for (const ing of s.ingredients) {
    const nutrient = nutrientOf(ing.nutrient);
    if (!nutrient) continue;
    const target = nutrient.partOf ? nutrientOf(nutrient.partOf) : nutrient;
    if (!target || (nutrient.partOf && explicit.has(nutrient.partOf))) continue;
    const amount = toNutrientUnit(dailyAmount(ing, s.servingsPerDay), ing.unit, target);
    if (amount == null) continue;
    sums.set(target.key, (sums.get(target.key) ?? 0) + amount);
  }
  return sums;
}

/** Inhaltsstoff eines Supplements geprüft (mit seiner Tagesmenge allein); Teile wie EPA/DHA ohne eigene Prüfung. */
export type IngredientCheck = { ingredient: Ingredient; daily: number; check: NutrientCheck | null };

/** Ergebnis je Inhaltsstoff, dazu je Sammelstoff, der nur aus Teilen entsteht, eine eigene Zeile („Omega-3 gesamt“). */
export type SupplementCheck = { ingredients: IngredientCheck[]; combined: NutrientCheck[] };

export function checkSupplement(s: Supplement, sex: Sex | null): SupplementCheck {
  const amounts = supplementAmounts(s);
  const listed = new Set(s.ingredients.map((i) => i.nutrient));
  const ingredients = s.ingredients.map((ingredient) => {
    const daily = dailyAmount(ingredient, s.servingsPerDay);
    const nutrient = nutrientOf(ingredient.nutrient);
    const amount = nutrient && !nutrient.partOf ? amounts.get(nutrient.key) : undefined;
    return { ingredient, daily, check: nutrient && amount != null ? checkNutrient(nutrient, amount, sex) : null };
  });
  const combined = [...amounts.entries()].filter(([key]) => !listed.has(key)).map(([key, amount]) => checkNutrient(nutrientOf(key)!, amount, sex));
  return { ingredients, combined };
}

/** Tagessumme je bekanntem Stoff über alle Supplemente, die man gerade nimmt; mit den beteiligten Supplementen. */
export type TotalCheck = NutrientCheck & { sources: { id: string; name: string; amount: number }[] };

export function dailyTotals(supplements: Supplement[], sex: Sex | null): TotalCheck[] {
  const sums = new Map<string, { amount: number; sources: TotalCheck["sources"] }>();
  for (const s of supplements) {
    if (!s.active || s.servingsPerDay <= 0) continue;
    for (const [key, amount] of supplementAmounts(s)) {
      const entry = sums.get(key) ?? { amount: 0, sources: [] };
      entry.amount += amount;
      entry.sources.push({ id: s.id, name: s.name, amount });
      sums.set(key, entry);
    }
  }
  const order: Record<Verdict, number> = { zu_viel: 0, ueber_bfr: 1, unter: 2, passt: 3, ohne: 4 };
  return NUTRIENTS.filter((n) => sums.has(n.key))
    .map((n) => ({ ...checkNutrient(n, sums.get(n.key)!.amount, sex), sources: sums.get(n.key)!.sources }))
    .sort((a, b) => order[a.verdict] - order[b.verdict] || NUTRIENTS.indexOf(a.nutrient) - NUTRIENTS.indexOf(b.nutrient));
}

export type Cost = { perServing: number | null; perDay: number | null; perMonth: number | null; /** Packung reicht so viele Tage */ packDays: number | null };

/** Kosten aus Packungspreis, Portionen je Packung und Portionen pro Tag (Monat = 30 Tage). */
export function supplementCost(s: Pick<Supplement, "priceEur" | "packAmount" | "servingAmount" | "servingsPerDay">): Cost {
  const servings = servingsPerPack(s.packAmount, s.servingAmount);
  const perServing = s.priceEur != null && servings ? s.priceEur / servings : null;
  const perDay = perServing != null ? perServing * s.servingsPerDay : null;
  const packDays = servings && s.servingsPerDay > 0 ? servings / s.servingsPerDay : null;
  return { perServing, perDay, perMonth: perDay != null ? perDay * 30 : null, packDays };
}

/** Monatskosten aller Supplemente, die man gerade nimmt (ohne Preisangabe zählen sie nicht). */
export function monthlyCost(supplements: Supplement[]): { total: number; missing: number } {
  let total = 0;
  let missing = 0;
  for (const s of supplements) {
    if (!s.active) continue;
    const c = supplementCost(s).perMonth;
    if (c == null) missing++;
    else total += c;
  }
  return { total, missing };
}

/** Schlimmstes Ergebnis eines Supplements (für die Karte). */
export function worstVerdict(checks: SupplementCheck): Verdict | null {
  const order: Verdict[] = ["zu_viel", "ueber_bfr", "unter", "passt", "ohne"];
  const found = [...checks.ingredients.map((c) => c.check?.verdict), ...checks.combined.map((c) => c.verdict)].filter((v): v is Verdict => v != null);
  if (!found.length) return null;
  return order.find((v) => found.includes(v)) ?? null;
}
