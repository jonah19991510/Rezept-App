import { formatNumber } from "@/lib/format";
import { isTimed, MUSCLE_LABELS, normalizeSearch, type MuscleGroup, type Tracking } from "./exercises";

// Sport & Gesundheit, Phase S1: Trainingspläne (Anzeige-Texte, Zusammenfassungen).

export type PlanTarget = {
  sets: number;
  repsMin: number | null;
  repsMax: number | null;
  targetSeconds: number | null;
  tracking: Tracking;
};

/** „8–12“, „10“, „ab 8“, „bis 12“; ohne Angabe leer. */
export function repsRange(min: number | null, max: number | null): string {
  if (min != null && max != null) return min === max ? `${min}` : `${min}–${max}`;
  if (min != null) return `ab ${min}`;
  if (max != null) return `bis ${max}`;
  return "";
}

/** „45 s“, „2 Min.“, „2:30 Min.“, „1 Std. 5 Min.“ */
export function durationLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s === 0 ? `${m} Min.` : `${m}:${String(s).padStart(2, "0")} Min.`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m === 0 ? `${h} Std.` : `${h} Std. ${m} Min.`;
}

/** Ziel einer Übung im Plan: „3 × 8–12“, „3 × 45 s“, „4 Sätze“. */
export function targetLabel(t: PlanTarget): string {
  if (isTimed(t.tracking)) return t.targetSeconds ? `${t.sets} × ${durationLabel(t.targetSeconds)}` : setsLabel(t.sets);
  const reps = repsRange(t.repsMin, t.repsMax);
  return reps ? `${t.sets} × ${reps}` : setsLabel(t.sets);
}

export function setsLabel(sets: number): string {
  return sets === 1 ? "1 Satz" : `${sets} Sätze`;
}

/** „90 s Pause“, „2 Min. Pause“ */
export function restLabel(seconds: number | null): string | null {
  return seconds == null ? null : seconds === 0 ? "ohne Pause" : `${durationLabel(seconds)} Pause`;
}

/** Feste Auswahl für die Pause (Sekunden). */
export const REST_CHOICES = [60, 90, 120, 180] as const;

/** Name für einen neuen Trainingstag: „Tag A“, „Tag B“ …, nach „Tag Z“ „Tag 27“. */
export function defaultDayName(index: number): string {
  return index < 26 ? `Tag ${String.fromCharCode(65 + index)}` : `Tag ${index + 1}`;
}

/** Freier Name für einen neuen Tag: der erste „Tag X“, den es noch nicht gibt. */
export function nextDayName(existing: string[]): string {
  const taken = new Set(existing.map((n) => n.trim().toLocaleLowerCase("de")));
  for (let i = 0; ; i++) {
    const name = defaultDayName(i);
    if (!taken.has(name.toLocaleLowerCase("de"))) return name;
  }
}

/**
 * Fokus-Vorschlag eines Tages aus den Übungen: die (höchstens zwei) Muskelgruppen mit den meisten Sätzen,
 * z. B. „Brust, Trizeps“. Ohne Übungen leer.
 */
export function suggestedFocus(exercises: { muscleGroup: MuscleGroup; sets: number }[]): string {
  const sets = new Map<MuscleGroup, number>();
  for (const e of exercises) sets.set(e.muscleGroup, (sets.get(e.muscleGroup) ?? 0) + e.sets);
  return [...sets]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([m]) => MUSCLE_LABELS[m])
    .join(", ");
}

/** „3 Tage · 18 Übungen“ */
export function planSummary(days: { exercises: unknown[] }[]): string {
  const count = days.reduce((n, d) => n + d.exercises.length, 0);
  return `${days.length === 1 ? "1 Tag" : `${days.length} Tage`} · ${count === 1 ? "1 Übung" : `${formatNumber(count, 0)} Übungen`}`;
}

/** Sätze gesamt eines Tages (für „ca. 20 Sätze“). */
export function totalSets(exercises: { sets: number }[]): number {
  return exercises.reduce((n, e) => n + e.sets, 0);
}

// ---------------------------------------------------------------------------
// Entdecken (Phase S4)
// ---------------------------------------------------------------------------

export type DaysFilter = "1-2" | "3" | "4+";

export const DAYS_FILTER_LABELS: Record<DaysFilter, string> = { "1-2": "1–2 Tage", "3": "3 Tage", "4+": "4+ Tage" };

export function matchesDays(dayCount: number, filter: DaysFilter): boolean {
  if (filter === "1-2") return dayCount <= 2;
  if (filter === "3") return dayCount === 3;
  return dayCount >= 4;
}

/** Schwerpunkte eines Plans: Muskelgruppen mit den meisten Sätzen (höchstens `limit`). */
export function planMainMuscles(muscleSets: Partial<Record<MuscleGroup, number>>, limit = 3): MuscleGroup[] {
  return (Object.entries(muscleSets) as [MuscleGroup, number][])
    .filter(([, sets]) => sets > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([m]) => m);
}

type DiscoverPlan = {
  title: string;
  description: string | null;
  authorName: string;
  days: { name: string; focus: string | null }[];
  muscleSets: Partial<Record<MuscleGroup, number>>;
};

/** Öffentliche Pläne filtern: Text (Titel, Beschreibung, Autor, Tage), Anzahl Tage, Muskelgruppe (trainiert sie). */
export function filterPublicPlans<P extends DiscoverPlan>(plans: P[], options: { query: string; days: DaysFilter | null; muscle: MuscleGroup | null }): P[] {
  const words = normalizeSearch(options.query).split(" ").filter(Boolean);
  return plans.filter((p) => {
    if (options.days && !matchesDays(p.days.length, options.days)) return false;
    if (options.muscle && !(p.muscleSets[options.muscle] ?? 0)) return false;
    if (words.length === 0) return true;
    const haystack = normalizeSearch([p.title, p.description ?? "", p.authorName, ...p.days.flatMap((d) => [d.name, d.focus ?? ""])].join(" "));
    return words.every((w) => haystack.includes(w));
  });
}
