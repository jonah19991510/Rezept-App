"use client";

import { useState, useTransition } from "react";
import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CloudSun, Moon, MoonStar, NotebookPen, Pencil, Plus, Sun, Sunrise } from "lucide-react";
import { toast } from "sonner";
import { reorderRoutineAction } from "@/app/(app)/sport/habits/actions";
import { announcements, screenReaderInstructions, SortableRow, useEditorSensors, verticalOnly } from "@/components/recipes/editor/sortable";
import { drinkColor } from "@/lib/domain/drinks";
import {
  countOn,
  routineProgress,
  routinesDone,
  setRoutineItem,
  type CheckIndex,
  type Daytime,
  type Habit,
  type HabitRoutine,
  type RoutineCheckIndex,
  type RoutineDayUpdate,
} from "@/lib/domain/habits";
import { cn } from "@/lib/utils";
import { CheckButton, HabitIcon } from "./habit-parts";

/** Symbol einer Routine nach ihrer Tageszeit. */
export const ROUTINE_ICONS: Record<Daytime, typeof Sunrise> = {
  morgens: Sunrise,
  mittags: Sun,
  nachmittags: CloudSun,
  abends: MoonStar,
  nachts: Moon,
};

/**
 * Routine unter „Heute“: Punkte in eigener Reihenfolge (am Griff ziehen, gespeichert beim Ablegen), jeder in dieser
 * Routine einzeln abhakbar. Steht ein Punkt in mehreren Routinen (z. B. Zähneputzen morgens und abends), zählt das
 * Häkchen hier als eins von mehreren am Tag. Der große Knopf im Kopf hakt alle offenen Punkte auf einmal ab (sind alle
 * erledigt, nimmt er alle Häkchen dieser Routine wieder weg). Antippen des Namens bearbeitet den Punkt, der Stift die
 * Routine.
 */
export function RoutineCard({
  routine,
  items,
  index,
  routineIndex,
  date,
  onSetRoutineDays,
  onEdit,
  onEditRoutine,
  onAdd,
}: {
  routine: HabitRoutine;
  /** an `date` fällige Punkte in gespeicherter Reihenfolge */
  items: Habit[];
  index: CheckIndex;
  routineIndex: RoutineCheckIndex;
  date: string;
  onSetRoutineDays: (updates: RoutineDayUpdate[]) => void;
  onEdit: (h: Habit) => void;
  onEditRoutine: () => void;
  onAdd: () => void;
}) {
  const Icon = ROUTINE_ICONS[routine.daytime];
  const c = drinkColor(routine.color);
  // Reihenfolge lokal (sofort sichtbar), bis der Server dieselbe Reihenfolge liefert oder sich die Punkte ändern
  const serverKey = items.map((h) => h.id).join(",");
  const [local, setLocal] = useState<{ key: string; ids: string[] } | null>(null);
  const ids = local && local.key === serverKey ? local.ids : items.map((h) => h.id);
  const ordered = ids.map((id) => items.find((h) => h.id === id)).filter((h): h is Habit => h != null);
  const sensors = useEditorSensors();
  const [, startTransition] = useTransition();
  const progress = routineProgress(routine.id, ordered, index, routineIndex, date);
  const headingId = `routine-${routine.id}`;

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    setLocal({ key: serverKey, ids: next });
    // Gespeichert wird die ganze Routine (auch heute nicht fällige Punkte behalten ihren Platz)
    const all = routine.habitIds;
    const queue = [...next];
    const full = all.map((id) => (next.includes(id) ? (queue.shift() ?? id) : id));
    startTransition(async () => {
      const result = await reorderRoutineAction(routine.id, full);
      if (!result.ok) {
        setLocal(null);
        toast.error(result.message);
      }
    });
  }

  function toggle(h: Habit) {
    const done = routinesDone(h, index, routineIndex, date).has(routine.id);
    if (!done) navigator.vibrate?.(12);
    const update = setRoutineItem(h, routine.id, !done, index, routineIndex, date);
    if (update) onSetRoutineDays([update]);
  }

  function toggleAll() {
    const done = !progress.complete;
    if (done) navigator.vibrate?.(20);
    onSetRoutineDays(ordered.map((h) => setRoutineItem(h, routine.id, done, index, routineIndex, date)).filter((u): u is RoutineDayUpdate => u != null));
    if (done) toast.success(`${routine.name} erledigt`);
  }

  return (
    <section aria-labelledby={headingId} className="overflow-hidden rounded-3xl border" style={{ background: `color-mix(in srgb, ${c} 9%, var(--card))` }}>
      <div className="flex items-center gap-3 p-4 pb-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-card" style={{ color: c }} aria-hidden>
          <Icon className="size-5" />
        </span>
        <button type="button" onClick={onEditRoutine} className="group min-w-0 flex-1 rounded-xl text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
          <h2 id={headingId} className="flex items-center gap-1.5 font-heading text-lg leading-tight font-semibold">
            <span className="truncate">{routine.name}</span>
            <Pencil className="size-3.5 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100" aria-hidden />
            <span className="sr-only">bearbeiten</span>
          </h2>
          <p className="text-sm text-muted-foreground tabular-nums">
            {items.length === 0 ? "Noch keine Punkte" : progress.complete ? "Komplett erledigt" : `${progress.done} von ${progress.total} erledigt`}
          </p>
        </button>
        {items.length > 0 ? (
          <CheckButton
            count={progress.done}
            target={progress.total}
            color={routine.color}
            onClick={toggleAll}
            label={progress.complete ? `${routine.name}: alle Häkchen entfernen` : `${routine.name}: alle Punkte abhaken (${progress.done} von ${progress.total})`}
          />
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="mx-2 rounded-2xl border border-dashed bg-card p-4 text-center text-sm text-muted-foreground">
          Füg Punkte hinzu, z. B. Glas Wasser oder Zähne putzen. Vorhandene Habits kannst du übernehmen.
        </p>
      ) : null}

      <DndContext
        id={`routine-dnd-${routine.id}`}
        collisionDetection={closestCenter}
        sensors={sensors}
        modifiers={[verticalOnly]}
        onDragEnd={onDragEnd}
        accessibility={{ announcements: announcements((id) => items.find((h) => h.id === id)?.name ?? "Punkt"), screenReaderInstructions }}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className="mx-2 divide-y rounded-2xl border bg-card">
            {ordered.map((h) => {
              const done = routinesDone(h, index, routineIndex, date).has(routine.id);
              const count = countOn(index, h.id, date);
              // in mehreren Routinen bzw. mehrmals am Tag: Stand des ganzen Tages
              const detail = [h.dose, h.target > 1 ? `${Math.min(count, h.target)}/${h.target} heute` : null].filter(Boolean);
              return (
                <SortableRow key={h.id} id={h.id} handleLabel={`${h.name} verschieben`} className="first:rounded-t-2xl last:rounded-b-2xl">
                  <div className="flex min-w-0 flex-1 items-center gap-3 py-2 pr-3">
                    <button type="button" onClick={() => onEdit(h)} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left" aria-label={`${h.name} bearbeiten`}>
                      <HabitIcon kind={h.kind} color={h.color} className="size-9 rounded-xl" />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate font-medium", done && "text-muted-foreground line-through decoration-1")}>{h.name}</span>
                        {detail.length ? <span className="block truncate text-sm text-muted-foreground tabular-nums">{detail.join(" · ")}</span> : null}
                        {h.notes ? (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <NotebookPen className="size-3 shrink-0" aria-hidden />
                            <span className="truncate">{h.notes}</span>
                          </span>
                        ) : null}
                      </span>
                    </button>
                    <CheckButton size="md" count={done ? 1 : 0} target={1} color={h.color} onClick={() => toggle(h)} label={`${h.name} ${done ? "nicht mehr abhaken" : "abhaken"}`} />
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
