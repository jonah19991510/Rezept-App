import type { DayMacros, Goals } from "./plan";
import { isoWeekday } from "./week";

// Phase 11: Trainingstage mit eigenem Zielset und Lücken-Hinweis mit Rezeptvorschlägen.

/**
 * Ist der Tag ein Trainingstag? Ein im Plan umgeschalteter Tag (`plan_days`) gilt vor den
 * Standard-Trainingstagen aus den Einstellungen (ISO-Wochentage 1 = Montag … 7 = Sonntag).
 */
export function isTrainingDay(date: string, weekdays: number[], overrides: Record<string, boolean>): boolean {
  if (date in overrides) return overrides[date];
  return weekdays.includes(isoWeekday(date));
}

/** Ziele des Tages: an Trainingstagen das Trainingsziel, leere Felder fallen auf das Standardziel zurück. */
export function goalsForDay(training: boolean, defaults: Goals, trainingGoals: Goals): Goals {
  if (!training) return defaults;
  return {
    kcal: trainingGoals.kcal ?? defaults.kcal,
    protein: trainingGoals.protein ?? defaults.protein,
    carbs: trainingGoals.carbs ?? defaults.carbs,
    fat: trainingGoals.fat ?? defaults.fat,
  };
}

export function hasAnyGoal(goals: Goals): boolean {
  return [goals.kcal, goals.protein, goals.carbs, goals.fat].some((g) => g != null && g > 0);
}

/** Ab wann eine Lücke erwähnenswert ist */
const MIN_GAP = { kcal: 100, protein: 5 } as const;

export type DayGap = { kcal: number | null; protein: number | null };

/** Was bis zum Ziel fehlt (nur kcal und Protein, nur wenn erwähnenswert). null-Felder: kein Ziel oder erreicht. */
export function dayGap(actual: DayMacros, goals: Goals): DayGap | null {
  const kcal = goals.kcal ? goals.kcal - actual.kcal : null;
  const protein = goals.protein ? goals.protein - actual.protein : null;
  const gap: DayGap = {
    kcal: kcal != null && kcal >= MIN_GAP.kcal ? kcal : null,
    protein: protein != null && protein >= MIN_GAP.protein ? protein : null,
  };
  return gap.kcal == null && gap.protein == null ? null : gap;
}

export type GapCandidate = {
  id: string;
  title: string;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  isFavorite: boolean;
};

export type GapSuggestion = { id: string; title: string; servings: number; adds: DayMacros };

const WEIGHTS: Record<keyof DayMacros, number> = { kcal: 1, protein: 1.5, carbs: 0.5, fat: 0.5 };

/** Abstand zum Ziel: fehlende Anteile plus deutlich höher gewichtetes Überschreiten (Protein darf drüber). */
function distance(after: DayMacros, goals: Goals): number {
  let score = 0;
  for (const key of Object.keys(WEIGHTS) as (keyof DayMacros)[]) {
    const goal = goals[key];
    if (!goal || goal <= 0) continue;
    const deficit = Math.max(0, goal - after[key]) / goal;
    const limit = key === "protein" ? Number.POSITIVE_INFINITY : goal * 1.05;
    const over = Math.max(0, after[key] - limit) / goal;
    score += WEIGHTS[key] * (deficit + 3 * over);
  }
  return score;
}

function exceeds(after: DayMacros, goals: Goals): boolean {
  return (["kcal", "carbs", "fat"] as const).some((key) => {
    const goal = goals[key];
    return goal != null && goal > 0 && after[key] > goal * 1.1;
  });
}

/**
 * Rezepte, die die Lücke des Tages am besten schließen (½ oder 1 Portion), ohne über das Ziel zu schießen.
 * Bevorzugt Favoriten bei gleichem Ergebnis. Rezepte ohne Nährwerte fallen weg.
 */
export function gapSuggestions(actual: DayMacros, goals: Goals, candidates: GapCandidate[], limit = 3): GapSuggestion[] {
  if (!dayGap(actual, goals)) return [];
  const baseline = distance(actual, goals);
  const scored: (GapSuggestion & { score: number; isFavorite: boolean })[] = [];
  for (const c of candidates) {
    if (c.kcal == null || c.protein == null) continue;
    const per: DayMacros = { kcal: c.kcal, protein: c.protein, carbs: c.carbs ?? 0, fat: c.fat ?? 0 };
    let best: { servings: number; score: number } | null = null;
    for (const servings of [1, 0.5]) {
      const after: DayMacros = {
        kcal: actual.kcal + per.kcal * servings,
        protein: actual.protein + per.protein * servings,
        carbs: actual.carbs + per.carbs * servings,
        fat: actual.fat + per.fat * servings,
      };
      // Nichts, was ein Ziel um mehr als 10 % überschreitet (wie „über“ im Fortschritt)
      if (exceeds(after, goals)) continue;
      const score = distance(after, goals);
      // ½ Portion nur, wenn sie deutlich besser passt
      if (!best || score < best.score - 0.01) best = { servings, score };
    }
    if (!best || baseline - best.score < 0.02) continue;
    const s = best.servings;
    scored.push({
      id: c.id,
      title: c.title,
      servings: s,
      adds: { kcal: per.kcal * s, protein: per.protein * s, carbs: per.carbs * s, fat: per.fat * s },
      score: best.score,
      isFavorite: c.isFavorite,
    });
  }
  return scored
    .sort((a, b) => a.score - b.score || Number(b.isFavorite) - Number(a.isFavorite) || a.title.localeCompare(b.title, "de"))
    .slice(0, limit)
    .map(({ id, title, servings, adds }) => ({ id, title, servings, adds }));
}
