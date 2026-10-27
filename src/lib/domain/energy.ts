// Energiebedarfsrechner (Sport & Gesundheit, 27.10.2026): Grundumsatz nach mehreren Formeln, Gesamtumsatz über den
// PAL (Alltag + Sport), Tagesziel und Makronährstoffe. Reine Logik ohne Datenbank.

export type Sex = "m" | "w";
export type FormulaKey = "auto" | "mifflin" | "henry" | "katch" | "mittel";
export type GoalKey = "halten" | "ab_langsam" | "ab" | "ab_zuegig" | "zu_langsam" | "zu" | "eigen";

export type EnergyProfile = {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  /** Körperfett in %, optional (nur für Katch-McArdle) */
  bodyFat: number | null;
  /** Alltagsaktivität ohne Sport */
  pal: number;
  /** Zuschlag für Sport auf den PAL */
  sport: number;
  goal: GoalKey;
  /** nur bei „eigen“ */
  customKcal: number | null;
  /** Wunschgewicht für den Proteinbedarf; leer = aktuelles Gewicht */
  targetWeightKg: number | null;
  proteinPerKg: number;
  /** Anteil Fett an der Energie in % */
  fatPercent: number;
  formula: FormulaKey;
};

export const DEFAULT_PROFILE: EnergyProfile = {
  sex: "m",
  age: 30,
  heightCm: 180,
  weightKg: 80,
  bodyFat: null,
  pal: 1.5,
  sport: 0,
  goal: "halten",
  customKcal: null,
  targetWeightKg: null,
  proteinPerKg: 1.8,
  fatPercent: 30,
  formula: "auto",
};

/** Erlaubte Bereiche der Eingaben (Formeln gelten für Erwachsene). */
export const LIMITS = {
  age: [18, 100],
  heightCm: [120, 230],
  weightKg: [30, 300],
  bodyFat: [3, 60],
  pal: [1.2, 2.4],
  customKcal: [800, 8000],
  targetWeightKg: [30, 300],
  proteinPerKg: [0.6, 3.5],
  fatPercent: [15, 50],
} as const;

/** Energie in einem Kilogramm Körperfett (Faustwert). */
export const KCAL_PER_KG = 7700;
const KCAL_PER_MJ = 239.006;

/** Beschreibung des Alltags-PAL nach DGE (ohne Sport). */
export function palDescription(pal: number): string {
  if (pal < 1.35) return "Fast nur sitzend oder liegend, kaum Bewegung.";
  if (pal < 1.55) return "Bürojob, in der Freizeit wenig aktiv.";
  if (pal < 1.75) return "Überwiegend sitzend, zeitweise gehend oder stehend (z. B. Fahrer, Labor).";
  if (pal < 1.95) return "Überwiegend gehend oder stehend (z. B. Verkauf, Handwerk, Gastronomie).";
  return "Körperlich schwere Arbeit (z. B. Bau, Landwirtschaft).";
}

export const SPORT_OPTIONS = [
  { value: 0, label: "Kein regelmäßiger Sport" },
  { value: 0.1, label: "1–2 Einheiten pro Woche (+0,1)" },
  { value: 0.2, label: "3 Einheiten pro Woche (+0,2)" },
  { value: 0.3, label: "4–5 Einheiten pro Woche (+0,3)" },
  { value: 0.5, label: "Täglich oder Leistungssport (+0,5)" },
] as const;

export const GOAL_OPTIONS: { value: GoalKey; label: string; kcal: number }[] = [
  { value: "halten", label: "Gewicht halten", kcal: 0 },
  { value: "ab_langsam", label: "Langsam abnehmen (−300 kcal)", kcal: -300 },
  { value: "ab", label: "Abnehmen (−500 kcal)", kcal: -500 },
  { value: "ab_zuegig", label: "Zügig abnehmen (−750 kcal)", kcal: -750 },
  { value: "zu_langsam", label: "Langsam zunehmen (+250 kcal)", kcal: 250 },
  { value: "zu", label: "Zunehmen (+500 kcal)", kcal: 500 },
  { value: "eigen", label: "Eigenes Kalorienziel …", kcal: 0 },
];

export const FORMULA_OPTIONS: { value: FormulaKey; label: string }[] = [
  { value: "auto", label: "Automatisch (empfohlen)" },
  { value: "mifflin", label: "Mifflin-St Jeor" },
  { value: "henry", label: "Henry / Oxford" },
  { value: "katch", label: "Katch-McArdle (mit Körperfett)" },
  { value: "mittel", label: "Mittelwert aller Formeln" },
];

// ---------------------------------------------------------------------------
// Formeln für den Grundumsatz (kcal pro Tag)
// ---------------------------------------------------------------------------

/** Mifflin-St Jeor (1990): 10 × kg + 6,25 × cm − 5 × Jahre + 5 (Männer) bzw. − 161 (Frauen). */
export function mifflin(p: Pick<EnergyProfile, "sex" | "age" | "heightCm" | "weightKg">): number {
  return 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === "m" ? 5 : -161);
}

/** Henry / Oxford (2005) mit Gewicht und Größe, in MJ je Altersgruppe; Grundlage der EFSA-Referenzwerte. */
export function henry(p: Pick<EnergyProfile, "sex" | "age" | "heightCm" | "weightKg">): number {
  const w = p.weightKg;
  const h = p.heightCm / 100;
  const [a, b, c] =
    p.sex === "m"
      ? p.age < 30
        ? [0.06, 1.31, 0.473]
        : p.age < 60
          ? [0.0476, 2.26, -0.574]
          : [0.0478, 2.26, -1.07]
      : p.age < 30
        ? [0.0433, 2.57, -1.18]
        : p.age < 60
          ? [0.0342, 2.1, -0.0486]
          : [0.0356, 1.76, 0.0448];
  return (a * w + b * h + c) * KCAL_PER_MJ;
}

/** Katch-McArdle: 370 + 21,6 × fettfreie Masse (kg). Nur mit Körperfett. */
export function katch(p: Pick<EnergyProfile, "weightKg" | "bodyFat">): number | null {
  if (p.bodyFat == null) return null;
  return 370 + 21.6 * p.weightKg * (1 - p.bodyFat / 100);
}

export type FormulaRow = { key: Exclude<FormulaKey, "auto">; label: string; sub: string; value: number | null; active: boolean };

/** Welche Formel „Automatisch“ nimmt: mit Körperfett Katch-McArdle, sonst Mifflin-St Jeor. */
export function autoFormula(p: Pick<EnergyProfile, "bodyFat">): Exclude<FormulaKey, "auto" | "mittel" | "henry"> {
  return p.bodyFat != null ? "katch" : "mifflin";
}

export function formulaReason(p: EnergyProfile): string {
  if (p.formula !== "auto") return "";
  return autoFormula(p) === "katch"
    ? "Gewählt: Katch-McArdle, weil du dein Körperfett angegeben hast. Sie rechnet mit der fettfreien Masse und passt deshalb auch bei viel Muskeln oder deutlichem Übergewicht."
    : "Gewählt: Mifflin-St Jeor, die genaueste Formel für die meisten Erwachsenen ohne Angabe zum Körperfett.";
}

// ---------------------------------------------------------------------------
// Gesamtrechnung
// ---------------------------------------------------------------------------

export type MacroResult = { grams: number; kcal: number; share: number };

export type EnergyResult = {
  formulas: FormulaRow[];
  /** benutzte Formel (bei „Automatisch“ die gewählte) */
  used: Exclude<FormulaKey, "auto">;
  bmr: number;
  palTotal: number;
  tdee: number;
  target: number;
  /** Ziel minus Gesamtumsatz (negativ = Defizit) */
  diff: number;
  /** Abstand in % vom Gesamtumsatz */
  diffPercent: number;
  /** grob kg pro Woche (negativ = abnehmen) */
  kgPerWeek: number;
  proteinWeightKg: number;
  protein: MacroResult;
  fat: MacroResult;
  carbs: MacroResult;
  /** Kohlenhydrate pro kg Körpergewicht */
  carbsPerKg: number;
  warnings: string[];
};

/** Anteile in ganzen Prozent, die zusammen 100 ergeben (größter Rest bekommt den Ausgleich). */
function shares(values: number[]): number[] {
  const total = values.reduce((s, v) => s + v, 0);
  if (total <= 0) return values.map(() => 0);
  const raw = values.map((v) => (v / total) * 100);
  const floors = raw.map(Math.floor);
  let rest = 100 - floors.reduce((s, v) => s + v, 0);
  const order = raw.map((v, i) => [v - floors[i], i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (rest <= 0) break;
    floors[i] += 1;
    rest -= 1;
  }
  return floors;
}

export function calculateEnergy(p: EnergyProfile): EnergyResult {
  const values = { mifflin: mifflin(p), henry: henry(p), katch: katch(p) };
  const available = [values.mifflin, values.henry, values.katch].filter((v): v is number => v != null);
  const mean = available.reduce((s, v) => s + v, 0) / available.length;
  const used: Exclude<FormulaKey, "auto"> =
    p.formula === "auto" ? autoFormula(p) : p.formula === "katch" && values.katch == null ? "mifflin" : p.formula;
  const bmr = used === "mittel" ? mean : (values[used] ?? values.mifflin);

  const formulas: FormulaRow[] = [
    { key: "mifflin", label: "Mifflin-St Jeor", sub: "1990 · Standard", value: values.mifflin, active: used === "mifflin" },
    { key: "henry", label: "Henry / Oxford", sub: "2005 · EFSA-Basis", value: values.henry, active: used === "henry" },
    { key: "katch", label: "Katch-McArdle", sub: values.katch == null ? "braucht Körperfett" : "fettfreie Masse", value: values.katch, active: used === "katch" },
    { key: "mittel", label: "Mittelwert", sub: available.length === 1 ? "1 Formel" : `${available.length} Formeln`, value: mean, active: used === "mittel" },
  ];

  const palTotal = Math.round((p.pal + p.sport) * 100) / 100;
  const tdee = bmr * palTotal;
  const goalKcal = GOAL_OPTIONS.find((g) => g.value === p.goal)?.kcal ?? 0;
  const target = p.goal === "eigen" && p.customKcal != null ? p.customKcal : Math.round(tdee) + goalKcal;
  const diff = target - tdee;

  const proteinWeightKg = p.targetWeightKg ?? p.weightKg;
  const proteinG = p.proteinPerKg * proteinWeightKg;
  const fatKcal = (target * p.fatPercent) / 100;
  const carbsKcal = Math.max(0, target - proteinG * 4 - fatKcal);
  const [proteinShare, fatShare, carbsShare] = shares([proteinG * 4, fatKcal, carbsKcal]);

  const warnings: string[] = [];
  if (target < bmr) warnings.push("Dein Ziel liegt unter deinem Grundumsatz. Auf Dauer ist das zu wenig; besser ein kleineres Defizit.");
  else if (diff < -0.25 * tdee) warnings.push("Mehr als 25 % Defizit sind schwer durchzuhalten und kosten leicht Muskeln. Plane lieber etwas langsamer.");
  if (target < (p.sex === "m" ? 1500 : 1200)) warnings.push(`Unter ${p.sex === "m" ? "1.500" : "1.200"} kcal am Tag ist es schwer, genug Nährstoffe zu bekommen.`);
  if (proteinG * 4 + fatKcal > target) warnings.push("Protein und Fett brauchen schon dein ganzes Ziel; für Kohlenhydrate bleibt nichts. Senke Protein oder Fett.");

  return {
    formulas,
    used,
    bmr,
    palTotal,
    tdee,
    target,
    diff,
    diffPercent: tdee ? (diff / tdee) * 100 : 0,
    kgPerWeek: (diff * 7) / KCAL_PER_KG,
    proteinWeightKg,
    protein: { grams: Math.round(proteinG), kcal: Math.round(proteinG * 4), share: proteinShare },
    fat: { grams: Math.round(fatKcal / 9), kcal: Math.round(fatKcal), share: fatShare },
    carbs: { grams: Math.round(carbsKcal / 4), kcal: Math.round(carbsKcal), share: carbsShare },
    carbsPerKg: carbsKcal / 4 / p.weightKg,
    warnings,
  };
}

/** Gespeicherte Eingaben einlesen (unbekannte oder ungültige Werte → Standard). */
export function normalizeProfile(raw: unknown): EnergyProfile {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (key: keyof typeof LIMITS, fallback: number | null) => {
    const v = r[key];
    const [min, max] = LIMITS[key];
    return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : fallback;
  };
  const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T) => (allowed.includes(v as T) ? (v as T) : fallback);
  const sport = SPORT_OPTIONS.find((s) => s.value === r.sport)?.value ?? 0;
  return {
    sex: pick(r.sex, ["m", "w"] as const, DEFAULT_PROFILE.sex),
    age: num("age", DEFAULT_PROFILE.age)!,
    heightCm: num("heightCm", DEFAULT_PROFILE.heightCm)!,
    weightKg: num("weightKg", DEFAULT_PROFILE.weightKg)!,
    bodyFat: num("bodyFat", null),
    pal: num("pal", DEFAULT_PROFILE.pal)!,
    sport,
    goal: pick(r.goal, GOAL_OPTIONS.map((g) => g.value), DEFAULT_PROFILE.goal),
    customKcal: num("customKcal", null),
    targetWeightKg: num("targetWeightKg", null),
    proteinPerKg: num("proteinPerKg", DEFAULT_PROFILE.proteinPerKg)!,
    fatPercent: num("fatPercent", DEFAULT_PROFILE.fatPercent)!,
    formula: pick(r.formula, FORMULA_OPTIONS.map((f) => f.value), DEFAULT_PROFILE.formula),
  };
}
