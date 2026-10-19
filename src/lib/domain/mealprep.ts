import { addDays, daysBetween } from "./week";

// Phase 11: Meal Prep. Ein Batch wird einmal gekocht (`servings_cooked`) und auf mehrere Tage verteilt;
// der erste Eintrag ist der Kochtag, alle weiteren sind Reste. Die Einkaufsliste zählt den Batch nur einmal.

/** Wie viele Folgetage man beim Einplanen höchstens dazunehmen kann */
export const MAX_PREP_DAYS = 6;
/** Wie lange Reste eines Batches nach dem Kochtag noch vorgeschlagen werden */
export const LEFTOVER_DAYS = 3;

/** Die nächsten `count` Tage nach `date`. */
export function followingDates(date: string, count = MAX_PREP_DAYS): string[] {
  return Array.from({ length: count }, (_, i) => addDays(date, i + 1));
}

/** Gekochte Portionen: mindestens so viele, wie eingeplant sind. */
export function cookedServings(requested: number, planned: number[]): number {
  const sum = planned.reduce((a, b) => a + b, 0);
  return Math.max(requested, sum);
}

/** Übrige Portionen eines Batches (nie negativ). */
export function batchRemaining(servingsCooked: number, planned: number[]): number {
  const rest = servingsCooked - planned.reduce((a, b) => a + b, 0);
  return rest > 0.001 ? Math.round(rest * 4) / 4 : 0;
}

export type PlannedForShopping = { recipeId: string; servings: number; batchId: string | null };
export type BatchForShopping = { id: string; recipeId: string; cookDate: string; servingsCooked: number };

/**
 * Was im Zeitraum gekocht wird: normale Einträge mit ihren Portionen, Batches einmal mit allen gekochten
 * Portionen am Kochtag. Reste (Einträge eines Batches) zählen nicht extra, auch nicht, wenn der Kochtag
 * vor dem Zeitraum liegt (dann ist schon eingekauft).
 */
export function portionsToBuy(
  entries: PlannedForShopping[],
  batches: BatchForShopping[],
  from: string,
  to: string,
): { recipeId: string; servings: number }[] {
  const result = entries.filter((e) => e.batchId == null).map(({ recipeId, servings }) => ({ recipeId, servings }));
  for (const b of batches) {
    if (b.cookDate >= from && b.cookDate <= to) result.push({ recipeId: b.recipeId, servings: b.servingsCooked });
  }
  return result;
}

export type OpenBatch = {
  id: string;
  recipeId: string;
  title: string;
  cookDate: string;
  remaining: number;
};

/** Batches mit übrigen Portionen, die an `date` als Reste passen (1 bis 3 Tage nach dem Kochtag). */
export function openBatchesFor<T extends OpenBatch>(date: string, batches: T[]): T[] {
  return batches.filter((b) => {
    const age = daysBetween(b.cookDate, date);
    return b.remaining > 0 && age >= 1 && age <= LEFTOVER_DAYS;
  });
}
