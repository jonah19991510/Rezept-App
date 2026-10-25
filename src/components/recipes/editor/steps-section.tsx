"use client";

import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Clock, Plus } from "lucide-react";
import { parseDecimal } from "@/lib/domain/decimal";
import { ingredientChipText, moveItem, stepTimerChip } from "@/lib/domain/recipe-editor";
import { cn } from "@/lib/utils";
import { StepNumber } from "./editor-parts";
import { parseDndId, stepId, type FieldErrors, type Line, type Step } from "./editor-model";
import { announcements, screenReaderInstructions, SortableRow, useEditorSensors, verticalOnly } from "./sortable";

/** Sekunden des eigenen Timers aus dem Minutenfeld; null, wenn leer oder ungültig. */
export function customTimerSeconds(step: Pick<Step, "timerMode" | "timerMinutes">): number | null {
  if (step.timerMode !== "custom") return null;
  const minutes = parseDecimal(step.timerMinutes);
  return minutes != null && minutes > 0 ? Math.round(minutes * 60) : null;
}

/** Abschnitt „Zubereitung“: kompakte Schritte, Drag & Drop am Griff, Antippen öffnet das Schritt-Sheet. */
export function StepsSection({
  steps,
  lines,
  totalTime,
  errors,
  onOpen,
  onAdd,
  onStepsChange,
}: {
  steps: Step[];
  lines: Line[];
  /** Gesamtzeit für den Chip im Kopf, z. B. „3 Std. 30 Min.“ */
  totalTime: string | null;
  errors: FieldErrors;
  onOpen: (key: number) => void;
  onAdd: () => void;
  onStepsChange: (update: (prev: Step[]) => Step[]) => void;
}) {
  const sensors = useEditorSensors();
  const numberOf = (id: string | number) => {
    const parsed = parseDndId(id);
    const index = parsed?.kind === "step" ? steps.findIndex((s) => s.key === parsed.key) : -1;
    return index >= 0 ? `Schritt ${index + 1}` : "Schritt";
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    onStepsChange((prev) =>
      moveItem(
        prev,
        prev.findIndex((s) => stepId(s.key) === active.id),
        prev.findIndex((s) => stepId(s.key) === over.id),
      ),
    );
  }

  return (
    <section className="grid grid-cols-1 gap-4" aria-labelledby="sec-schritte">
      <div className="flex items-center justify-between gap-3">
        <h2 id="sec-schritte" className="flex items-baseline gap-2 text-[1.75rem] leading-tight font-semibold">
          Zubereitung
          <span className="font-sans text-sm font-normal text-muted-foreground tabular-nums">{steps.length}</span>
        </h2>
        {totalTime ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm text-muted-foreground">
            <Clock className="size-3.5" aria-hidden />
            <span className="sr-only">Gesamtzeit</span>
            {totalTime}
          </span>
        ) : null}
      </div>

      {steps.length > 0 ? (
        <div className="rounded-3xl border bg-card">
          <DndContext
            id="dnd-schritte"
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[verticalOnly]}
            onDragEnd={onDragEnd}
            accessibility={{ announcements: announcements(numberOf), screenReaderInstructions }}
          >
            <SortableContext items={steps.map((s) => stepId(s.key))} strategy={verticalListSortingStrategy}>
              <ol className="divide-y" aria-label="Schritte">
                {steps.map((step, index) => {
                  const names = lines.filter((l) => l.stepKey === step.key).map((l) => l.ingredient.name);
                  const timer = stepTimerChip(step.text, step.timerMode, customTimerSeconds(step));
                  const error = errors[`steps.${index}.text`]?.[0] ?? (errors[`steps.${index}.timer_seconds`] ? "Timer bitte in Minuten (höchstens 24 Std.)" : undefined);
                  return (
                    <SortableRow key={step.key} id={stepId(step.key)} handleLabel={`Schritt ${index + 1} verschieben`}>
                      <button
                        type="button"
                        onClick={() => onOpen(step.key)}
                        className="flex min-h-16 min-w-0 flex-1 items-start gap-3 py-3.5 pr-4 text-left transition hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        <StepNumber n={index + 1} />
                        <span className="min-w-0 flex-1">
                          <span className="sr-only">Schritt {index + 1}: </span>
                          <span className={cn("line-clamp-10 text-[0.9375rem] leading-snug whitespace-pre-line", !step.text.trim() && "text-muted-foreground italic")}>
                            {step.text.trim() || "Leerer Schritt – antippen zum Schreiben"}
                          </span>
                          {error ? <span className="mt-1 block text-sm text-destructive">{error}</span> : null}
                          {timer || names.length > 0 ? (
                            <span className="mt-2 flex flex-wrap gap-1.5">
                              {timer ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                                  <Clock className="size-3" aria-hidden />
                                  <span className="sr-only">Timer </span>
                                  {timer}
                                </span>
                              ) : null}
                              {names.length > 0 ? (
                                <span className="inline-flex max-w-full items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                  <span className="sr-only">Zutaten: </span>
                                  <span className="truncate">{ingredientChipText(names)}</span>
                                </span>
                              ) : null}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </SortableRow>
                  );
                })}
              </ol>
            </SortableContext>
          </DndContext>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onAdd}
        className="flex min-h-14 items-center justify-center gap-2 rounded-3xl border border-dashed font-semibold text-primary transition hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Plus className="size-4" aria-hidden />
        Schritt hinzufügen
      </button>
      {steps.length > 0 ? (
        <p className="-mt-2 px-1 text-center text-xs text-muted-foreground">Antippen zum Bearbeiten · Zeiten im Text werden zu Timern</p>
      ) : null}
    </section>
  );
}
