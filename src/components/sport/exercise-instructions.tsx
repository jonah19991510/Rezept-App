import { REHAB_HINT, type ExerciseOption } from "@/lib/domain/exercises";

/** Aufklappbare Anleitung einer Übung (im Plan und im Training); ohne Anleitung nichts. */
export function ExerciseInstructions({ exercise, className }: { exercise: Pick<ExerciseOption, "category" | "instructions">; className?: string }) {
  if (!exercise.instructions) return null;
  return (
    <details className={className}>
      <summary className="cursor-pointer text-sm font-medium text-muted-foreground">Anleitung</summary>
      <p className="mt-1 text-sm">{exercise.instructions}</p>
      {exercise.category === "rehab" ? <p className="mt-1 text-xs text-muted-foreground">{REHAB_HINT}</p> : null}
    </details>
  );
}
