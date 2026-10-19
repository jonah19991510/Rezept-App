import { addDays, daysBetween, mondayOf } from "./week";

// Phase 12: Koch-Log. Jedes Kochen mit Datum, Bewertung (1–5), Notiz, Portionen und gekochter Rezeptversion.

export type CookLog = {
  id: string;
  recipeId: string;
  /** Tag im Format YYYY-MM-DD (Berliner Zeit) */
  date: string;
  rating: number | null;
  note: string | null;
  servings: number | null;
  version: number | null;
};

export type CookSummary = {
  count: number;
  lastDate: string | null;
  /** Durchschnitt der vergebenen Bewertungen, null ohne Bewertung */
  avgRating: number | null;
  ratingCount: number;
};

export function cookSummary(logs: Pick<CookLog, "date" | "rating">[]): CookSummary {
  const ratings = logs.map((l) => l.rating).filter((r): r is number => r != null);
  const lastDate = logs.reduce<string | null>((max, l) => (max == null || l.date > max ? l.date : max), null);
  return {
    count: logs.length,
    lastDate,
    avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    ratingCount: ratings.length,
  };
}

/** „heute“, „gestern“, „vor 5 Tagen“, „vor 3 Wochen“, „vor 4 Monaten“ */
export function sinceText(date: string, today: string): string {
  const days = daysBetween(date, today);
  if (days <= 0) return "heute";
  if (days === 1) return "gestern";
  if (days < 14) return `vor ${days} Tagen`;
  if (days < 60) return `vor ${Math.floor(days / 7)} Wochen`;
  const months = Math.floor(days / 30);
  return months < 24 ? `vor ${months} Monaten` : `vor ${Math.floor(days / 365)} Jahren`;
}

/** Notizen, neueste zuerst. Die erste ist „die letzte Notiz“ für den Kochmodus. */
export function notesNewestFirst<T extends Pick<CookLog, "date" | "note">>(logs: T[]): T[] {
  return logs.filter((l) => l.note && l.note.trim()).sort((a, b) => b.date.localeCompare(a.date));
}

/** Als „gut bewertet“ gilt ein Durchschnitt ab 4 Sternen */
export const GOOD_RATING = 4;

export type LongNotCooked = { recipeId: string; lastDate: string; avgRating: number; weeksAgo: number };

/**
 * „Lange nicht gekocht“: gut bewertete Rezepte, deren letztes Kochen mindestens `weeks` Wochen her ist.
 * Die am längsten nicht gekochten zuerst. Nie gekochte Rezepte haben keine Bewertung und fallen weg.
 */
export function longNotCooked(logs: Pick<CookLog, "recipeId" | "date" | "rating">[], today: string, weeks: number): LongNotCooked[] {
  const byRecipe = new Map<string, Pick<CookLog, "date" | "rating">[]>();
  for (const l of logs) byRecipe.set(l.recipeId, [...(byRecipe.get(l.recipeId) ?? []), l]);
  const result: LongNotCooked[] = [];
  for (const [recipeId, list] of byRecipe) {
    const s = cookSummary(list);
    if (s.avgRating == null || s.avgRating < GOOD_RATING || !s.lastDate) continue;
    const days = daysBetween(s.lastDate, today);
    if (days < weeks * 7) continue;
    result.push({ recipeId, lastDate: s.lastDate, avgRating: s.avgRating, weeksAgo: Math.floor(days / 7) });
  }
  return result.sort((a, b) => a.lastDate.localeCompare(b.lastDate));
}

/** Gekochte Gerichte pro Woche (mondays aufsteigend). */
export function cookedPerWeek(logs: Pick<CookLog, "date">[], mondays: string[]): { monday: string; count: number }[] {
  const counts = new Map(mondays.map((m) => [m, 0]));
  for (const l of logs) {
    const m = mondayOf(l.date);
    if (counts.has(m)) counts.set(m, counts.get(m)! + 1);
  }
  return mondays.map((monday) => ({ monday, count: counts.get(monday) ?? 0 }));
}

/** Meistgekochte Rezepte mit Durchschnittsbewertung. */
export function mostCooked(logs: Pick<CookLog, "recipeId" | "date" | "rating">[], titles: Map<string, string>, top = 5) {
  const byRecipe = new Map<string, Pick<CookLog, "date" | "rating">[]>();
  for (const l of logs) byRecipe.set(l.recipeId, [...(byRecipe.get(l.recipeId) ?? []), l]);
  return [...byRecipe.entries()]
    .map(([recipeId, list]) => ({ recipeId, title: titles.get(recipeId) ?? "Rezept", ...cookSummary(list) }))
    .sort((a, b) => b.count - a.count || (b.avgRating ?? 0) - (a.avgRating ?? 0) || a.title.localeCompare(b.title, "de"))
    .slice(0, top);
}

/** Erster Tag des Zeitraums für „die letzten N Wochen“ (Montag). */
export function firstMonday(today: string, weeks: number): string {
  return addDays(mondayOf(today), -(weeks - 1) * 7);
}
