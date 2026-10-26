import { parseDecimal } from "./decimal";
import { isTimed, type Equipment, type ExerciseOption, type Tracking } from "./exercises";
import { formatNumber } from "@/lib/format";

// Sport & Gesundheit, Phase S2: ein Training im Gym (Stand auf dem Handy, Aufwärmsätze, letzte Werte, Abschluss).

export type SetKind = "warmup" | "normal";

/** Satz im laufenden Training. Eingaben als Text (deutsches Komma), leer = noch nichts eingetragen. */
export type SessionSet = {
  id: string;
  kind: SetKind;
  weight: string;
  reps: string;
  /** Zeit-Übungen: Sekunden; Strecke: Minuten stehen hier als Sekunden */
  seconds: string;
  /** Strecke in km */
  distance: string;
  done: boolean;
  doneAt: string | null;
};

export type SessionExercise = {
  id: string;
  exercise: ExerciseOption;
  repsMin: number | null;
  repsMax: number | null;
  targetSeconds: number | null;
  restSeconds: number | null;
  warmup: boolean;
  note: string;
  sets: SessionSet[];
};

/** Das ganze Training, wie es auf dem Handy liegt. `version` zählt jede Änderung (neuere Stände gewinnen). */
export type Session = {
  id: string;
  planId: string | null;
  planDayId: string | null;
  title: string;
  startedAt: string;
  endedAt: string | null;
  note: string;
  version: number;
  exercises: SessionExercise[];
};

/** Ein Satz vom letzten Mal (für die hellen Vorgaben). */
export type LastSet = { weightKg: number | null; reps: number | null; seconds: number | null; distanceM: number | null };

/** UUID v4, auch ohne sichere Verbindung (crypto.randomUUID gibt es im Heimnetz über http nicht). */
export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // unsicherer Kontext: unten weiter
    }
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function emptySet(kind: SetKind = "normal", id = uuid()): SessionSet {
  return { id, kind, weight: "", reps: "", seconds: "", distance: "", done: false, doneAt: null };
}

// ---------------------------------------------------------------------------
// Aufwärmsätze
// ---------------------------------------------------------------------------

/** Kleinster sinnvoller Gewichtsschritt je Gerät (Scheiben paarweise, Kurzhanteln, Maschinenstufen). */
export const WEIGHT_STEP: Record<Equipment, number> = {
  barbell: 2.5,
  smith_machine: 2.5,
  ez_bar: 2.5,
  dumbbell: 2,
  machine: 5,
  cable: 2.5,
  kettlebell: 4,
  bodyweight: 2.5,
  band: 1,
  other: 2.5,
};

/** Leergewicht der Stange (darunter geht nichts). */
const BAR_KG: Partial<Record<Equipment, number>> = { barbell: 20, ez_bar: 10 };

export function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * Aufwärmsätze zum Arbeitsgewicht: leere Stange × 10 (bei Langhantel/SZ), dann 50 % × 8, 70 % × 5, 85 % × 3,
 * jeweils auf den Gewichtsschritt des Geräts gerundet. Sätze, die nicht leichter als der vorige bzw. das
 * Arbeitsgewicht sind, fallen weg. Bei leichten Gewichten bleiben entsprechend weniger übrig.
 */
export function warmupSets(workingKg: number, equipment: Equipment): { weightKg: number; reps: number }[] {
  const step = WEIGHT_STEP[equipment];
  const bar = BAR_KG[equipment] ?? 0;
  if (!(workingKg > 0) || workingKg - step < Math.max(bar, step)) return [];
  const result: { weightKg: number; reps: number }[] = [];
  if (bar > 0 && workingKg >= bar * 2) result.push({ weightKg: bar, reps: 10 });
  for (const [share, reps] of [
    [0.5, 8],
    [0.7, 5],
    [0.85, 3],
  ] as const) {
    const weightKg = Math.max(bar, roundToStep(workingKg * share, step));
    const previous = result.at(-1)?.weightKg ?? 0;
    if (weightKg > previous && weightKg <= workingKg - step) result.push({ weightKg, reps });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Werte und Anzeige
// ---------------------------------------------------------------------------

const kg = (n: number) => `${formatNumber(n, 2)} kg`;

/** „60 kg × 8“, „× 12“ (Körpergewicht), „+10 kg × 8“, „45 s“, „5 km · 30:00“ */
export function formatSet(set: LastSet, tracking: Tracking): string {
  if (tracking === "time") return set.seconds != null ? mmss(set.seconds) : "–";
  if (tracking === "distance_time") {
    const parts = [set.distanceM != null ? `${formatNumber(set.distanceM / 1000, 2)} km` : null, set.seconds != null ? mmss(set.seconds) : null];
    return parts.filter(Boolean).join(" · ") || "–";
  }
  const reps = set.reps != null ? `× ${set.reps}` : "";
  if (tracking === "bodyweight_reps") return set.weightKg ? `+${kg(set.weightKg)} ${reps}`.trim() : reps || "–";
  return set.weightKg != null ? `${kg(set.weightKg)} ${reps}`.trim() : reps || "–";
}

/** Dauer eines Trainings in ganzen Minuten: „unter 1 Min.“, „23 Min.“, „1 Std. 5 Min.“ */
export function workoutDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return "unter 1 Min.";
  if (minutes < 60) return `${minutes} Min.`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} Std.` : `${h} Std. ${m} Min.`;
}

/** Sekunden als „0:45“, „12:30“, „1:02:00“ */
export function mmss(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Eingabe für Zeiten: „45“ (Sekunden), „1:30“ (Min:Sek), „1:02:00“. */
export function parseClock(input: string): number | null {
  const v = input.trim();
  if (!v) return null;
  if (/^\d+$/.test(v)) return Number(v);
  const parts = v.split(":");
  if (parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  return parts.reduce((total, p) => total * 60 + Number(p), 0);
}

/** Werte eines Satzes als Zahlen; leere Felder nehmen die Vorgabe vom letzten Mal (antippen = übernehmen). */
export function resolveSet(set: SessionSet, last: LastSet | null): LastSet {
  const weight = parseDecimal(set.weight);
  const reps = parseDecimal(set.reps);
  const seconds = parseClock(set.seconds);
  const distance = parseDecimal(set.distance);
  return {
    weightKg: weight ?? (set.weight.trim() === "" ? (last?.weightKg ?? null) : null),
    reps: reps != null ? Math.round(reps) : set.reps.trim() === "" ? (last?.reps ?? null) : null,
    seconds: seconds ?? (set.seconds.trim() === "" ? (last?.seconds ?? null) : null),
    distanceM: distance != null ? distance * 1000 : set.distance.trim() === "" ? (last?.distanceM ?? null) : null,
  };
}

/** Werte als Eingabetext (für das Ausfüllen beim Abhaken). */
export function setInputs(values: LastSet): Pick<SessionSet, "weight" | "reps" | "seconds" | "distance"> {
  return {
    weight: values.weightKg != null ? formatNumber(values.weightKg, 2).replace(/\./g, "") : "",
    reps: values.reps != null ? String(values.reps) : "",
    seconds: values.seconds != null ? (values.seconds >= 60 ? mmss(values.seconds) : String(values.seconds)) : "",
    distance: values.distanceM != null ? formatNumber(values.distanceM / 1000, 2).replace(/\./g, "") : "",
  };
}

/** Hat der Satz überhaupt einen Wert, den man speichern kann? */
export function setHasValues(values: LastSet, tracking: Tracking): boolean {
  if (tracking === "time") return values.seconds != null;
  if (tracking === "distance_time") return values.seconds != null || values.distanceM != null;
  return values.reps != null;
}

// ---------------------------------------------------------------------------
// Rotation, Abschluss, Zusammenfassung
// ---------------------------------------------------------------------------

/** Nächster Trainingstag: der nach dem zuletzt trainierten (am Ende wieder von vorne), sonst der erste. */
export function nextPlanDay<D extends { id: string }>(days: D[], lastDayId: string | null): D | null {
  if (days.length === 0) return null;
  const index = lastDayId ? days.findIndex((d) => d.id === lastDayId) : -1;
  return index < 0 ? days[0] : days[(index + 1) % days.length];
}

/**
 * Training abschließen: nicht erledigte Sätze fallen weg, ebenso Übungen ohne erledigten Satz. Erledigte Sätze mit
 * leeren Feldern bekommen die Werte vom letzten Mal (wie angezeigt).
 */
export function finalizeSession(session: Session, endedAt: string, last: Record<string, LastSet[]>): Session {
  return {
    ...session,
    endedAt,
    version: session.version + 1,
    exercises: session.exercises
      .map((e) => {
        let normalIndex = 0;
        const sets = e.sets.flatMap((s) => {
          const lastSet = s.kind === "normal" ? (last[e.exercise.id]?.[normalIndex] ?? null) : null;
          if (s.kind === "normal") normalIndex++;
          if (!s.done) return [];
          return [{ ...s, ...setInputs(resolveSet(s, lastSet)) }];
        });
        return { ...e, sets };
      })
      .filter((e) => e.sets.length > 0),
  };
}

export type SessionSummary = { exercises: number; sets: number; volumeKg: number; durationSeconds: number };

/** Erledigte Arbeitssätze, bewegtes Gewicht (kg × Wdh.) und Dauer. */
export function summarizeSession(session: Session, now: Date): SessionSummary {
  let sets = 0;
  let volumeKg = 0;
  let exercises = 0;
  for (const e of session.exercises) {
    const done = e.sets.filter((s) => s.done && s.kind === "normal");
    if (done.length) exercises++;
    sets += done.length;
    for (const s of done) {
      const w = parseDecimal(s.weight);
      const r = parseDecimal(s.reps);
      if (w != null && r != null && !isTimed(e.exercise.tracking)) volumeKg += w * r;
    }
  }
  const end = session.endedAt ? new Date(session.endedAt) : now;
  const durationSeconds = Math.max(0, Math.round((end.getTime() - new Date(session.startedAt).getTime()) / 1000));
  return { exercises, sets, volumeKg, durationSeconds };
}

/** Stand für sync_workout (Zahlen statt Text, Strecke in Metern, Minuten:Sekunden als Sekunden). */
export function toSyncPayload(session: Session) {
  return {
    id: session.id,
    plan_id: session.planId,
    plan_day_id: session.planDayId,
    title: session.title,
    started_at: session.startedAt,
    ended_at: session.endedAt,
    note: session.note,
    version: session.version,
    exercises: session.exercises.map((e) => ({
      id: e.id,
      exercise_id: e.exercise.id,
      reps_min: e.repsMin,
      reps_max: e.repsMax,
      target_seconds: e.targetSeconds,
      rest_seconds: e.restSeconds,
      warmup: e.warmup,
      note: e.note,
      sets: e.sets.map((s) => {
        const weight = parseDecimal(s.weight);
        const reps = parseDecimal(s.reps);
        const distance = parseDecimal(s.distance);
        return {
          id: s.id,
          kind: s.kind,
          weight_kg: weight != null && weight >= 0 && weight <= 1000 ? Math.round(weight * 100) / 100 : null,
          reps: reps != null && reps >= 0 && reps <= 1000 ? Math.round(reps) : null,
          seconds: (() => {
            const v = parseClock(s.seconds);
            return v != null && v <= 86400 ? v : null;
          })(),
          distance_m: distance != null && distance >= 0 && distance <= 1000 ? Math.round(distance * 10000) / 10 : null,
          done: s.done,
          done_at: s.doneAt,
        };
      }),
    })),
  };
}

export type WorkoutPayload = ReturnType<typeof toSyncPayload>;

// ---------------------------------------------------------------------------
// Training → Plan
// ---------------------------------------------------------------------------

export type PlanDayExercise = {
  exerciseId: string;
  sets: number;
  repsMin: number | null;
  repsMax: number | null;
  targetSeconds: number | null;
  restSeconds: number | null;
  warmup: boolean;
  note: string | null;
};

/**
 * Übungen eines Plan-Tages nach einem Training: Reihenfolge und Auswahl wie im Training, Sätze = Arbeitssätze im
 * Training. Vorgaben (Wdh., Pause, Notiz) bleiben aus dem Plan, neue Übungen nehmen die aus dem Training.
 */
export function planDayFromWorkout(
  plan: PlanDayExercise[],
  workout: { exerciseId: string; normalSets: number; repsMin: number | null; repsMax: number | null; targetSeconds: number | null; restSeconds: number | null; warmup: boolean; note: string | null }[],
): PlanDayExercise[] {
  const remaining = [...plan];
  return workout.map((w) => {
    const index = remaining.findIndex((p) => p.exerciseId === w.exerciseId);
    const existing = index >= 0 ? remaining.splice(index, 1)[0] : null;
    const base = existing ?? { ...w, note: w.note };
    return { ...base, exerciseId: w.exerciseId, sets: Math.min(20, Math.max(1, w.normalSets)) };
  });
}

/** Weicht das Training vom Plan-Tag ab (andere Übungen, Reihenfolge oder Satzzahl)? */
export function differsFromPlan(plan: PlanDayExercise[], next: PlanDayExercise[]): boolean {
  if (plan.length !== next.length) return true;
  return plan.some((p, i) => p.exerciseId !== next[i].exerciseId || p.sets !== next[i].sets);
}

// ---------------------------------------------------------------------------
// Nachtragen und Bearbeiten beendeter Trainings
// ---------------------------------------------------------------------------

const BERLIN = "Europe/Berlin";

/** Datum und Uhrzeit in deutscher Zeit („2026-10-26“, „18:30“) eines Zeitpunkts. */
export function berlinParts(iso: string): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: BERLIN, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/** Datum und Uhrzeit in deutscher Zeit → Zeitpunkt (ISO, UTC); Sommer- und Winterzeit richtig. Ungültig: null. */
export function berlinToIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const guess = new Date(`${date}T${time}:00Z`);
  if (Number.isNaN(guess.getTime())) return null;
  // Abstand zwischen UTC und deutscher Zeit zu diesem Zeitpunkt (zweimal, falls die Umstellung dazwischen liegt)
  let result = guess.getTime();
  for (let i = 0; i < 2; i++) {
    const shown = berlinParts(new Date(result).toISOString());
    const shownMs = new Date(`${shown.date}T${shown.time}:00Z`).getTime();
    result -= shownMs - guess.getTime();
  }
  return new Date(result).toISOString();
}

/**
 * Nachgetragenes oder bearbeitetes Training speichern: Sätze zählen, wenn sie abgehakt sind oder Werte eingetragen
 * haben (beim Nachtragen muss man nicht jeden Satz abhaken); leere Felder abgehakter Sätze bekommen die Werte vom
 * letzten Mal. Übungen ohne Satz fallen weg.
 */
export function finalizeEditedSession(session: Session, last: Record<string, LastSet[]>): Session {
  const entered = (s: SessionSet) => [s.weight, s.reps, s.seconds, s.distance].some((v) => v.trim() !== "");
  return {
    ...session,
    exercises: session.exercises
      .map((e) => {
        let normalIndex = 0;
        const sets = e.sets.flatMap((s) => {
          const lastSet = s.kind === "normal" ? (last[e.exercise.id]?.[normalIndex] ?? last[e.exercise.id]?.at(-1) ?? null) : null;
          if (s.kind === "normal") normalIndex++;
          if (!s.done && !entered(s)) return [];
          const values = resolveSet(s, s.done ? lastSet : null);
          if (!setHasValues(values, e.exercise.tracking)) return [];
          return [{ ...s, ...setInputs(values), done: true, doneAt: s.doneAt ?? session.endedAt }];
        });
        return { ...e, sets };
      })
      .filter((e) => e.sets.length > 0),
  };
}
