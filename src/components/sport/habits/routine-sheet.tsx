"use client";

import { useState, useTransition } from "react";
import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteRoutineAction, saveRoutineAction } from "@/app/(app)/sport/habits/actions";
import { chipClass } from "@/components/recipes/chip-select";
import { EditorSheet, FieldHeading } from "@/components/recipes/editor/editor-parts";
import { announcements, screenReaderInstructions, SortableRow, useEditorSensors, verticalOnly } from "@/components/recipes/editor/sortable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type DrinkColor } from "@/lib/domain/drinks";
import { DAYTIMES, daytimeOfTime, ROUTINE_SUGGESTIONS, type Daytime, type Habit, type HabitRoutine } from "@/lib/domain/habits";
import { ColorChoice, HabitIcon } from "./habit-parts";

type Form = { name: string; daytime: Daytime; color: string; habitIds: string[] };

/** Platz unter „Heute“, wie er dort erscheint. */
const PLACE_HINT: Record<Daytime, string> = {
  morgens: "ganz oben, vor den übrigen Habits",
  mittags: "vor den Habits von mittags",
  nachmittags: "vor den Habits von nachmittags",
  abends: "nach den Habits von abends",
  nachts: "vor den Habits von nachts",
};

/**
 * Routine anlegen oder bearbeiten: Name (mit Vorschlägen), Platz unter „Heute“ (Tageszeit), Farbe und Punkte in
 * Reihenfolge (am Griff ziehen; vorhandene tägliche Habits hinzufügen, auch solche aus anderen Routinen). Löschen
 * entfernt nur die Routine, ihre Punkte bleiben als Habits erhalten.
 */
export function RoutineSheet({ routine, routines, habits, onClose }: { routine: HabitRoutine | null; routines: HabitRoutine[]; habits: Habit[]; onClose: () => void }) {
  const [open, setOpen] = useState(true);
  const [form, setForm] = useState<Form>(() => {
    if (routine) return { name: routine.name, daytime: routine.daytime, color: routine.color, habitIds: routine.habitIds };
    const hour = Number(new Intl.DateTimeFormat("de-DE", { hour: "2-digit", hour12: false, timeZone: "Europe/Berlin" }).format(new Date()));
    return { name: "", daytime: daytimeOfTime(`${String(hour % 24).padStart(2, "0")}:00`), color: "blau", habitIds: [] };
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const sensors = useEditorSensors();
  const patch = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));
  const err = (key: string) => errors[key]?.[0];
  const items = form.habitIds.map((id) => habits.find((h) => h.id === id)).filter((h): h is Habit => h != null);
  // Hinzufügen: tägliche Habits, die noch nicht drinstehen (pausierte zuletzt)
  const addable = habits.filter((h) => h.frequency === "daily" && !form.habitIds.includes(h.id)).sort((a, b) => Number(a.pausedOn != null) - Number(b.pausedOn != null));
  const usedNames = new Set(routines.filter((r) => r.id !== routine?.id).map((r) => r.name.toLocaleLowerCase("de")));
  const otherRoutines = (h: Habit) => routines.filter((r) => r.id !== routine?.id && h.routineIds.includes(r.id)).map((r) => r.name);

  function close() {
    setOpen(false);
    setTimeout(onClose, 300);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    patch({ habitIds: arrayMove(form.habitIds, form.habitIds.indexOf(String(active.id)), form.habitIds.indexOf(String(over.id))) });
  }

  function save() {
    startTransition(async () => {
      const result = await saveRoutineAction(routine?.id ?? null, { name: form.name, daytime: form.daytime, color: form.color as DrinkColor, habitIds: form.habitIds });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message ?? "Bitte die markierten Felder prüfen.");
        return;
      }
      toast.success(routine ? "Gespeichert" : `${form.name.trim()} angelegt`);
      close();
    });
  }

  function remove() {
    if (!routine) return;
    startTransition(async () => {
      const result = await deleteRoutineAction(routine.id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(`${routine.name} gelöscht`);
      close();
    });
  }

  return (
    <EditorSheet
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : close())}
      title={routine ? routine.name : "Routine anlegen"}
      description={routine ? "Punkte, Reihenfolge und Platz unter „Heute“." : "Feste Abfolge von Habits, z. B. morgens oder nach dem Training."}
      footer={
        <>
          {routine ? (
            confirmDelete ? (
              <>
                <Button type="button" variant="destructive" size="lg" onClick={remove} disabled={pending} className="flex-1">
                  Wirklich löschen
                </Button>
                <Button type="button" variant="outline" size="lg" onClick={() => setConfirmDelete(false)}>
                  Abbrechen
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" size="icon-lg" onClick={() => setConfirmDelete(true)} aria-label="Routine löschen">
                <Trash2 aria-hidden />
              </Button>
            )
          ) : null}
          {!confirmDelete ? (
            <Button type="button" size="lg" onClick={save} disabled={pending || form.name.trim() === ""} className="flex-1">
              Speichern
            </Button>
          ) : null}
        </>
      }
    >
      {confirmDelete ? (
        <p className="rounded-2xl bg-destructive/10 p-3 text-sm">Die Punkte bleiben als Habits erhalten, samt ihrer Häkchen. Nur die Routine und ihre Statistik fallen weg.</p>
      ) : null}

      {!routine ? (
        <section>
          <FieldHeading>Vorschläge</FieldHeading>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {ROUTINE_SUGGESTIONS.filter((s) => !usedNames.has(s.name.toLocaleLowerCase("de"))).map((s) => (
              <button key={s.name} type="button" aria-pressed={form.name === s.name} onClick={() => patch({ name: s.name, daytime: s.daytime, color: s.color })} className={chipClass(form.name === s.name)}>
                {s.name}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-1.5">
        <Label htmlFor="routine-name">Name</Label>
        <Input id="routine-name" value={form.name} maxLength={40} onChange={(e) => patch({ name: e.target.value })} className="h-12 text-base" placeholder="z. B. Nach dem Training" aria-invalid={Boolean(err("name"))} />
        {err("name") ? <p className="text-sm text-destructive">{err("name")}</p> : null}
      </div>

      <section>
        <FieldHeading>Platz unter „Heute“</FieldHeading>
        <div className="flex flex-wrap gap-2">
          {DAYTIMES.map((d) => (
            <button key={d.key} type="button" aria-pressed={form.daytime === d.key} onClick={() => patch({ daytime: d.key })} className={chipClass(form.daytime === d.key)}>
              {d.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Steht {PLACE_HINT[form.daytime]}.</p>
      </section>

      <section>
        <FieldHeading aside={items.length ? `${items.length}` : undefined}>Punkte</FieldHeading>
        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">Noch keine Punkte. Füg unten vorhandene Habits hinzu oder leg unter „Heute“ neue an.</p>
        ) : (
          <DndContext
            id="routine-sheet-dnd"
            collisionDetection={closestCenter}
            sensors={sensors}
            modifiers={[verticalOnly]}
            onDragEnd={onDragEnd}
            accessibility={{ announcements: announcements((id) => habits.find((h) => h.id === id)?.name ?? "Punkt"), screenReaderInstructions }}
          >
            <SortableContext items={form.habitIds} strategy={verticalListSortingStrategy}>
              <ul className="divide-y rounded-2xl border bg-card">
                {items.map((h) => {
                  const others = otherRoutines(h);
                  return (
                    <SortableRow key={h.id} id={h.id} handleLabel={`${h.name} verschieben`} className="first:rounded-t-2xl last:rounded-b-2xl">
                      <div className="flex min-h-12 min-w-0 flex-1 items-center gap-3 py-1.5 pr-1">
                        <HabitIcon kind={h.kind} color={h.color} className="size-8 rounded-xl [&_svg]:size-4" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{h.name}</span>
                          {others.length ? <span className="block truncate text-xs text-muted-foreground">auch in {others.join(", ")}</span> : null}
                        </span>
                        <Button type="button" variant="ghost" size="icon" onClick={() => patch({ habitIds: form.habitIds.filter((id) => id !== h.id) })} aria-label={`${h.name} aus der Routine nehmen`}>
                          <X aria-hidden />
                        </Button>
                      </div>
                    </SortableRow>
                  );
                })}
              </ul>
            </SortableContext>
          </DndContext>
        )}
        {addable.length > 0 ? (
          <>
            <p className="mt-3 mb-2 text-sm text-muted-foreground">Hinzufügen</p>
            <div className="flex flex-wrap gap-2">
              {addable.map((h) => (
                <button key={h.id} type="button" onClick={() => patch({ habitIds: [...form.habitIds, h.id] })} className={chipClass(false)}>
                  <Plus className="size-3.5 text-muted-foreground" aria-hidden />
                  {h.name}
                  {h.pausedOn ? <span className="text-muted-foreground">pausiert</span> : null}
                </button>
              ))}
            </div>
          </>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">Steht ein Habit in mehreren Routinen, zählt es in der Statistik einmal, mit einem Häkchen je Routine.</p>
      </section>

      <section>
        <FieldHeading>Farbe</FieldHeading>
        <ColorChoice value={form.color} onChange={(color) => patch({ color })} />
      </section>
    </EditorSheet>
  );
}
