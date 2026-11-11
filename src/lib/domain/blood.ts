// Blutwerte-Archiv: Bluttests mit Messwerten, Einordnung in den Referenzbereich und Veränderungen zwischen Tests.
//
// Die Referenzbereiche im Katalog sind übliche Werte für Erwachsene. Labore haben eigene Bereiche (stehen auf dem
// Befund); wer sie einträgt, dem gelten sie vor dem Katalog. Orientierung, keine ärztliche Beratung.

import type { Sex } from "./supplements";

type Range = { low: number | null; high: number | null };

export type Marker = {
  key: string;
  label: string;
  unit: string;
  group: MarkerGroup;
  ref: { m: Range; w: Range };
  /** kurze Erklärung */
  hint?: string;
};

export const MARKER_GROUPS = ["Vitamine & Mineralstoffe", "Blutbild", "Fette & Zucker", "Leber & Niere", "Schilddrüse & Hormone", "Entzündung & Muskel"] as const;
export type MarkerGroup = (typeof MARKER_GROUPS)[number];

const both = (low: number | null, high: number | null) => ({ m: { low, high }, w: { low, high } });
const split = (m: [number | null, number | null], w: [number | null, number | null]) => ({ m: { low: m[0], high: m[1] }, w: { low: w[0], high: w[1] } });

export const MARKERS: Marker[] = [
  { key: "vitamin_d", label: "Vitamin D (25-OH)", unit: "ng/ml", group: "Vitamine & Mineralstoffe", ref: both(30, 100), hint: "Unter 20 ng/ml gilt als Mangel. In nmol/l: Wert ÷ 2,5." },
  { key: "ferritin", label: "Ferritin", unit: "ng/ml", group: "Vitamine & Mineralstoffe", ref: split([30, 400], [15, 150]), hint: "Eisenspeicher." },
  { key: "eisen", label: "Eisen", unit: "µg/dl", group: "Vitamine & Mineralstoffe", ref: split([60, 160], [50, 150]) },
  { key: "transferrinsaettigung", label: "Transferrinsättigung", unit: "%", group: "Vitamine & Mineralstoffe", ref: both(16, 45) },
  { key: "vitamin_b12", label: "Vitamin B12", unit: "pg/ml", group: "Vitamine & Mineralstoffe", ref: both(200, 900) },
  { key: "holo_tc", label: "Holo-Transcobalamin", unit: "pmol/l", group: "Vitamine & Mineralstoffe", ref: both(50, null), hint: "„Aktives B12“, früher Anzeiger für Mangel." },
  { key: "folsaeure", label: "Folsäure", unit: "ng/ml", group: "Vitamine & Mineralstoffe", ref: both(4, 20) },
  { key: "magnesium", label: "Magnesium", unit: "mmol/l", group: "Vitamine & Mineralstoffe", ref: both(0.75, 1.05) },
  { key: "zink", label: "Zink", unit: "µg/dl", group: "Vitamine & Mineralstoffe", ref: both(70, 120) },
  { key: "selen", label: "Selen", unit: "µg/l", group: "Vitamine & Mineralstoffe", ref: both(100, 140) },
  { key: "calcium", label: "Calcium", unit: "mmol/l", group: "Vitamine & Mineralstoffe", ref: both(2.2, 2.65) },
  { key: "kalium", label: "Kalium", unit: "mmol/l", group: "Vitamine & Mineralstoffe", ref: both(3.5, 5.1) },
  { key: "natrium", label: "Natrium", unit: "mmol/l", group: "Vitamine & Mineralstoffe", ref: both(135, 145) },
  { key: "omega3_index", label: "Omega-3-Index", unit: "%", group: "Vitamine & Mineralstoffe", ref: both(8, 11) },

  { key: "haemoglobin", label: "Hämoglobin", unit: "g/dl", group: "Blutbild", ref: split([13.5, 17.5], [12, 16]) },
  { key: "haematokrit", label: "Hämatokrit", unit: "%", group: "Blutbild", ref: split([40, 52], [35, 47]) },
  { key: "erythrozyten", label: "Erythrozyten", unit: "/pl", group: "Blutbild", ref: split([4.3, 5.9], [3.9, 5.2]) },
  { key: "leukozyten", label: "Leukozyten", unit: "/nl", group: "Blutbild", ref: both(4, 10) },
  { key: "thrombozyten", label: "Thrombozyten", unit: "/nl", group: "Blutbild", ref: both(150, 400) },
  { key: "mcv", label: "MCV", unit: "fl", group: "Blutbild", ref: both(80, 96) },

  { key: "cholesterin", label: "Cholesterin gesamt", unit: "mg/dl", group: "Fette & Zucker", ref: both(null, 200) },
  { key: "ldl", label: "LDL-Cholesterin", unit: "mg/dl", group: "Fette & Zucker", ref: both(null, 116), hint: "Zielwert hängt vom persönlichen Risiko ab." },
  { key: "hdl", label: "HDL-Cholesterin", unit: "mg/dl", group: "Fette & Zucker", ref: split([40, null], [50, null]) },
  { key: "triglyceride", label: "Triglyceride", unit: "mg/dl", group: "Fette & Zucker", ref: both(null, 150) },
  { key: "lpa", label: "Lipoprotein(a)", unit: "mg/dl", group: "Fette & Zucker", ref: both(null, 50) },
  { key: "glukose", label: "Glukose (nüchtern)", unit: "mg/dl", group: "Fette & Zucker", ref: both(70, 99) },
  { key: "hba1c", label: "HbA1c", unit: "%", group: "Fette & Zucker", ref: both(null, 5.7), hint: "Langzeit-Blutzucker der letzten 2–3 Monate." },

  { key: "got", label: "GOT (AST)", unit: "U/l", group: "Leber & Niere", ref: split([null, 50], [null, 35]) },
  { key: "gpt", label: "GPT (ALT)", unit: "U/l", group: "Leber & Niere", ref: split([null, 50], [null, 35]) },
  { key: "ggt", label: "Gamma-GT", unit: "U/l", group: "Leber & Niere", ref: split([null, 60], [null, 40]) },
  { key: "kreatinin", label: "Kreatinin", unit: "mg/dl", group: "Leber & Niere", ref: split([0.7, 1.2], [0.5, 0.9]), hint: "Steigt mit viel Muskelmasse und Kreatin-Einnahme." },
  { key: "egfr", label: "eGFR", unit: "ml/min", group: "Leber & Niere", ref: both(90, null) },
  { key: "harnsaeure", label: "Harnsäure", unit: "mg/dl", group: "Leber & Niere", ref: split([3.4, 7], [2.4, 5.7]) },
  { key: "harnstoff", label: "Harnstoff", unit: "mg/dl", group: "Leber & Niere", ref: both(17, 43) },

  { key: "tsh", label: "TSH", unit: "mU/l", group: "Schilddrüse & Hormone", ref: both(0.4, 4) },
  { key: "ft3", label: "fT3", unit: "pg/ml", group: "Schilddrüse & Hormone", ref: both(2, 4.4) },
  { key: "ft4", label: "fT4", unit: "ng/dl", group: "Schilddrüse & Hormone", ref: both(0.9, 1.7) },
  { key: "testosteron", label: "Testosteron", unit: "ng/ml", group: "Schilddrüse & Hormone", ref: split([2.5, 8.4], [0.1, 0.6]) },
  { key: "cortisol", label: "Cortisol (morgens)", unit: "µg/dl", group: "Schilddrüse & Hormone", ref: both(6, 23) },

  { key: "crp", label: "CRP", unit: "mg/l", group: "Entzündung & Muskel", ref: both(null, 5) },
  { key: "ck", label: "CK", unit: "U/l", group: "Entzündung & Muskel", ref: split([null, 190], [null, 170]), hint: "Steigt nach hartem Training für einige Tage." },
];

const BY_KEY = new Map(MARKERS.map((m) => [m.key, m]));
export const markerOf = (key: string | null | undefined) => (key ? BY_KEY.get(key) ?? null : null);

export type BloodValue = {
  /** Schlüssel aus dem Katalog oder null für einen eigenen Wert */
  marker: string | null;
  name: string;
  value: number;
  unit: string;
  /** Referenzbereich laut Labor (optional) */
  low: number | null;
  high: number | null;
};

export type BloodTest = { id: string; date: string; lab: string | null; note: string | null; values: BloodValue[] };

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** Messwerte aus der Datenbank (jsonb) prüfen; Unbrauchbares fällt weg. */
export function normalizeValues(raw: unknown): BloodValue[] {
  if (!Array.isArray(raw)) return [];
  const out: BloodValue[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const marker = typeof r.marker === "string" && BY_KEY.has(r.marker) ? r.marker : null;
    const name = str(r.name, 60) ?? markerOf(marker)?.label ?? null;
    const value = num(r.value);
    if (!name || value == null) continue;
    out.push({ marker, name, value, unit: str(r.unit, 20) ?? markerOf(marker)?.unit ?? "", low: num(r.low), high: num(r.high) });
  }
  return out;
}

/** Schlüssel, unter dem gleiche Werte verschiedener Tests zusammengehören (Katalog oder Name + Einheit). */
export const valueKey = (v: Pick<BloodValue, "marker" | "name" | "unit">) => v.marker ?? `eigen:${v.name.toLowerCase()}|${v.unit.toLowerCase()}`;

/** Gültiger Referenzbereich: der vom Labor, sonst der aus dem Katalog (nur bei gleicher Einheit). */
export function rangeOf(v: BloodValue, sex: Sex | null): Range {
  if (v.low != null || v.high != null) return { low: v.low, high: v.high };
  const m = markerOf(v.marker);
  if (!m || m.unit !== v.unit) return { low: null, high: null };
  return m.ref[sex ?? "m"];
}

export type Status = "niedrig" | "normal" | "hoch" | "unbekannt";

export function statusOf(v: BloodValue, sex: Sex | null): Status {
  const { low, high } = rangeOf(v, sex);
  if (low == null && high == null) return "unbekannt";
  if (low != null && v.value < low) return "niedrig";
  if (high != null && v.value > high) return "hoch";
  return "normal";
}

export const STATUS_LABEL: Record<Status, string> = { niedrig: "Niedrig", normal: "Im Bereich", hoch: "Hoch", unbekannt: "Ohne Bereich" };

const fmt = (v: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: Math.abs(v) < 10 ? 2 : 1 }).format(v);
export { fmt as formatValue };

export function rangeText(r: Range): string | null {
  if (r.low != null && r.high != null) return `${fmt(r.low)}–${fmt(r.high)}`;
  if (r.low != null) return `ab ${fmt(r.low)}`;
  if (r.high != null) return `bis ${fmt(r.high)}`;
  return null;
}

export type SeriesPoint = { testId: string; date: string; value: number; status: Status };

/** Ein Wert über alle Tests (älteste zuerst); der neueste Eintrag gibt Name und Einheit. */
export type Series = { key: string; name: string; unit: string; marker: Marker | null; points: SeriesPoint[]; range: Range };

/** Alle Werte über die Tests hinweg gruppieren. Tests in beliebiger Reihenfolge; Ergebnis nach Katalog, dann A–Z. */
export function buildSeries(tests: BloodTest[], sex: Sex | null): Series[] {
  const sorted = [...tests].sort((a, b) => a.date.localeCompare(b.date));
  const map = new Map<string, Series>();
  for (const t of sorted) {
    for (const v of t.values) {
      const key = valueKey(v);
      const s = map.get(key) ?? { key, name: v.name, unit: v.unit, marker: markerOf(v.marker), points: [], range: { low: null, high: null } };
      s.points.push({ testId: t.id, date: t.date, value: v.value, status: statusOf(v, sex) });
      s.name = v.name;
      s.unit = v.unit;
      s.range = rangeOf(v, sex);
      map.set(key, s);
    }
  }
  const idx = (s: Series) => (s.marker ? MARKERS.indexOf(s.marker) : MARKERS.length);
  return [...map.values()].sort((a, b) => idx(a) - idx(b) || a.name.localeCompare(b.name, "de"));
}

export type Change = {
  series: Series;
  previous: SeriesPoint;
  latest: SeriesPoint;
  delta: number;
  /** Veränderung in Prozent zum vorherigen Wert (null bei 0) */
  percent: number | null;
  /** besser, schlechter oder gleich bezogen auf den Referenzbereich */
  direction: "besser" | "schlechter" | "gleich" | "neutral";
  /** Status hat sich geändert (z. B. „jetzt im Bereich“) */
  statusChanged: boolean;
};

/** Abstand eines Werts zum Referenzbereich (0 = im Bereich), um „besser/schlechter“ zu erkennen. */
function distance(value: number, r: Range): number | null {
  if (r.low == null && r.high == null) return null;
  if (r.low != null && value < r.low) return r.low - value;
  if (r.high != null && value > r.high) return value - r.high;
  return 0;
}

/** Veränderung vom vorletzten zum letzten Wert; nur für Werte mit mindestens zwei Messungen. */
export function changeOf(series: Series): Change | null {
  if (series.points.length < 2) return null;
  const latest = series.points.at(-1)!;
  const previous = series.points.at(-2)!;
  const delta = latest.value - previous.value;
  const percent = previous.value !== 0 ? (delta / Math.abs(previous.value)) * 100 : null;
  const before = distance(previous.value, series.range);
  const after = distance(latest.value, series.range);
  let direction: Change["direction"] = "neutral";
  if (Math.abs(delta) < 1e-9 || (percent != null && Math.abs(percent) < 1)) direction = "gleich";
  else if (before != null && after != null) direction = after < before - 1e-9 ? "besser" : after > before + 1e-9 ? "schlechter" : "neutral";
  return { series, previous, latest, delta, percent, direction, statusChanged: previous.status !== latest.status };
}

/**
 * Wichtigste Veränderungen zwischen den letzten Messungen: erst die, deren Status sich geändert hat, dann
 * schlechter, besser, dann nach Größe der Veränderung.
 */
export function changes(series: Series[]): Change[] {
  const rank = (c: Change) => (c.statusChanged ? 0 : c.direction === "schlechter" ? 1 : c.direction === "besser" ? 2 : c.direction === "neutral" ? 3 : 4);
  return series
    .map(changeOf)
    .filter((c): c is Change => c != null)
    .sort((a, b) => rank(a) - rank(b) || Math.abs(b.percent ?? 0) - Math.abs(a.percent ?? 0));
}

/** Wert dieses Tests im Vergleich zum Test davor (für die Ansicht eines einzelnen Tests). */
export function previousValue(series: Series[], testId: string, v: BloodValue): SeriesPoint | null {
  const s = series.find((x) => x.key === valueKey(v));
  if (!s) return null;
  const i = s.points.findIndex((p) => p.testId === testId);
  return i > 0 ? s.points[i - 1] : null;
}
