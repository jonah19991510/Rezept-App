// Trainings posten (Sport & Gesundheit, 03.11.2026): Zusammenfassung eines Trainings für den Feed, Bestwerte in
// Klartext, Zeitangaben, „Nachmachen“ als Plan. Reine Logik ohne Datenbank.

import { formatNumber } from "@/lib/format";
import { isTimed, type MuscleGroup, type Tracking } from "./exercises";
import { formatSet, mmss, workoutDuration } from "./workout";
import { estimate1RM, recentRecords, workoutKind, workoutSets, workoutVolume, type RecentRecord, type StatsSet, type StatsWorkout, type TrainingKind } from "./workout-stats";
import { addDays } from "./week";

export type PostExercise = {
  exerciseId: string;
  name: string;
  muscleGroup: MuscleGroup;
  tracking: Tracking;
  /** erledigte Arbeitssätze */
  sets: number;
  warmup: boolean;
  repsMin: number | null;
  repsMax: number | null;
  /** längster Satz in Sekunden (Zeit-Übungen) */
  seconds: number | null;
  /** bester Satz als Text, z. B. „80 kg × 5“ */
  best: string;
};

export type PostRecord = { exerciseId: string; name: string; kind: RecentRecord["kind"]; value: number; previous: number };

/** Feste Zusammenfassung eines geteilten Trainings (wird beim Teilen gespeichert). */
export type PostSummary = {
  v: 1;
  title: string;
  durationSeconds: number;
  kind: TrainingKind;
  sets: number;
  volumeKg: number;
  distanceM: number;
  exercises: PostExercise[];
  records: PostRecord[];
};

const normal = (sets: StatsSet[]) => sets.filter((s) => s.kind === "normal");

/** Bester Satz: höchstes geschätztes 1RM bzw. Gewicht, sonst meiste Wdh., längste Zeit bzw. Strecke. */
function bestSet(sets: StatsSet[], tracking: Tracking): StatsSet | null {
  if (!sets.length) return null;
  const score = (s: StatsSet) =>
    tracking === "time"
      ? (s.seconds ?? 0)
      : tracking === "distance_time"
        ? (s.distanceM ?? 0) * 1000 + (s.seconds ?? 0)
        : (estimate1RM(s.weightKg, s.reps) ?? s.weightKg ?? 0) * 1000 + (s.reps ?? 0);
  return sets.reduce((a, b) => (score(b) > score(a) ? b : a));
}

/**
 * Zusammenfassung eines beendeten Trainings: Dauer, Art (Kraft/Ausdauer), Sätze, Volumen, Strecke, je Übung Sätze und
 * bester Satz, dazu neue Bestwerte gegenüber allen früheren Trainings (`history` = alle beendeten Trainings).
 */
export function buildPostSummary(workout: StatsWorkout, history: StatsWorkout[]): PostSummary {
  const exercises: PostExercise[] = [];
  let distanceM = 0;
  for (const e of workout.exercises) {
    const sets = normal(e.sets);
    if (!sets.length) continue;
    const best = bestSet(sets, e.tracking);
    const reps = sets.map((s) => s.reps).filter((r): r is number => r != null && r > 0);
    for (const s of sets) distanceM += s.distanceM ?? 0;
    exercises.push({
      exerciseId: e.exerciseId,
      name: e.name,
      muscleGroup: e.muscleGroup,
      tracking: e.tracking,
      sets: sets.length,
      warmup: e.sets.some((s) => s.kind === "warmup"),
      repsMin: isTimed(e.tracking) || !reps.length ? null : Math.min(...reps),
      repsMax: isTimed(e.tracking) || !reps.length ? null : Math.max(...reps),
      seconds: e.tracking === "time" ? Math.max(0, ...sets.map((s) => s.seconds ?? 0)) || null : null,
      best: best ? formatSet(best, e.tracking) : "–",
    });
  }
  const records = recentRecords(history, Number.MAX_SAFE_INTEGER)
    .filter((r) => r.workoutId === workout.id)
    .map(({ exerciseId, name, kind, value, previous }) => ({ exerciseId, name, kind, value, previous }));
  return {
    v: 1,
    title: workout.title,
    durationSeconds: workout.durationSeconds,
    kind: workoutKind(workout),
    sets: workoutSets(workout),
    volumeKg: Math.round(workoutVolume(workout)),
    distanceM: Math.round(distanceM),
    exercises,
    records,
  };
}

/** Gespeicherte Zusammenfassung lesen; Unbekanntes wird zu einer leeren Zusammenfassung. */
export function parsePostSummary(raw: unknown): PostSummary {
  const s = (typeof raw === "object" && raw !== null ? raw : {}) as Partial<PostSummary>;
  return {
    v: 1,
    title: typeof s.title === "string" ? s.title : "Training",
    durationSeconds: Number(s.durationSeconds) || 0,
    kind: s.kind === "cardio" || s.kind === "both" ? s.kind : "strength",
    sets: Number(s.sets) || 0,
    volumeKg: Number(s.volumeKg) || 0,
    distanceM: Number(s.distanceM) || 0,
    exercises: Array.isArray(s.exercises) ? s.exercises : [],
    records: Array.isArray(s.records) ? s.records : [],
  };
}

/** Kennzahlen für die Karte: Dauer, dann Volumen/Strecke und Sätze (nur was es gibt). */
export function summaryStats(s: PostSummary): { label: string; value: string }[] {
  const stats = [{ label: "Dauer", value: workoutDuration(s.durationSeconds) }];
  if (s.volumeKg > 0) stats.push({ label: "Volumen", value: `${formatNumber(s.volumeKg, 0)} kg` });
  if (s.distanceM > 0) stats.push({ label: "Strecke", value: `${formatNumber(s.distanceM / 1000, 2)} km` });
  if (s.sets > 0) stats.push({ label: "Sätze", value: String(s.sets) });
  return stats;
}

/** „Bankdrücken: geschätztes 1RM 92,5 kg (vorher 90 kg)“ */
export function recordLabel(r: PostRecord): string {
  const fmt = (v: number) =>
    r.kind === "time" ? mmss(v) : r.kind === "distance" ? `${formatNumber(v / 1000, 2)} km` : r.kind === "reps" ? `${v} Wdh.` : `${formatNumber(v, 1)} kg`;
  const what = r.kind === "1rm" ? "geschätztes 1RM " : r.kind === "reps" ? "" : r.kind === "time" ? "längste Zeit " : r.kind === "distance" ? "weiteste Strecke " : "";
  return `${r.name}: ${what}${fmt(r.value)} (vorher ${fmt(r.previous)})`;
}

const timeFmt = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
const dateFmt = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "numeric", timeZone: "Europe/Berlin" });

/** „Heute, 18:30“, „Gestern, 7:15“, „Mo., 2.11., 18:30“ (`day` = Kalendertag des Zeitpunkts in deutscher Zeit). */
export function whenLabel(iso: string, day: string, today: string): string {
  const time = timeFmt.format(new Date(iso));
  if (day === today) return `Heute, ${time}`;
  if (day === addDays(today, -1)) return `Gestern, ${time}`;
  return `${dateFmt.format(new Date(iso))}, ${time}`;
}

/** „Anna gefällt das“, „Anna und Ben“, „Anna, Ben und 3 weitere“ */
export function kudosLabel(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} und ${names[1]}`;
  return `${names[0]}, ${names[1]} und ${names.length - 2} ${names.length - 2 === 1 ? "weitere Person" : "weitere"}`;
}

/** „Nachmachen“: ein Trainingstag mit den Übungen des Posts (Sätze, Wdh.-Bereich, Zeit, Aufwärmsätze). */
export function planDayFromPost(s: PostSummary) {
  return s.exercises.slice(0, 40).map((e) => ({
    exercise_id: e.exerciseId,
    sets: Math.min(20, Math.max(1, e.sets)),
    reps_min: e.repsMin != null ? Math.min(100, e.repsMin) : null,
    reps_max: e.repsMax != null ? Math.min(100, e.repsMax) : null,
    target_seconds: e.seconds != null ? Math.min(36000, e.seconds) : null,
    rest_seconds: null,
    warmup: e.warmup,
    note: "",
  }));
}
