import type { Enums } from "@/lib/supabase/database.types";

export type MealSlot = Enums<"meal_slot">;

export const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

export const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Frühstück",
  lunch: "Mittag",
  dinner: "Abend",
  snack: "Snack",
};

export type DayMacros = { kcal: number; protein: number; carbs: number; fat: number };

export type PlanEntryMacros = {
  date: string;
  servings: number;
  /** Makros einer Portion des Rezepts (aus recipe_nutrition) */
  perServing: DayMacros | null;
};

export type Goals = { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null };

const ZERO: DayMacros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export function entryMacros(entry: Pick<PlanEntryMacros, "servings" | "perServing">): DayMacros {
  if (!entry.perServing) return { ...ZERO };
  return {
    kcal: entry.perServing.kcal * entry.servings,
    protein: entry.perServing.protein * entry.servings,
    carbs: entry.perServing.carbs * entry.servings,
    fat: entry.perServing.fat * entry.servings,
  };
}

export function sumMacros(list: DayMacros[]): DayMacros {
  return list.reduce(
    (acc, m) => ({ kcal: acc.kcal + m.kcal, protein: acc.protein + m.protein, carbs: acc.carbs + m.carbs, fat: acc.fat + m.fat }),
    { ...ZERO },
  );
}

/** Summe pro Tag für alle Tage der Woche (auch leere Tage mit 0). */
export function totalsByDay(days: string[], entries: PlanEntryMacros[]): Record<string, DayMacros> {
  const result: Record<string, DayMacros> = Object.fromEntries(days.map((d) => [d, { ...ZERO }]));
  for (const entry of entries) {
    if (!result[entry.date]) continue;
    result[entry.date] = sumMacros([result[entry.date], entryMacros(entry)]);
  }
  return result;
}

export type WeekSummary = {
  total: DayMacros;
  /** Durchschnitt über die Tage, an denen etwas geplant ist */
  averagePerPlannedDay: DayMacros;
  plannedDays: number;
};

export function summarizeWeek(byDay: Record<string, DayMacros>, plannedDates: Set<string>): WeekSummary {
  const total = sumMacros(Object.values(byDay));
  const plannedDays = [...plannedDates].filter((d) => d in byDay).length;
  const divisor = plannedDays || 1;
  return {
    total,
    plannedDays,
    averagePerPlannedDay: {
      kcal: total.kcal / divisor,
      protein: total.protein / divisor,
      carbs: total.carbs / divisor,
      fat: total.fat / divisor,
    },
  };
}

export type ProgressState = "none" | "under" | "reached" | "over";

/**
 * Fortschritt Ist gegen Soll. Bei kcal, Kohlenhydraten und Fett gilt mehr als 110 % als „über“,
 * bei Protein ist mehr kein Problem.
 */
export function goalProgress(actual: number, goal: number | null, kind: keyof DayMacros) {
  if (goal == null || goal <= 0) return { ratio: 0, state: "none" as ProgressState, remaining: null };
  const ratio = actual / goal;
  let state: ProgressState = "under";
  if (ratio >= 0.95) state = "reached";
  if (kind !== "protein" && ratio > 1.1) state = "over";
  return { ratio, state, remaining: goal - actual };
}

/** Portionen-Eingabe: in halben Schritten, mindestens ¼, höchstens 20. */
export function clampServings(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(20, Math.max(0.25, Math.round(value * 4) / 4));
}

/** Tag im Ziel: kcal bei 90–110 % des Tagesziels (ohne kcal-Ziel nie). */
export function inKcalTarget(kcal: number, goal: number | null): boolean {
  if (goal == null || goal <= 0) return false;
  const ratio = kcal / goal;
  return ratio >= 0.9 && ratio <= 1.1;
}

export type KcalBarState = "empty" | "low" | "target" | "over";

/**
 * Kleiner Balken in der Tagesleiste: leer ohne Einträge, sonst Anteil am kcal-Ziel (ohne Ziel voll und grau).
 * „target“ bei 90–110 %, „over“ darüber, „low“ darunter.
 */
export function kcalBar(kcal: number, goal: number | null, hasEntries: boolean): { state: KcalBarState; ratio: number } {
  if (!hasEntries) return { state: "empty", ratio: 0 };
  if (goal == null || goal <= 0) return { state: "low", ratio: 1 };
  const ratio = kcal / goal;
  return { state: inKcalTarget(kcal, goal) ? "target" : ratio > 1.1 ? "over" : "low", ratio: Math.min(1, ratio) };
}
