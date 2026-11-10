import { isTimed, MUSCLE_ORDER, type ExerciseCategory, type MuscleGroup, type Tracking } from "./exercises";
import { addDays, daysBetween, mondayOf } from "./week";

// Sport & Gesundheit, Phase S3: Statistik aus den beendeten Trainings.

export type StatsSet = { kind: "warmup" | "normal"; weightKg: number | null; reps: number | null; seconds: number | null; distanceM: number | null; speedKmh?: number | null; avgHeartRate?: number | null };

export type StatsWorkout = {
  id: string;
  title: string;
  /** Tag in deutscher Zeit (JJJJ-MM-TT) */
  date: string;
  durationSeconds: number;
  exercises: {
    exerciseId: string;
    name: string;
    muscleGroup: MuscleGroup;
    secondaryMuscles: MuscleGroup[];
    tracking: Tracking;
    category: ExerciseCategory;
    /** nur erledigte Sätze */
    sets: StatsSet[];
  }[];
};

/** Kraft, Ausdauer oder beides (Kalender der Trainingstage). */
export type TrainingKind = "strength" | "cardio" | "both";

/** Tag im Kalender: count null = Zukunft; kind null = kein Training. */
export type CalendarDay = { date: string; count: number | null; kind: TrainingKind | null };

/** Ausdauer: Muskelgruppe „Ausdauer“ oder mit Strecke und Zeit erfasst (Laufband & Co.). */
export function isCardioExercise(e: { muscleGroup: MuscleGroup; tracking: Tracking }): boolean {
  return e.muscleGroup === "cardio" || e.tracking === "distance_time";
}

/** Art eines Trainings nach seinen Übungen mit erledigten Sätzen; ohne solche zählt es als Kraft. */
export function workoutKind(w: StatsWorkout): TrainingKind {
  const done = w.exercises.filter((e) => e.sets.length > 0);
  const cardio = done.some(isCardioExercise);
  const strength = done.length === 0 || done.some((e) => !isCardioExercise(e));
  return cardio && strength ? "both" : cardio ? "cardio" : "strength";
}

/** „woche“ = eine Kalenderwoche (Mo–So), die man durchblättern kann; die anderen enden heute. */
export type StatsRange = "woche" | "4w" | "3m" | "1j" | "alle";

export const RANGE_LABELS: Record<StatsRange, string> = { woche: "Woche", "4w": "4 Wochen", "3m": "3 Monate", "1j": "1 Jahr", alle: "Alles" };

/** Erster Tag des Zeitraums (inklusive); bei „Alles“ null. Bei „Woche“ der Montag der gewählten Woche. */
export function rangeStart(range: StatsRange, today: string, weekMonday: string = mondayOf(today)): string | null {
  if (range === "alle") return null;
  if (range === "woche") return weekMonday;
  return addDays(today, range === "4w" ? -27 : range === "3m" ? -90 : -364);
}

/** Letzter Tag des Zeitraums (inklusive); nur bei „Woche“ (Sonntag), sonst null (bis heute). */
export function rangeEnd(range: StatsRange, weekMonday: string): string | null {
  return range === "woche" ? addDays(weekMonday, 6) : null;
}

export function inRange(workouts: StatsWorkout[], from: string | null, to: string | null = null): StatsWorkout[] {
  return workouts.filter((w) => (!from || w.date >= from) && (!to || w.date <= to));
}

/**
 * Geschätztes Maximalgewicht für 1 Wiederholung (Epley: Gewicht × (1 + Wdh./30)). Nur bis 12 Wiederholungen, darüber
 * wird die Schätzung unzuverlässig; 1 Wiederholung ist das Gewicht selbst.
 */
export function estimate1RM(weightKg: number | null, reps: number | null): number | null {
  if (weightKg == null || reps == null || weightKg <= 0 || reps < 1 || reps > 12) return null;
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

const normalSets = (sets: StatsSet[]) => sets.filter((s) => s.kind === "normal");

/** Bewegtes Gewicht eines Satzes (kg × Wdh.), nur mit Gewicht und Wiederholungen. */
function setVolume(s: StatsSet): number {
  return s.weightKg != null && s.reps != null ? s.weightKg * s.reps : 0;
}

export function workoutVolume(w: StatsWorkout): number {
  return w.exercises.reduce((sum, e) => sum + (isTimed(e.tracking) ? 0 : normalSets(e.sets).reduce((s, x) => s + setVolume(x), 0)), 0);
}

export function workoutSets(w: StatsWorkout): number {
  return w.exercises.reduce((sum, e) => sum + normalSets(e.sets).length, 0);
}

/** Alle Montage von `from` bis `to` (beide auf ihren Montag gelegt). */
export function mondaysBetween(from: string, to: string): string[] {
  const result: string[] = [];
  for (let m = mondayOf(from); m <= mondayOf(to); m = addDays(m, 7)) result.push(m);
  return result;
}

export type WeekStats = { monday: string; workouts: number; minutes: number; volumeKg: number; sets: number };

/** Je Woche: Trainings, Minuten, Volumen und Arbeitssätze. */
export function weeklyStats(workouts: StatsWorkout[], mondays: string[]): WeekStats[] {
  const byMonday = new Map(mondays.map((m) => [m, { monday: m, workouts: 0, minutes: 0, volumeKg: 0, sets: 0 }]));
  for (const w of workouts) {
    const week = byMonday.get(mondayOf(w.date));
    if (!week) continue;
    week.workouts++;
    week.minutes += Math.round(w.durationSeconds / 60);
    week.volumeKg += workoutVolume(w);
    week.sets += workoutSets(w);
  }
  return [...byMonday.values()];
}

/** Übungen mit Daten, am häufigsten trainierte zuerst (für die Auswahl). */
export type ExerciseOptionStats = {
  id: string;
  name: string;
  tracking: Tracking;
  category: ExerciseCategory;
  muscleGroup: MuscleGroup;
  cardio: boolean;
  sessions: number;
};

export function exerciseOptions(workouts: StatsWorkout[]): ExerciseOptionStats[] {
  const map = new Map<string, ExerciseOptionStats>();
  for (const w of workouts) {
    for (const e of w.exercises) {
      if (normalSets(e.sets).length === 0) continue;
      const entry = map.get(e.exerciseId) ?? {
        id: e.exerciseId,
        name: e.name,
        tracking: e.tracking,
        category: e.category,
        muscleGroup: e.muscleGroup,
        cardio: isCardioExercise(e),
        sessions: 0,
      };
      entry.sessions++;
      map.set(e.exerciseId, entry);
    }
  }
  return [...map.values()].sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name, "de"));
}

export type ExerciseSession = {
  workoutId: string;
  date: string;
  /** schwerster Satz */
  bestWeightKg: number | null;
  /** Wdh. beim schwersten Satz */
  bestWeightReps: number | null;
  best1RM: number | null;
  volumeKg: number;
  maxReps: number | null;
  maxSeconds: number | null;
  maxDistanceM: number | null;
  /** Ausdauer: Strecke und Zeit aller Sätze zusammen */
  totalDistanceM: number | null;
  totalSeconds: number | null;
  /** Ausdauer: Ø Tempo (Strecke ÷ Zeit der Sätze mit beidem, sonst die eingetragene Geschwindigkeit) */
  speedKmh: number | null;
  /** Ausdauer: Ø Herzfrequenz der Sätze, die eine haben */
  avgHeartRate: number | null;
  sets: number;
};

/**
 * Ø Tempo in km/h: Strecke ÷ Zeit über alle Sätze, die beides haben; ohne solche Sätze der Mittelwert der eingetragenen
 * Geschwindigkeiten.
 */
export function averageSpeed(sets: StatsSet[]): number | null {
  const both = sets.filter((s) => s.distanceM != null && s.seconds);
  if (both.length) {
    const meters = both.reduce((sum, s) => sum + s.distanceM!, 0);
    const seconds = both.reduce((sum, s) => sum + s.seconds!, 0);
    return Math.round((meters / 1000 / (seconds / 3600)) * 10) / 10;
  }
  const speeds = sets.map((s) => s.speedKmh).filter((v): v is number => v != null && v > 0);
  return speeds.length ? Math.round((speeds.reduce((a, b) => a + b, 0) / speeds.length) * 10) / 10 : null;
}

/** Ø Herzfrequenz in bpm über die Sätze mit Angabe; haben alle eine Zeit, zählen längere Sätze entsprechend mehr. */
export function averageHeartRate(sets: StatsSet[]): number | null {
  const rated = sets.filter((s) => s.avgHeartRate != null);
  if (!rated.length) return null;
  const timed = rated.every((s) => s.seconds);
  const weight = (s: StatsSet) => (timed ? s.seconds! : 1);
  const total = rated.reduce((sum, s) => sum + weight(s), 0);
  return Math.round(rated.reduce((sum, s) => sum + s.avgHeartRate! * weight(s), 0) / total);
}

/** Ø Herzfrequenz über alle Trainings mit Angabe (jedes Training zählt gleich). */
export function overallHeartRate(sessions: ExerciseSession[]): number | null {
  const rates = sessions.map((s) => s.avgHeartRate).filter((v): v is number => v != null);
  return rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null;
}

/** Verlauf einer Übung: je Training die besten Werte, älteste zuerst. */
export function exerciseProgress(workouts: StatsWorkout[], exerciseId: string): ExerciseSession[] {
  const sessions: ExerciseSession[] = [];
  for (const w of [...workouts].sort((a, b) => a.date.localeCompare(b.date))) {
    const sets = w.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => normalSets(e.sets));
    if (sets.length === 0) continue;
    let heaviest: StatsSet | null = null;
    for (const s of sets) {
      if (s.weightKg == null) continue;
      if (!heaviest || s.weightKg > heaviest.weightKg! || (s.weightKg === heaviest.weightKg && (s.reps ?? 0) > (heaviest.reps ?? 0))) heaviest = s;
    }
    const oneRMs = sets.map((s) => estimate1RM(s.weightKg, s.reps)).filter((v): v is number => v != null);
    const max = (values: (number | null)[]) => {
      const list = values.filter((v): v is number => v != null);
      return list.length ? Math.max(...list) : null;
    };
    const sum = (values: (number | null)[]) => {
      const list = values.filter((v): v is number => v != null);
      return list.length ? list.reduce((a, b) => a + b, 0) : null;
    };
    sessions.push({
      workoutId: w.id,
      date: w.date,
      bestWeightKg: heaviest?.weightKg ?? null,
      bestWeightReps: heaviest?.reps ?? null,
      best1RM: oneRMs.length ? Math.max(...oneRMs) : null,
      volumeKg: sets.reduce((sum, s) => sum + setVolume(s), 0),
      maxReps: max(sets.map((s) => s.reps)),
      maxSeconds: max(sets.map((s) => s.seconds)),
      maxDistanceM: max(sets.map((s) => s.distanceM)),
      totalDistanceM: sum(sets.map((s) => s.distanceM)),
      totalSeconds: sum(sets.map((s) => s.seconds)),
      speedKmh: averageSpeed(sets),
      avgHeartRate: averageHeartRate(sets),
      sets: sets.length,
    });
  }
  return sessions;
}

export type Record_ = { value: number; date: string; workoutId: string; detail?: string };

/** Bestwerte einer Übung über alle Trainings. */
export function exerciseRecords(sessions: ExerciseSession[]) {
  const best = (pick: (s: ExerciseSession) => number | null, detail?: (s: ExerciseSession) => string | undefined): Record_ | null => {
    let result: Record_ | null = null;
    for (const s of sessions) {
      const v = pick(s);
      if (v != null && v > 0 && (!result || v > result.value)) result = { value: v, date: s.date, workoutId: s.workoutId, detail: detail?.(s) };
    }
    return result;
  };
  return {
    weight: best(
      (s) => s.bestWeightKg,
      (s) => (s.bestWeightReps != null ? `× ${s.bestWeightReps}` : undefined),
    ),
    oneRM: best((s) => s.best1RM),
    volume: best((s) => s.volumeKg),
    reps: best((s) => s.maxReps),
    seconds: best((s) => s.maxSeconds),
    distance: best((s) => s.maxDistanceM),
    // Ausdauer: je Training zusammengezählt bzw. Ø Tempo
    totalDistance: best((s) => s.totalDistanceM),
    totalSeconds: best((s) => s.totalSeconds),
    speed: best((s) => s.speedKmh),
  };
}

export type RecentRecord = { date: string; workoutId: string; exerciseId: string; name: string; kind: "1rm" | "weight" | "reps" | "time" | "distance"; value: number; previous: number };

/**
 * Neue Bestwerte (geschätztes 1RM; ohne Gewicht Wiederholungen bzw. Zeit/Strecke) gegenüber allen früheren Trainings.
 * Das erste Training einer Übung zählt nicht als Bestwert, Dehn- und Reha-Übungen nie. Neueste zuerst.
 */
export function recentRecords(workouts: StatsWorkout[], limit = 8): RecentRecord[] {
  const bestSoFar = new Map<string, { kind: RecentRecord["kind"]; value: number }>();
  const records: RecentRecord[] = [];
  for (const w of [...workouts].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const e of w.exercises) {
      const sets = normalSets(e.sets);
      if (sets.length === 0 || e.category !== "training") continue;
      let kind: RecentRecord["kind"];
      let value: number | null;
      if (e.tracking === "time") {
        kind = "time";
        value = Math.max(0, ...sets.map((s) => s.seconds ?? 0)) || null;
      } else if (e.tracking === "distance_time") {
        kind = "distance";
        value = Math.max(0, ...sets.map((s) => s.distanceM ?? 0)) || null;
      } else {
        const oneRMs = sets.map((s) => estimate1RM(s.weightKg, s.reps)).filter((v): v is number => v != null);
        if (oneRMs.length) {
          kind = "1rm";
          value = Math.max(...oneRMs);
        } else {
          kind = "reps";
          value = Math.max(0, ...sets.map((s) => s.reps ?? 0)) || null;
        }
      }
      if (value == null) continue;
      const key = `${e.exerciseId}:${kind}`;
      const previous = bestSoFar.get(key);
      if (previous && value > previous.value) {
        records.push({ date: w.date, workoutId: w.id, exerciseId: e.exerciseId, name: e.name, kind, value, previous: previous.value });
      }
      if (!previous || value > previous.value) bestSoFar.set(key, { kind, value });
    }
  }
  return records.reverse().slice(0, limit);
}

/**
 * Arbeitssätze pro Muskelgruppe und Woche im Zeitraum (Hauptmuskel zählt 1, Nebenmuskeln je ½), sortiert nach Menge.
 * Für Muskelaufbau gelten etwa 10–20 Sätze pro Muskel und Woche als guter Bereich; Dehnen und Reha zählen deshalb nicht.
 */
export function setsPerMuscle(workouts: StatsWorkout[], weeks: number): { muscle: MuscleGroup; perWeek: number; total: number }[] {
  const totals = new Map<MuscleGroup, number>();
  for (const w of workouts) {
    for (const e of w.exercises) {
      const n = normalSets(e.sets).length;
      if (!n || e.category !== "training") continue;
      totals.set(e.muscleGroup, (totals.get(e.muscleGroup) ?? 0) + n);
      for (const m of e.secondaryMuscles) if (m !== e.muscleGroup) totals.set(m, (totals.get(m) ?? 0) + n / 2);
    }
  }
  const divisor = Math.max(1, weeks);
  return [...totals]
    .map(([muscle, total]) => ({ muscle, total, perWeek: Math.round((total / divisor) * 10) / 10 }))
    .sort((a, b) => b.total - a.total || MUSCLE_ORDER.indexOf(a.muscle) - MUSCLE_ORDER.indexOf(b.muscle));
}

/** Wochen am Stück mit mindestens einem Training, gezählt bis zur aktuellen (oder, falls diese noch leer ist, bis zur letzten) Woche. */
export function streakWeeks(workouts: StatsWorkout[], today: string): number {
  const weeks = new Set(workouts.map((w) => mondayOf(w.date)));
  let monday = mondayOf(today);
  if (!weeks.has(monday)) monday = addDays(monday, -7);
  let count = 0;
  while (weeks.has(monday)) {
    count++;
    monday = addDays(monday, -7);
  }
  return count;
}

/** Kalender der letzten Wochen (Montag bis Sonntag je Zeile): je Tag die Zahl der Trainings; Tage nach heute = null. */
export function trainingCalendar(workouts: StatsWorkout[], today: string, weeks = 12): { monday: string; days: CalendarDay[] }[] {
  const byDate = new Map<string, { count: number; strength: boolean; cardio: boolean }>();
  for (const w of workouts) {
    const day = byDate.get(w.date) ?? { count: 0, strength: false, cardio: false };
    const kind = workoutKind(w);
    byDate.set(w.date, { count: day.count + 1, strength: day.strength || kind !== "cardio", cardio: day.cardio || kind !== "strength" });
  }
  const last = mondayOf(today);
  return Array.from({ length: weeks }, (_, i) => {
    const monday = addDays(last, -7 * (weeks - 1 - i));
    return {
      monday,
      days: Array.from({ length: 7 }, (_, d) => {
        const date = addDays(monday, d);
        if (daysBetween(today, date) > 0) return { date, count: null, kind: null };
        const day = byDate.get(date);
        if (!day) return { date, count: 0, kind: null };
        return { date, count: day.count, kind: day.strength && day.cardio ? "both" : day.cardio ? "cardio" : "strength" };
      }),
    };
  });
}

export type StatsTotals = { workouts: number; sets: number; volumeKg: number; minutes: number; avgMinutes: number | null; perWeek: number | null };

/** Kennzahlen des Zeitraums; Trainings pro Woche über die Wochen des Zeitraums. */
export function statsTotals(workouts: StatsWorkout[], weeks: number): StatsTotals {
  const minutes = workouts.reduce((sum, w) => sum + Math.round(w.durationSeconds / 60), 0);
  return {
    workouts: workouts.length,
    sets: workouts.reduce((sum, w) => sum + workoutSets(w), 0),
    volumeKg: workouts.reduce((sum, w) => sum + workoutVolume(w), 0),
    minutes,
    avgMinutes: workouts.length ? Math.round(minutes / workouts.length) : null,
    perWeek: weeks > 0 && workouts.length ? Math.round((workouts.length / weeks) * 10) / 10 : null,
  };
}

/** Wert, an dem die Tendenz einer Übung abgelesen wird (Liste „Alle Übungen“). */
export type TrendMetric = "1rm" | "weight" | "reps" | "seconds" | "distance";

export type ExerciseTrend = { metric: TrendMetric; values: number[]; direction: "up" | "down" | "flat" };

const TREND_CANDIDATES: Record<Tracking, TrendMetric[]> = {
  weight_reps: ["1rm", "weight", "reps", "seconds"],
  bodyweight_reps: ["reps", "seconds"],
  time: ["seconds"],
  distance_time: ["distance", "seconds"],
};

const TREND_PICK: Record<TrendMetric, (s: ExerciseSession) => number | null> = {
  "1rm": (s) => s.best1RM,
  weight: (s) => s.bestWeightKg,
  reps: (s) => s.maxReps,
  // Ausdauer: Zeit aller Sätze zusammen, sonst der längste Satz
  seconds: (s) => s.totalSeconds ?? s.maxSeconds,
  distance: (s) => s.totalDistanceM,
};

/**
 * Tendenz einer Übung über ihre Trainings (älteste zuerst): der erste passende Wert, den mindestens zwei Trainings haben;
 * Richtung aus der Ausgleichsgeraden (über ±3 % vom Mittel über den ganzen Zeitraum = steigend bzw. fallend).
 * Weniger als zwei Trainings: null.
 */
export function exerciseTrend(sessions: ExerciseSession[], tracking: Tracking): ExerciseTrend | null {
  for (const metric of TREND_CANDIDATES[tracking]) {
    const values = sessions.map(TREND_PICK[metric]).filter((v): v is number => v != null && v > 0);
    if (values.length < 2) continue;
    const n = values.length;
    const meanX = (n - 1) / 2;
    const meanY = values.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let den = 0;
    values.forEach((y, x) => {
      num += (x - meanX) * (y - meanY);
      den += (x - meanX) ** 2;
    });
    const change = ((num / den) * (n - 1)) / meanY;
    return { metric, values, direction: change > 0.03 ? "up" : change < -0.03 ? "down" : "flat" };
  }
  return null;
}
