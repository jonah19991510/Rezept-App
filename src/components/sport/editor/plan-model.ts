import { isTimed, type ExerciseOption } from "@/lib/domain/exercises";
import type { PlanKind } from "@/lib/domain/training-plan";
import type { PlanDetail } from "@/lib/server/sport";
import type { TrainingPlanInput } from "@/lib/validation/training-plan";

// Formular-Modell des Plan-Editors (rein, ohne React): Entwurf ↔ gespeicherter Plan ↔ Eingabe für die Action.

export type DraftExercise = {
  key: string;
  exercise: ExerciseOption;
  sets: number;
  /** Felder als Text, damit man sie leeren kann; leer = keine Angabe */
  repsMin: string;
  repsMax: string;
  targetSeconds: string;
  restSeconds: number | null;
  warmup: boolean;
  note: string;
};

export type DraftDay = { key: string; id: string | null; name: string; focus: string; exercises: DraftExercise[] };

export type DraftPlan = { id: string | null; title: string; description: string; kind: PlanKind; days: DraftDay[] };

/** Fortlaufende Schlüssel ab 1 (gleich auf Server und Client, siehe Rezept-Editor). */
export function keyGenerator(start = 0) {
  let n = start;
  return () => `k${++n}`;
}

/**
 * Neue Übung im Plan mit üblichen Vorgaben: Kraft 3 × 8–12 mit 90 s Pause, Zeit 3 × 45 s, Ausdauer 1 Satz;
 * Dehnen und Reha kürzer: 2 × 30 s oder 2 × 10–15 mit wenig Pause.
 */
export function newDraftExercise(key: string, exercise: ExerciseOption): DraftExercise {
  const base = { key, exercise, warmup: false, note: "", repsMin: "", repsMax: "", targetSeconds: "" };
  if (exercise.tracking === "distance_time") return { ...base, sets: 1, restSeconds: null };
  if (exercise.category !== "training") {
    if (exercise.tracking === "time") return { ...base, sets: 2, targetSeconds: "30", restSeconds: 15 };
    return { ...base, sets: 2, repsMin: "10", repsMax: "15", restSeconds: 30 };
  }
  if (exercise.tracking === "time") return { ...base, sets: 3, targetSeconds: "45", restSeconds: 60 };
  return { ...base, sets: 3, repsMin: "8", repsMax: "12", restSeconds: 90 };
}

/** Übung austauschen: Sätze, Pause und Notiz bleiben; passt die Erfassung nicht, gelten die Vorgaben der neuen. */
export function replaceDraftExercise(draft: DraftExercise, exercise: ExerciseOption): DraftExercise {
  if (isTimed(draft.exercise.tracking) !== isTimed(exercise.tracking)) {
    return { ...newDraftExercise(draft.key, exercise), note: draft.note };
  }
  return { ...draft, exercise, warmup: exercise.tracking === "weight_reps" ? draft.warmup : false };
}

export function emptyPlan(nextKey: () => string): DraftPlan {
  return { id: null, title: "", description: "", kind: "strength", days: [{ key: nextKey(), id: null, name: "Tag A", focus: "", exercises: [] }] };
}

const text = (n: number | null) => (n == null ? "" : String(n));

export function draftFromPlan(plan: PlanDetail, nextKey: () => string): DraftPlan {
  return {
    id: plan.id,
    title: plan.title,
    description: plan.description ?? "",
    kind: plan.kind,
    days: plan.days.map((d) => ({
      key: nextKey(),
      id: d.id,
      name: d.name,
      focus: d.focus ?? "",
      exercises: d.exercises.map((e) => ({
        key: nextKey(),
        exercise: e.exercise,
        sets: e.sets,
        repsMin: text(e.repsMin),
        repsMax: text(e.repsMax),
        targetSeconds: text(e.targetSeconds),
        restSeconds: e.restSeconds,
        warmup: e.warmup,
        note: e.note ?? "",
      })),
    })),
  };
}

/** Dauer (Sekunden als Text) für die Felder Minuten und Sekunden; 0 bleibt leer. */
export function durationParts(value: string): { minutes: string; seconds: string } {
  const total = int(value);
  if (!total) return { minutes: "", seconds: "" };
  return { minutes: total >= 60 ? String(Math.floor(total / 60)) : "", seconds: total % 60 ? String(total % 60) : "" };
}

/** Minuten und Sekunden aus den Feldern → Dauer in Sekunden als Text; nur Ziffern zählen, ohne Dauer leer. */
export function durationFromParts(minutes: string, seconds: string): string {
  const digits = (v: string) => Number(v.replace(/\D/g, "") || 0);
  const total = digits(minutes) * 60 + digits(seconds);
  return total > 0 ? String(total) : "";
}

/** Text → Zahl; leer = null, Unsinn = NaN (meldet dann die Prüfung). */
function int(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  return /^\d+$/.test(v) ? Number(v) : Number.NaN;
}

export function draftToInput(plan: DraftPlan): TrainingPlanInput {
  return {
    id: plan.id,
    title: plan.title,
    description: plan.description,
    kind: plan.kind,
    days: plan.days.map((d) => ({
      id: d.id,
      name: d.name,
      focus: d.focus,
      exercises: d.exercises.map((e) => {
        const timed = isTimed(e.exercise.tracking);
        return {
          exercise_id: e.exercise.id,
          sets: e.sets,
          reps_min: timed ? null : int(e.repsMin),
          reps_max: timed ? null : int(e.repsMax),
          target_seconds: timed ? int(e.targetSeconds) : null,
          rest_seconds: e.restSeconds,
          warmup: e.exercise.tracking === "weight_reps" && e.warmup,
          note: e.note,
        };
      }),
    })),
  };
}

/** Fehler einer Übung aus den Prüf-Meldungen („days.0.exercises.2.reps_max“ → { reps_max: […] }). */
export function exerciseErrors(errors: Record<string, string[]>, dayIndex: number, exerciseIndex: number): Record<string, string[]> {
  const prefix = `days.${dayIndex}.exercises.${exerciseIndex}.`;
  return Object.fromEntries(Object.entries(errors).flatMap(([k, v]) => (k.startsWith(prefix) ? [[k.slice(prefix.length), v]] : [])));
}

/** Fehler eines Tages selbst (Name, Fokus, zu viele Übungen), ohne die seiner Übungen. */
export function dayErrors(errors: Record<string, string[]>, dayIndex: number): Record<string, string[]> {
  const prefix = `days.${dayIndex}.`;
  return Object.fromEntries(
    Object.entries(errors).flatMap(([k, v]) => {
      if (!k.startsWith(prefix)) return [];
      const rest = k.slice(prefix.length);
      return rest.startsWith("exercises.") ? [] : [[rest, v]];
    }),
  );
}
