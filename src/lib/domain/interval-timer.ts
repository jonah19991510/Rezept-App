// Intervall-Timer zum Trainingsplan: Einstellungen und Ablauf (reine Logik, ohne Uhr und Ton).

export type IntervalSettings = {
  /** Vorbereitung vor der ersten Runde, in Sekunden (0 = keine) */
  prepare: number;
  /** Belastung je Übung bzw. Runde, in Sekunden */
  work: number;
  /** Pause danach, in Sekunden (0 = keine) */
  rest: number;
  rounds: number;
};

export const DEFAULT_INTERVAL: IntervalSettings = { prepare: 10, work: 40, rest: 20, rounds: 3 };

export const INTERVAL_LIMITS: Record<keyof IntervalSettings, { min: number; max: number }> = {
  prepare: { min: 0, max: 60 },
  work: { min: 5, max: 3600 },
  rest: { min: 0, max: 900 },
  rounds: { min: 1, max: 50 },
};

export const INTERVAL_PRESETS: { label: string; work: number; rest: number; rounds: number }[] = [
  { label: "Tabata 20/10", work: 20, rest: 10, rounds: 8 },
  { label: "HIIT 40/20", work: 40, rest: 20, rounds: 5 },
  { label: "30/30", work: 30, rest: 30, rounds: 10 },
];

/** Übung im Ablauf; `seconds` nur bei Übungen mit fester Zeit im Plan, sonst gilt die allgemeine Belastung. */
export type IntervalExercise = { name: string; seconds: number | null };

export type IntervalPhase = {
  kind: "prepare" | "work" | "rest";
  label: string;
  seconds: number;
  /** Runde (ab 1), zu der die Phase gehört */
  round: number;
  /** Belastung: Position der Übung im Trainingstag (fehlt ohne Übungen) */
  exercise?: number;
};

/** Einstellungen aus dem Gerätespeicher: Unbrauchbares wird zum Standard, alles andere in den erlaubten Bereich. */
export function normalizeSettings(raw: unknown): IntervalSettings {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const read = (key: keyof IntervalSettings) => {
    const value = source[key];
    if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_INTERVAL[key];
    return Math.min(INTERVAL_LIMITS[key].max, Math.max(INTERVAL_LIMITS[key].min, Math.round(value)));
  };
  return { prepare: read("prepare"), work: read("work"), rest: read("rest"), rounds: read("rounds") };
}

/** Ablauf: Vorbereitung, dann je Runde alle Übungen im Wechsel mit der Pause. Nach der letzten Belastung keine Pause. */
export function buildPhases(settings: IntervalSettings, exercises: IntervalExercise[] = []): IntervalPhase[] {
  const steps: IntervalExercise[] = exercises.length ? exercises : [{ name: "Belastung", seconds: null }];
  const phases: IntervalPhase[] = [];
  if (settings.prepare > 0) phases.push({ kind: "prepare", label: "Mach dich bereit", seconds: settings.prepare, round: 1 });
  for (let round = 1; round <= settings.rounds; round++) {
    steps.forEach((step, i) => {
      const seconds = step.seconds && step.seconds > 0 ? step.seconds : settings.work;
      phases.push(exercises.length ? { kind: "work", label: step.name, seconds, round, exercise: i } : { kind: "work", label: step.name, seconds, round });
      const last = round === settings.rounds && i === steps.length - 1;
      if (!last && settings.rest > 0) phases.push({ kind: "rest", label: "Pause", seconds: settings.rest, round });
    });
  }
  return phases;
}

export function totalSeconds(phases: IntervalPhase[]): number {
  return phases.reduce((sum, p) => sum + p.seconds, 0);
}

/** Zeitpunkt im Ablauf (in ms), an dem die Phase beginnt. */
export function phaseStartMs(phases: IntervalPhase[], index: number): number {
  return phases.slice(0, Math.max(0, index)).reduce((sum, p) => sum + p.seconds * 1000, 0);
}

/** Wo steht der Ablauf nach `elapsedMs`? Am Ende bleibt die letzte Phase mit 0 ms stehen. */
export function locate(phases: IntervalPhase[], elapsedMs: number): { index: number; remainingMs: number; done: boolean } {
  let end = 0;
  for (let index = 0; index < phases.length; index++) {
    end += phases[index].seconds * 1000;
    if (elapsedMs < end) return { index, remainingMs: end - Math.max(0, elapsedMs), done: false };
  }
  return { index: Math.max(0, phases.length - 1), remainingMs: 0, done: true };
}

/** „Zurück“: in den ersten Sekunden einer Phase zur vorigen, sonst an den Anfang der aktuellen. */
export function previousTargetMs(phases: IntervalPhase[], elapsedMs: number): number {
  const { index } = locate(phases, elapsedMs);
  const start = phaseStartMs(phases, index);
  return elapsedMs - start < 2000 ? phaseStartMs(phases, index - 1) : start;
}

/** Eine erledigte Belastung fürs Speichern: Übung (Position im Tag, null ohne Übungen) und ihre Sekunden. */
export type CompletedWork = { exercise: number | null; seconds: number };

/** Belastungen, die nach `elapsedMs` vorbei sind (am Ende alle), in ihrer Reihenfolge. */
export function completedWork(phases: IntervalPhase[], elapsedMs: number): CompletedWork[] {
  const result: CompletedWork[] = [];
  let end = 0;
  for (const p of phases) {
    end += p.seconds * 1000;
    if (end > elapsedMs) break;
    if (p.kind === "work") result.push({ exercise: p.exercise ?? null, seconds: p.seconds });
  }
  return result;
}

/** Notiz am gespeicherten Intervall-Training: „Intervall: 3 Runden · 40 s Belastung · 20 s Pause“. */
export function intervalNote(settings: Pick<IntervalSettings, "work" | "rest" | "rounds">, roundsDone = settings.rounds): string {
  const rounds = roundsDone === settings.rounds ? `${settings.rounds === 1 ? "1 Runde" : `${settings.rounds} Runden`}` : `${roundsDone} von ${settings.rounds} Runden`;
  const rest = settings.rest > 0 ? ` · ${durationText(settings.rest)} Pause` : " · ohne Pause";
  return `Intervall: ${rounds} · ${durationText(settings.work)} Belastung${rest}`;
}

/** Gespeichertes Intervall-Training? Erkennbar an der Notiz (es gibt kein eigenes Feld dafür). */
export function isIntervalWorkout(workout: { note: string | null }): boolean {
  return (workout.note ?? "").startsWith("Intervall: ");
}

function durationText(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  return seconds % 60 === 0 ? `${seconds / 60} Min.` : `${clockLabel(seconds)} Min.`;
}

/** Sekunden als „m:ss“. */
export function clockLabel(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
