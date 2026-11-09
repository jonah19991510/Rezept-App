"use client";

import { useState, useTransition } from "react";
import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronRight, CirclePause, Plus } from "lucide-react";
import { toast } from "sonner";
import { reorderHabitsAction } from "@/app/(app)/sport/habits/actions";
import { GroupHeading } from "@/components/layout/list-blocks";
import { announcements, screenReaderInstructions, SortableRow, useEditorSensors, verticalOnly } from "@/components/recipes/editor/sortable";
import { Button } from "@/components/ui/button";
import { HABIT_KINDS, reorderWithin, ROUTINES, scheduleLabel, type Habit } from "@/lib/domain/habits";
import { HabitIcon } from "./habit-parts";
import { ROUTINE_STYLE } from "./routine-card";
import { HabitSheet, type HabitDraft } from "./habit-sheet";

/**
 * Tab „Habits“: alle Gewohnheiten und Supplemente, Punkte der Morgen- und Abendroutine in eigenen Listen. Antippen
 * bearbeitet, am Griff ziehen ändert die Reihenfolge innerhalb der Liste (gilt auch unter „Heute“), gespeichert beim
 * Ablegen. Pausierte stehen unten.
 */
export function HabitManager({ habits }: { habits: Habit[] }) {
  const [editing, setEditing] = useState<Habit | HabitDraft | null>(null);
  // Reihenfolge lokal (sofort sichtbar); neue Daten vom Server (angelegt/gelöscht/pausiert) übernehmen
  const [ordered, setOrdered] = useState(habits);
  const [source, setSource] = useState(habits);
  if (habits !== source) {
    setSource(habits);
    setOrdered(habits);
  }
  const sensors = useEditorSensors();
  const [, startTransition] = useTransition();
  const active = ordered.filter((h) => h.pausedOn == null);
  const paused = ordered.filter((h) => h.pausedOn != null);

  const lists = [
    ...ROUTINES.map((r) => ({ key: r.key, label: r.label, icon: ROUTINE_STYLE[r.key].icon, habits: active.filter((h) => h.routine === r.key) })),
    { key: "weitere", label: ROUTINES.some((r) => active.some((h) => h.routine === r.key)) ? "Weitere Habits" : null, icon: null, habits: active.filter((h) => h.routine == null) },
  ].filter((l) => l.habits.length > 0);

  /** Verschieben innerhalb einer Liste; die anderen Listen und Pausierte behalten ihre Plätze. */
  const onDragEnd = (list: Habit[]) => ({ active: dragged, over }: DragEndEvent) => {
    if (!over || dragged.id === over.id) return;
    const before = ordered;
    const moved = arrayMove(list, list.findIndex((h) => h.id === dragged.id), list.findIndex((h) => h.id === over.id));
    const nextIds = reorderWithin(
      ordered.map((h, position) => ({ id: h.id, position })),
      moved.map((h) => h.id),
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
        <span className="block truncate text-sm text-muted-foreground">{scheduleLabel(h)}</span>
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
          </span>
        </div>
        {active.length > 0 ? (
          lists.map((list) => (
            <div key={list.key}>
              {list.label ? (
                <GroupHeading aside={list.habits.length}>
                  <span className="inline-flex items-center gap-1.5">
                    {list.icon ? <list.icon className="size-4" aria-hidden /> : null}
                    {list.label}
                  </span>
                </GroupHeading>
              ) : null}
              <DndContext
                id={`habit-dnd-${list.key}`}
                collisionDetection={closestCenter}
                sensors={sensors}
                modifiers={[verticalOnly]}
                onDragEnd={onDragEnd(list.habits)}
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
            </div>
          ))
        ) : (
          <p className="rounded-3xl border border-dashed p-5 text-center text-sm text-muted-foreground">Noch keine Habits. Leg deine erste Gewohnheit oder dein erstes Supplement an.</p>
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
        <div className="grid grid-cols-2 gap-3">
          {ROUTINES.map((r) => {
            const Icon = ROUTINE_STYLE[r.key].icon;
            return (
              <Button key={r.key} type="button" variant="ghost" className="h-12 rounded-full border border-dashed" onClick={() => setEditing({ kind: "habit", routine: r.key })}>
                <Icon aria-hidden />
                Punkt {r.key === "morgen" ? "morgens" : "abends"}
              </Button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">Die Reihenfolge gilt auch unter „Heute“: in den Routinen und innerhalb jeder Tageszeit.</p>
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
          key={"id" in editing ? editing.id : `${editing.kind}-${editing.routine ?? ""}`}
          habit={"id" in editing ? editing : null}
          defaultKind={"id" in editing ? undefined : editing.kind}
          defaultRoutine={"id" in editing ? undefined : editing.routine}
          habits={ordered}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
