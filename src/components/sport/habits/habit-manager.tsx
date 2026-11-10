"use client";

import { useState, useTransition } from "react";
import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronRight, CirclePause, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { reorderHabitsAction, reorderRoutineAction } from "@/app/(app)/sport/habits/actions";
import { GroupHeading } from "@/components/layout/list-blocks";
import { announcements, screenReaderInstructions, SortableRow, useEditorSensors, verticalOnly } from "@/components/recipes/editor/sortable";
import { Button } from "@/components/ui/button";
import { HABIT_KINDS, reorderWithin, routineNames, scheduleLabel, type Habit, type HabitRoutine } from "@/lib/domain/habits";
import { HabitIcon } from "./habit-parts";
import { HabitSheet, type HabitDraft } from "./habit-sheet";
import { ROUTINE_ICONS } from "./routine-card";
import { RoutineSheet } from "./routine-sheet";

type List = { key: string; label: string | null; routine: HabitRoutine | null; habits: Habit[] };

/**
 * Tab „Habits“: alle Routinen mit ihren Punkten (ein Habit kann in mehreren stehen) und die übrigen Gewohnheiten und
 * Supplemente. Antippen bearbeitet, der Stift bearbeitet die Routine, am Griff ziehen ändert die Reihenfolge innerhalb
 * der Liste (gilt auch unter „Heute“), gespeichert beim Ablegen. Pausierte stehen unten.
 */
export function HabitManager({ habits, routines }: { habits: Habit[]; routines: HabitRoutine[] }) {
  const [editing, setEditing] = useState<Habit | HabitDraft | null>(null);
  const [editingRoutine, setEditingRoutine] = useState<HabitRoutine | null | undefined>(undefined);
  // Reihenfolge lokal (sofort sichtbar); neue Daten vom Server (angelegt/gelöscht/pausiert) übernehmen
  const [ordered, setOrdered] = useState(habits);
  const [routineOrder, setRoutineOrder] = useState(routines);
  const [source, setSource] = useState({ habits, routines });
  if (habits !== source.habits || routines !== source.routines) {
    setSource({ habits, routines });
    setOrdered(habits);
    setRoutineOrder(routines);
  }
  const sensors = useEditorSensors();
  const [, startTransition] = useTransition();
  const active = ordered.filter((h) => h.pausedOn == null);
  const paused = ordered.filter((h) => h.pausedOn != null);

  const lists: List[] = [
    ...routineOrder.map((r) => ({
      key: r.id,
      label: r.name,
      routine: r,
      habits: r.habitIds.map((id) => active.find((h) => h.id === id)).filter((h): h is Habit => h != null),
    })),
    { key: "weitere", label: routines.length ? "Weitere Habits" : null, routine: null, habits: active.filter((h) => h.routineIds.length === 0) },
  ];

  /** Verschieben innerhalb einer Liste; die anderen Listen und Pausierte behalten ihre Plätze. */
  const onDragEnd = (list: List) => ({ active: dragged, over }: DragEndEvent) => {
    if (!over || dragged.id === over.id) return;
    const moved = arrayMove(list.habits, list.habits.findIndex((h) => h.id === dragged.id), list.habits.findIndex((h) => h.id === over.id)).map((h) => h.id);
    if (list.routine) {
      const routine = list.routine;
      const before = routineOrder;
      // pausierte Punkte behalten ihren Platz in der Routine
      const habitIds = reorderWithin(routine.habitIds.map((id, position) => ({ id, position })), moved);
      setRoutineOrder(routineOrder.map((r) => (r.id === routine.id ? { ...r, habitIds } : r)));
      startTransition(async () => {
        const result = await reorderRoutineAction(routine.id, habitIds);
        if (!result.ok) {
          setRoutineOrder(before);
          toast.error(result.message);
        }
      });
      return;
    }
    const before = ordered;
    const nextIds = reorderWithin(
      ordered.map((h, position) => ({ id: h.id, position })),
      moved,
    );
    const next = nextIds.map((id) => ordered.find((h) => h.id === id)).filter((h): h is Habit => h != null);
    setOrdered(next);
    startTransition(async () => {
      const result = await reorderHabitsAction(next.map((h) => h.id));
      if (!result.ok) {
        setOrdered(before);
        toast.error(result.message);
      }
    });
  };

  const row = (h: Habit) => (
    <button type="button" onClick={() => setEditing(h)} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-3 pr-4 text-left transition hover:bg-muted/40">
      <HabitIcon kind={h.kind} color={h.color} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">
          {h.name}
          {h.dose ? <span className="font-normal text-muted-foreground"> · {h.dose}</span> : null}
        </span>
        <span className="block truncate text-sm text-muted-foreground">{scheduleLabel(h, routineNames(h, routines))}</span>
        {h.notes ? <span className="block truncate text-xs text-muted-foreground">{h.notes}</span> : null}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );

  return (
    <div className="space-y-6">
      <section aria-labelledby="habit-liste" className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="habit-liste" className="text-lg font-semibold">
            Deine Habits
          </h2>
          <span className="text-sm text-muted-foreground">
            {HABIT_KINDS.map((k) => `${active.filter((h) => h.kind === k.key).length} ${k.plural}`).join(" · ")}
            {routines.length ? ` · ${routines.length} ${routines.length === 1 ? "Routine" : "Routinen"}` : ""}
          </span>
        </div>
        {active.length === 0 && routines.length === 0 ? (
          <p className="rounded-3xl border border-dashed p-5 text-center text-sm text-muted-foreground">Noch keine Habits. Leg deine erste Gewohnheit oder dein erstes Supplement an.</p>
        ) : (
          lists.map((list) => {
            const Icon = list.routine ? ROUTINE_ICONS[list.routine.daytime] : null;
            if (!list.routine && list.habits.length === 0) return null;
            return (
              <div key={list.key}>
                {list.label ? (
                  <GroupHeading
                    aside={
                      list.routine ? (
                        <Button type="button" variant="ghost" size="icon" className="-my-2 rounded-full" onClick={() => setEditingRoutine(list.routine)} aria-label={`${list.label} bearbeiten`}>
                          <Pencil aria-hidden />
                        </Button>
                      ) : (
                        list.habits.length
                      )
                    }
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {Icon ? <Icon className="size-4" aria-hidden /> : null}
                      {list.label}
                      {list.routine ? <span className="font-normal text-muted-foreground tabular-nums">· {list.habits.length}</span> : null}
                    </span>
                  </GroupHeading>
                ) : null}
                {list.habits.length > 0 ? (
                  <DndContext
                    id={`habit-dnd-${list.key}`}
                    collisionDetection={closestCenter}
                    sensors={sensors}
                    modifiers={[verticalOnly]}
                    onDragEnd={onDragEnd(list)}
                    accessibility={{ announcements: announcements((id) => ordered.find((h) => h.id === id)?.name ?? "Habit"), screenReaderInstructions }}
                  >
                    <SortableContext items={list.habits.map((h) => h.id)} strategy={verticalListSortingStrategy}>
                      <ul className="divide-y rounded-3xl border bg-card">
                        {list.habits.map((h) => (
                          <SortableRow key={h.id} id={h.id} handleLabel={`${h.name} verschieben`} className="overflow-hidden first:rounded-t-3xl last:rounded-b-3xl">
                            {row(h)}
                          </SortableRow>
                        ))}
                      </ul>
                    </SortableContext>
                  </DndContext>
                ) : null}
                {list.routine ? (
                  <button
                    type="button"
                    onClick={() => setEditing({ kind: "habit", routineId: list.routine?.id })}
                    className="mt-1 flex min-h-11 items-center gap-1.5 px-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
                  >
                    <Plus className="size-4" aria-hidden />
                    Punkt hinzufügen
                  </button>
                ) : null}
              </div>
            );
          })
        )}
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="outline" className="h-12 rounded-full" onClick={() => setEditing({ kind: "habit" })}>
            <Plus aria-hidden />
            Gewohnheit
          </Button>
          <Button type="button" variant="outline" className="h-12 rounded-full" onClick={() => setEditing({ kind: "supplement" })}>
            <Plus aria-hidden />
            Supplement
          </Button>
        </div>
        <Button type="button" variant="ghost" className="h-12 w-full rounded-full border border-dashed" onClick={() => setEditingRoutine(null)}>
          <Plus aria-hidden />
          Routine anlegen
        </Button>
        <p className="text-xs text-muted-foreground">Die Reihenfolge gilt auch unter „Heute“: in den Routinen und innerhalb jeder Tageszeit. Ein Habit kann in mehreren Routinen stehen und zählt trotzdem nur einmal.</p>
      </section>

      {paused.length > 0 ? (
        <section aria-label="Pausiert">
          <GroupHeading aside={paused.length}>
            <span className="inline-flex items-center gap-1.5">
              <CirclePause className="size-4" aria-hidden />
              Pausiert
            </span>
          </GroupHeading>
          <ul className="divide-y overflow-hidden rounded-3xl border bg-card opacity-75">
            {paused.map((h) => (
              <li key={h.id} className="flex pl-3">
                {row(h)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {editing ? (
        <HabitSheet
          key={"id" in editing ? editing.id : `${editing.kind}-${editing.routineId ?? ""}`}
          habit={"id" in editing ? editing : null}
          defaultKind={"id" in editing ? undefined : editing.kind}
          defaultRoutineId={"id" in editing ? undefined : editing.routineId}
          habits={ordered}
          routines={routines}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {editingRoutine !== undefined ? (
        <RoutineSheet key={editingRoutine?.id ?? "neu"} routine={editingRoutine} routines={routines} habits={ordered} onClose={() => setEditingRoutine(undefined)} />
      ) : null}
    </div>
  );
}
