"use client";

import { useState, useTransition } from "react";
import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { MoonStar, NotebookPen, Plus, Sunrise } from "lucide-react";
import { toast } from "sonner";
import { reorderHabitsAction } from "@/app/(app)/sport/habits/actions";
import { announcements, screenReaderInstructions, SortableRow, useEditorSensors, verticalOnly } from "@/components/recipes/editor/sortable";
import { drinkColor } from "@/lib/domain/drinks";
import { countOn, reorderWithin, routineLabel, routineProgress, type CheckIndex, type Habit, type Routine } from "@/lib/domain/habits";
import { cn } from "@/lib/utils";
import { CheckButton, HabitIcon } from "./habit-parts";

/** Farbe und Symbol je Routine (Abhak-Knopf „alle“ und Kopf). */
export const ROUTINE_STYLE: Record<Routine, { color: string; icon: typeof Sunrise }> = {
  morgen: { color: "orange", icon: Sunrise },
  abend: { color: "lila", icon: MoonStar },
};

/**
 * Morgen- oder Abendroutine unter „Heute“: Punkte in eigener Reihenfolge (am Griff ziehen, gespeichert beim Ablegen),
 * jeder einzeln abhakbar wie ein Habit. Der große Knopf im Kopf hakt alle offenen Punkte auf einmal ab (sind alle
 * erledigt, nimmt er alle Häkchen wieder weg). Antippen des Namens bearbeitet.
 */
export function RoutineCard({
  routine,
  items,
  habits,
  index,
  date,
  onSetCount,
  onTap,
  onEdit,
  onAdd,
}: {
  routine: Routine;
  /** an `date` fällige Punkte in gespeicherter Reihenfolge */
  items: Habit[];
  /** alle Habits (für die Gesamtreihenfolge beim Speichern) */
  habits: Habit[];
  index: CheckIndex;
  date: string;
  onSetCount: (h: Habit, count: number) => void;
  onTap: (h: Habit) => void;
  onEdit: (h: Habit) => void;
  onAdd: () => void;
}) {
  const label = routineLabel(routine);
  const style = ROUTINE_STYLE[routine];
  const Icon = style.icon;
  const c = drinkColor(style.color);
  // Reihenfolge lokal (sofort sichtbar), bis der Server dieselbe Reihenfolge liefert oder sich die Punkte ändern
  const serverKey = items.map((h) => h.id).join(",");
  const [local, setLocal] = useState<{ key: string; ids: string[] } | null>(null);
  const ids = local && local.key === serverKey ? local.ids : items.map((h) => h.id);
  const ordered = ids.map((id) => items.find((h) => h.id === id)).filter((h): h is Habit => h != null);
  const sensors = useEditorSensors();
  const [, startTransition] = useTransition();
  const progress = routineProgress(ordered, index, date);

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    setLocal({ key: serverKey, ids: next });
    startTransition(async () => {
      const result = await reorderHabitsAction(reorderWithin(habits, next));
      if (!result.ok) {
        setLocal(null);
        toast.error(result.message);
      }
    });
  }

  function toggleAll() {
    if (progress.complete) {
      for (const h of ordered) onSetCount(h, 0);
      return;
    }
    navigator.vibrate?.(20);
    for (const h of ordered) if (countOn(index, h.id, date) < h.target) onSetCount(h, h.target);
    toast.success(`${label} erledigt`);
  }

  return (
    <section aria-labelledby={`routine-${routine}`} className="overflow-hidden rounded-3xl border" style={{ background: `color-mix(in srgb, ${c} 9%, var(--card))` }}>
      <div className="flex items-center gap-3 p-4 pb-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-card" style={{ color: c }} aria-hidden>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`routine-${routine}`} className="font-heading text-lg leading-tight font-semibold">
            {label}
          </h2>
          <p className="text-sm text-muted-foreground tabular-nums">
            {progress.complete ? "Komplett erledigt" : `${progress.done} von ${progress.total} erledigt`}
          </p>
        </div>
        <CheckButton
          count={progress.done}
          target={progress.total}
          color={style.color}
          onClick={toggleAll}
          label={progress.complete ? `${label}: alle Häkchen entfernen` : `${label}: alle Punkte abhaken (${progress.done} von ${progress.total})`}
        />
      </div>

      <DndContext
        id={`routine-dnd-${routine}`}
        collisionDetection={closestCenter}
        sensors={sensors}
        modifiers={[verticalOnly]}
        onDragEnd={onDragEnd}
        accessibility={{ announcements: announcements((id) => items.find((h) => h.id === id)?.name ?? "Punkt"), screenReaderInstructions }}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className="mx-2 divide-y rounded-2xl border bg-card">
            {ordered.map((h) => {
              const count = countOn(index, h.id, date);
              const detail = [h.dose, h.target > 1 ? `${h.target}× am Tag` : null].filter(Boolean);
              return (
                <SortableRow key={h.id} id={h.id} handleLabel={`${h.name} verschieben`} className="first:rounded-t-2xl last:rounded-b-2xl">
                  <div className="flex min-w-0 flex-1 items-center gap-3 py-2 pr-3">
                    <button type="button" onClick={() => onEdit(h)} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left" aria-label={`${h.name} bearbeiten`}>
                      <HabitIcon kind={h.kind} color={h.color} className="size-9 rounded-xl" />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate font-medium", count >= h.target && "text-muted-foreground line-through decoration-1")}>{h.name}</span>
                        {detail.length ? <span className="block truncate text-sm text-muted-foreground tabular-nums">{detail.join(" · ")}</span> : null}
                        {h.notes ? (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <NotebookPen className="size-3 shrink-0" aria-hidden />
                            <span className="truncate">{h.notes}</span>
                          </span>
                        ) : null}
                      </span>
                    </button>
                    <CheckButton
                      size="md"
                      count={count}
                      target={h.target}
                      color={h.color}
                      onClick={() => onTap(h)}
                      label={h.target > 1 ? `${h.name}: ${count} von ${h.target}, antippen zählt hoch` : `${h.name} ${count > 0 ? "nicht mehr abhaken" : "abhaken"}`}
                    />
                  </div>
                </SortableRow>
              );
            })}
          </ul>
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={onAdd}
        className="flex min-h-12 w-full items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Plus className="size-4" aria-hidden />
        Punkt hinzufügen
      </button>
    </section>
  );
}
