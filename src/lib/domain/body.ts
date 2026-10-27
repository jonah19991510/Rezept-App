// Körpermaße (Sport & Gesundheit, 27.10.2026): Gewicht und Umfänge, Veränderungen, Trend, BMI und
// Taille-Hüft-Verhältnis. Reine Logik ohne Datenbank. Tage als „YYYY-MM-DD“.

import { formatNumber } from "@/lib/format";
import { addDays, daysBetween } from "./week";

export type MeasureKey = "weight" | "neck" | "shoulder" | "chest" | "waist" | "belly" | "hip" | "upperArm" | "thigh" | "calf";
/** Diagramm-Größen: alle Maße plus BMI, Taille-Hüft-Verhältnis und Körperfett (Navy) */
export type MetricKey = MeasureKey | "bmi" | "whr" | "kfa";
export type Sex = "m" | "w";

export type Measurement = { id: string; date: string; note: string | null } & Record<MeasureKey, number | null>;

export type Guide = {
  /** Kurzbeschreibung unter der Überschrift */
  where: string;
  steps: string[];
  /** Markierung in der Figur: Band (Ellipse) oder Waage */
  mark: { kind: "band"; cx: number; cy: number; rx: number; ry: number } | { kind: "scale" };
};

export type Measure = { key: MeasureKey; label: string; unit: "kg" | "cm"; column: string; min: number; max: number; guide: Guide };

/** Alle Maße in der Reihenfolge von oben nach unten (wie in der Messanleitung). */
export const MEASURES: Measure[] = [
  {
    key: "weight",
    label: "Gewicht",
    unit: "kg",
    column: "weight_kg",
    min: 20,
    max: 400,
    guide: {
      where: "Morgens, nüchtern, nach dem Toilettengang.",
      steps: [
        "Waage auf einen harten, ebenen Boden stellen (kein Teppich).",
        "Ohne oder mit wenig Kleidung wiegen, immer gleich.",
        "Ruhig stehen, Gewicht auf beide Füße verteilen, ablesen.",
      ],
      mark: { kind: "scale" },
    },
  },
  {
    key: "neck",
    label: "Hals",
    unit: "cm",
    column: "neck_cm",
    min: 20,
    max: 80,
    guide: {
      where: "Knapp unterhalb des Kehlkopfs. Wird für den Körperfettanteil (Navy-Methode) gebraucht.",
      steps: [
        "Aufrecht stehen, geradeaus schauen, Schultern locker.",
        "Maßband knapp unter dem Kehlkopf um den Hals legen, vorne leicht nach unten geneigt.",
        "Band anliegend, aber nicht drückend, dann ablesen.",
      ],
      mark: { kind: "band", cx: 60, cy: 40, rx: 7, ry: 2.5 },
    },
  },
  {
    key: "shoulder",
    label: "Schulter",
    unit: "cm",
    column: "shoulder_cm",
    min: 30,
    max: 250,
    guide: {
      where: "Breiteste Stelle über beide Schultern.",
      steps: [
        "Aufrecht stehen, Arme locker hängen lassen.",
        "Maßband waagerecht um die breiteste Stelle führen, über die Schultermuskeln und die Oberarmansätze.",
        "Im Spiegel prüfen, dass das Band hinten nicht nach unten rutscht. Eine zweite Person hilft hier sehr.",
      ],
      mark: { kind: "band", cx: 60, cy: 58, rx: 38, ry: 5 },
    },
  },
  {
    key: "chest",
    label: "Brust",
    unit: "cm",
    column: "chest_cm",
    min: 30,
    max: 250,
    guide: {
      where: "Auf Höhe der Brustwarzen.",
      steps: [
        "Aufrecht stehen, Arme leicht vom Körper weg.",
        "Maßband waagerecht über die Brustwarzen und unter den Achseln um den Rücken führen.",
        "Normal ausatmen, nicht die Brust aufpumpen, dann ablesen.",
      ],
      mark: { kind: "band", cx: 60, cy: 76, rx: 30, ry: 5 },
    },
  },
  {
    key: "waist",
    label: "Taille",
    unit: "cm",
    column: "waist_cm",
    min: 30,
    max: 250,
    guide: {
      where: "Schmalste Stelle zwischen unterster Rippe und Beckenknochen.",
      steps: [
        "Füße etwa hüftbreit, entspannt stehen.",
        "Maßband waagerecht um die schmalste Stelle des Rumpfs führen, meist etwas über dem Bauchnabel.",
        "Normal ausatmen, Bauch nicht einziehen, dann ablesen.",
      ],
      mark: { kind: "band", cx: 60, cy: 98, rx: 24, ry: 4.5 },
    },
  },
  {
    key: "belly",
    label: "Bauch",
    unit: "cm",
    column: "belly_cm",
    min: 30,
    max: 250,
    guide: {
      where: "Genau auf Höhe des Bauchnabels.",
      steps: [
        "Füße etwa hüftbreit, entspannt stehen.",
        "Maßband waagerecht genau über den Bauchnabel führen.",
        "Normal ausatmen, Bauch nicht einziehen und nicht herausdrücken, dann ablesen.",
      ],
      mark: { kind: "band", cx: 60, cy: 110, rx: 26, ry: 4.5 },
    },
  },
  {
    key: "hip",
    label: "Hüfte",
    unit: "cm",
    column: "hip_cm",
    min: 30,
    max: 250,
    guide: {
      where: "Breiteste Stelle über dem Gesäß.",
      steps: [
        "Füße geschlossen, Gesäß entspannt.",
        "Maßband waagerecht um die breiteste Stelle von Hüfte und Gesäß führen.",
        "Seitlich im Spiegel prüfen, dass das Band hinten nicht hochrutscht, dann ablesen.",
      ],
      mark: { kind: "band", cx: 60, cy: 124, rx: 28, ry: 5 },
    },
  },
  {
    key: "upperArm",
    label: "Oberarm",
    unit: "cm",
    column: "upper_arm_cm",
    min: 10,
    max: 100,
    guide: {
      where: "Dickste Stelle des Oberarms, entspannt.",
      steps: [
        "Arm locker hängen lassen, nicht anspannen.",
        "Maßband waagerecht um die dickste Stelle zwischen Schulter und Ellbogen führen.",
        "Immer denselben Arm messen (z. B. rechts).",
      ],
      mark: { kind: "band", cx: 24, cy: 84, rx: 8, ry: 3 },
    },
  },
  {
    key: "thigh",
    label: "Oberschenkel",
    unit: "cm",
    column: "thigh_cm",
    min: 20,
    max: 150,
    guide: {
      where: "Dickste Stelle, etwa eine Handbreit unter dem Schritt.",
      steps: [
        "Gerade stehen, Gewicht auf beide Beine verteilen.",
        "Maßband waagerecht um die dickste Stelle des Oberschenkels führen.",
        "Immer dasselbe Bein messen.",
      ],
      mark: { kind: "band", cx: 49, cy: 152, rx: 12, ry: 3.5 },
    },
  },
  {
    key: "calf",
    label: "Wade",
    unit: "cm",
    column: "calf_cm",
    min: 15,
    max: 100,
    guide: {
      where: "Dickste Stelle der Wade.",
      steps: [
        "Gerade stehen, Gewicht auf beide Beine verteilen.",
        "Maßband waagerecht um die dickste Stelle der Wade führen.",
        "Immer dasselbe Bein messen.",
      ],
      mark: { kind: "band", cx: 49, cy: 200, rx: 9, ry: 3 },
    },
  },
];

export const CIRCUMFERENCES = MEASURES.filter((m) => m.unit === "cm");

/** Gilt für alle Umfänge. */
export const GENERAL_TIPS = [
  "Weiches Maßband direkt auf der Haut, straff, aber ohne einzuschneiden.",
  "Immer zur gleichen Tageszeit messen, am besten morgens vor dem Frühstück.",
  "Vor dem Spiegel messen, damit das Band rundum waagerecht liegt.",
  "Jede Stelle zweimal messen und den Mittelwert eintragen.",
];

export function measureOf(key: MeasureKey): Measure {
  return MEASURES.find((m) => m.key === key)!;
}

// ---------------------------------------------------------------------------
// BMI und Taille-Hüft-Verhältnis
// ---------------------------------------------------------------------------

export function bmi(weightKg: number | null, heightCm: number | null): number | null {
  if (weightKg == null || !heightCm) return null;
  return weightKg / (heightCm / 100) ** 2;
}

/** Einteilung nach WHO. */
export function bmiCategory(value: number): string {
  if (value < 18.5) return "Untergewicht";
  if (value < 25) return "Normalgewicht";
  if (value < 30) return "Übergewicht";
  if (value < 35) return "Adipositas Grad I";
  if (value < 40) return "Adipositas Grad II";
  return "Adipositas Grad III";
}

/** Taille-Hüft-Verhältnis (WHR). */
export function whr(waistCm: number | null, hipCm: number | null): number | null {
  if (waistCm == null || !hipCm) return null;
  return waistCm / hipCm;
}

/** Ab welchem WHR die WHO ein erhöhtes Risiko sieht. */
export function whrLimit(sex: Sex | null): number | null {
  return sex === "m" ? 0.9 : sex === "w" ? 0.85 : null;
}

/**
 * Körperfettanteil in % nach der Navy-Methode (Hodgdon & Beckett, US Navy), alles in cm:
 * Männer 495 / (1,0324 − 0,19077 · log10(Bauch − Hals) + 0,15456 · log10(Größe)) − 450, Bauch auf Nabelhöhe
 * (fehlt er, die Taille);
 * Frauen 495 / (1,29579 − 0,35004 · log10(Taille + Hüfte − Hals) + 0,22100 · log10(Größe)) − 450, Taille an der
 * schmalsten Stelle.
 * Ohne nötige Werte oder bei unmöglichen Kombinationen null.
 */
export function navyBodyFat(
  sex: Sex | null,
  heightCm: number | null,
  m: Pick<Measurement, "neck" | "waist" | "belly" | "hip">,
): number | null {
  if (!sex || !heightCm || m.neck == null) return null;
  let value: number;
  if (sex === "m") {
    const abdomen = m.belly ?? m.waist;
    if (abdomen == null || abdomen - m.neck <= 0) return null;
    value = 495 / (1.0324 - 0.19077 * Math.log10(abdomen - m.neck) + 0.15456 * Math.log10(heightCm)) - 450;
  } else {
    if (m.waist == null || m.hip == null || m.waist + m.hip - m.neck <= 0) return null;
    value = 495 / (1.29579 - 0.35004 * Math.log10(m.waist + m.hip - m.neck) + 0.221 * Math.log10(heightCm)) - 450;
  }
  return value > 0 && value < 75 ? value : null;
}

/** Einordnung des Körperfetts (übliche Bereiche nach dem American Council on Exercise). */
export function bodyFatCategory(value: number, sex: Sex): string {
  const limits = sex === "m" ? [6, 14, 18, 25] : [14, 21, 25, 32];
  if (value < limits[0]) return "essenziell";
  if (value < limits[1]) return "sportlich";
  if (value < limits[2]) return "fit";
  if (value < limits[3]) return "durchschnittlich";
  return "erhöht";
}

/** Welche Maße die Navy-Formel braucht. */
export function navyNeeds(sex: Sex | null): string {
  return sex === "w" ? "Hals, Taille, Hüfte und Körpergröße" : "Hals, Bauch (oder Taille) und Körpergröße";
}

// ---------------------------------------------------------------------------
// Reihen, Veränderungen und Trend
// ---------------------------------------------------------------------------

export type Point = { date: string; value: number };

/** Werte einer Größe über die Zeit (älteste zuerst); Messungen ohne Wert fallen weg. */
export function seriesOf(measurements: Measurement[], key: MetricKey, heightCm: number | null, sex: Sex | null = null): Point[] {
  const sorted = [...measurements].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.flatMap((m) => {
    const value =
      key === "bmi" ? bmi(m.weight, heightCm) : key === "whr" ? whr(m.waist, m.hip) : key === "kfa" ? navyBodyFat(sex, heightCm, m) : m[key];
    return value == null ? [] : [{ date: m.date, value }];
  });
}

export type ChartRange = "1m" | "3m" | "1j" | "alle";

export function inChartRange(points: Point[], range: ChartRange, today: string): Point[] {
  if (range === "alle") return points;
  const from = addDays(today, range === "1m" ? -30 : range === "3m" ? -91 : -365);
  return points.filter((p) => p.date >= from);
}

/** Steigung der Ausgleichsgeraden in Einheiten pro Tag (mindestens zwei Tage auseinander), sonst null. */
export function trendPerDay(points: Point[]): number | null {
  if (points.length < 2) return null;
  const xs = points.map((p) => daysBetween(points[0].date, p.date));
  const n = points.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = points.reduce((a, p) => a + p.value, 0) / n;
  let sxx = 0;
  let sxy = 0;
  points.forEach((p, i) => {
    sxx += (xs[i] - mx) ** 2;
    sxy += (xs[i] - mx) * (p.value - my);
  });
  return sxx === 0 ? null : sxy / sxx;
}

export const DAYS_PER_MONTH = 30.4375;

export type ChangeStats = {
  first: Point;
  last: Point;
  previous: Point | null;
  /** letzter minus erster Wert */
  change: number;
  changePercent: number;
  /** letzter minus vorletzter Wert */
  sinceLast: number | null;
  perWeek: number | null;
  perMonth: number | null;
  count: number;
};

export function changeStats(points: Point[]): ChangeStats | null {
  if (points.length === 0) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const previous = points.length > 1 ? points[points.length - 2] : null;
  const slope = trendPerDay(points);
  return {
    first,
    last,
    previous,
    change: last.value - first.value,
    changePercent: first.value ? ((last.value - first.value) / first.value) * 100 : 0,
    sinceLast: previous ? last.value - previous.value : null,
    perWeek: slope == null ? null : slope * 7,
    perMonth: slope == null ? null : slope * DAYS_PER_MONTH,
    count: points.length,
  };
}

// ---------------------------------------------------------------------------
// Anzeige
// ---------------------------------------------------------------------------

/** „112,1“ (eine Nachkommastelle, auch bei ganzen Zahlen) */
export function fixed(value: number, digits = 1): string {
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

/** Vorzeichen immer: „−1,6“, „+0,4“, „±0,0“ */
export function signed(value: number, digits = 1): string {
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) return `±${fixed(0, digits)}`;
  return `${rounded > 0 ? "+" : "−"}${fixed(Math.abs(rounded), digits)}`;
}

/** Nachkommastellen je Größe: WHR zwei, sonst eine. */
export function digitsOf(key: MetricKey): number {
  return key === "whr" ? 2 : 1;
}

export function unitOf(key: MetricKey): string {
  return key === "bmi" || key === "whr" ? "" : key === "kfa" ? "%" : measureOf(key).unit;
}

export function metricLabel(key: MetricKey): string {
  return key === "bmi" ? "BMI" : key === "whr" ? "WHR" : key === "kfa" ? "KFA" : measureOf(key).label;
}

const MONTHS = ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sept.", "Okt.", "Nov.", "Dez."];
const WEEKDAYS = ["So.", "Mo.", "Di.", "Mi.", "Do.", "Fr.", "Sa."];

/** „24. Okt. 2026“ */
export function longDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}. ${MONTHS[m - 1]} ${y}`;
}

/** „Sa., 24. Okt. 2026“ */
export function weekdayDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${longDay(iso)}`;
}

/** „15. Okt.“ */
export function shortDay(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d}. ${MONTHS[m - 1]}`;
}

/** Pfad für eine kleine Verlaufslinie (Sparkline) in einem Feld w × h. */
export function sparklinePath(values: number[], w: number, h: number, pad = 2): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - 2 * pad);
      const y = pad + (1 - (v - min) / span) * (h - 2 * pad);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

// ---------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------

/** Körpergröße für den BMI, Geschlecht für Körperfett (Navy) und WHR-Grenze, ausgeblendete Maße. */
export type BodySettings = { heightCm: number | null; sex: Sex | null; hidden: MeasureKey[] };

export function normalizeBodySettings(raw: unknown, fallbackHeight: number | null = null, fallbackSex: Sex | null = null): BodySettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const h = r.heightCm;
  const heightCm = typeof h === "number" && h >= 100 && h <= 250 ? h : fallbackHeight;
  const sex = r.sex === "m" || r.sex === "w" ? r.sex : fallbackSex;
  const keys = MEASURES.map((m) => m.key);
  const hidden = Array.isArray(r.hidden) ? (r.hidden.filter((k) => keys.includes(k as MeasureKey) && k !== "weight") as MeasureKey[]) : [];
  return { heightCm, sex, hidden };
}

/** Zahl für Kennzahlen: „1,6“ */
export const num = (v: number, digits = 1) => formatNumber(v, digits);
