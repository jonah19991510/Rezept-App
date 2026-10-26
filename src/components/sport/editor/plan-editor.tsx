"use client";

import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, Flame, GripVertical, Pencil, Plus, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { savePlanAction } from "@/app/(app)/sport/plaene/actions";
import { FormMessage } from "@/components/forms/form-message";
import { EditorHeader } from "@/components/recipes/editor/editor-header";
import {
  announcements,
  screenReaderInstructions,
  SortableRow,
  useEditorSensors,
  verticalOnly,
} from "@/components/recipes/editor/sortable";
import { Button } from "@/components/ui/button";
import { MUSCLE_LABELS, type ExerciseOption } from "@/lib/domain/exercises";
import { nextDayName, planSummary, restLabel, targetLabel, totalSets } from "@/lib/domain/training-plan";
import { cn } from "@/lib/utils";
import { flattenIssues } from "@/lib/validation/recipe";
import { trainingPlanInputSchema } from "@/lib/validation/training-plan";
import { DaySheet } from "./day-sheet";
import { ExercisePicker } from "./exercise-picker";
import { ExerciseSheet } from "./exercise-sheet";
import {
  dayErrors,
  draftToInput,
  exerciseErrors,
  newDraftExercise,
  replaceDraftExercise,
  type DraftDay,
  type DraftExercise,
  type DraftPlan,
} from "./plan-model";

const cardClass = "rounded-3xl border bg-card";

type Picker = { dayKey: string; replaceKey: string | null } | null;
type Sheet = { dayKey: string; key: string; open: boolean } | null;

/**
 * Plan-Editor (Design wie der Rezept-Editor): Name und Beschreibung, darunter die Trainingstage als aufklappbare
 * Karten. Tage und Übungen lassen sich am Griff verschieben, Übungen per Sheet bearbeiten. Gespeichert wird erst mit
 * „Speichern“ (Leiste unten).
 */
export function PlanEditor({
  initial,
  exercises: initialExercises,
  keyStart,
}: {
  initial: DraftPlan;
  exercises: ExerciseOption[];
  /** höchster Schlüssel im Entwurf, neue Schlüssel zählen weiter */
  keyStart: number;
}) {
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [days, setDays] = useState<DraftDay[]>(initial.days);
  const [exercises, setExercises] = useState(initialExercises);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [picker, setPicker] = useState<Picker>(null);
  const [exerciseSheet, setExerciseSheet] = useState<Sheet>(null);
  const [daySheet, setDaySheet] = useState<{ key: string; open: boolean } | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string>();
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const sensors = useEditorSensors();
  const keySequence = useRef(keyStart);
  const nextKey = () => `k${++keySequence.current}`;

  // Warnung beim Schließen der Seite mit ungespeicherten Änderungen
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function changeDays(update: (prev: DraftDay[]) => DraftDay[]) {
    setDirty(true);
    setDays(update);
  }
  function updateDay(dayKey: string, patch: Partial<DraftDay>) {
    changeDays((prev) => prev.map((d) => (d.key === dayKey ? { ...d, ...patch } : d)));
  }
  function updateExercise(dayKey: string, key: string, patch: Partial<DraftExercise>) {
    changeDays((prev) =>
      prev.map((d) => (d.key === dayKey ? { ...d, exercises: d.exercises.map((e) => (e.key === key ? { ...e, ...patch } : e)) } : d)),
    );
  }

  function addDay() {
    const key = nextKey();
    changeDays((prev) => [...prev, { key, id: null, name: nextDayName(prev.map((d) => d.name)), focus: "", exercises: [] }]);
    setDaySheet({ key, open: true });
  }

  function removeDay(dayKey: string) {
    const day = days.find((d) => d.key === dayKey);
    const index = days.findIndex((d) => d.key === dayKey);
    if (!day) return;
    setDaySheet((s) => (s ? { ...s, open: false } : s));
    changeDays((prev) => prev.filter((d) => d.key !== dayKey));
    toast(`${day.name.trim() || "Tag"} gelöscht`, {
      action: { label: "Rückgängig", onClick: () => changeDays((prev) => [...prev.slice(0, index), day, ...prev.slice(index)]) },
    });
  }

  function onPick(chosen: ExerciseOption[]) {
    if (!picker) return;
    const { dayKey, replaceKey } = picker;
    if (replaceKey) {
      changeDays((prev) =>
        prev.map((d) =>
          d.key === dayKey ? { ...d, exercises: d.exercises.map((e) => (e.key === replaceKey ? replaceDraftExercise(e, chosen[0]) : e)) } : d,
        ),
      );
      setExerciseSheet({ dayKey, key: replaceKey, open: true });
      return;
    }
    changeDays((prev) =>
      prev.map((d) => (d.key === dayKey ? { ...d, exercises: [...d.exercises, ...chosen.map((x) => newDraftExercise(nextKey(), x))] } : d)),
    );
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.delete(dayKey);
      return next;
    });
  }

  function removeExercise(dayKey: string, key: string) {
    const day = days.find((d) => d.key === dayKey);
    const index = day?.exercises.findIndex((e) => e.key === key) ?? -1;
    const removed = day?.exercises[index];
    if (!removed) return;
    setExerciseSheet(null);
    changeDays((prev) => prev.map((d) => (d.key === dayKey ? { ...d, exercises: d.exercises.filter((e) => e.key !== key) } : d)));
    toast(`${removed.exercise.name} entfernt`, {
      action: {
        label: "Rückgängig",
        onClick: () =>
          changeDays((prev) =>
            prev.map((d) =>
              d.key === dayKey ? { ...d, exercises: [...d.exercises.slice(0, index), removed, ...d.exercises.slice(index)] } : d,
            ),
          ),
      },
    });
  }

  function moveExercise(fromDay: string, key: string, toDay: string) {
    if (fromDay === toDay) return;
    changeDays((prev) => {
      const moving = prev.find((d) => d.key === fromDay)?.exercises.find((e) => e.key === key);
      if (!moving) return prev;
      return prev.map((d) =>
        d.key === fromDay
          ? { ...d, exercises: d.exercises.filter((e) => e.key !== key) }
          : d.key === toDay
            ? { ...d, exercises: [...d.exercises, moving] }
            : d,
      );
    });
    setExerciseSheet({ dayKey: toDay, key, open: true });
    const target = days.find((d) => d.key === toDay);
    toast(`Verschoben nach ${target?.name.trim() || "anderem Tag"}`);
  }

  function onDayDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    changeDays((prev) => arrayMove(prev, prev.findIndex((d) => d.key === active.id), prev.findIndex((d) => d.key === over.id)));
  }

  function save() {
    const plan: DraftPlan = { id: initial.id, title, description, days };
    const input = draftToInput(plan);
    const parsed = trainingPlanInputSchema.safeParse(input);
    if (!parsed.success) {
      const issues = flattenIssues(parsed.error);
      setErrors(issues);
      setMessage("Bitte prüfe die markierten Felder.");
      toast.error("Bitte prüfe die markierten Felder.");
      const firstDay = Object.keys(issues)
        .map((k) => /^days\.(\d+)/.exec(k)?.[1])
        .find((v) => v != null);
      document.getElementById(issues.title ? "plan-title" : firstDay != null ? `tag-${days[Number(firstDay)]?.key}` : "sec-tage")?.scrollIntoView({ block: "center" });
      return;
    }
    setErrors({});
    setMessage(undefined);
    startTransition(async () => {
      setDirty(false);
      // Bei Erfolg leitet die Action zur Planseite weiter; hier landen nur Fehler
      const result = await savePlanAction(input);
      if (result && !result.ok) {
        setDirty(true);
        setErrors(result.fieldErrors ?? {});
        setMessage(result.message);
        toast.error(result.message ?? "Speichern fehlgeschlagen.");
      }
    });
  }

  const openDayIndex = exerciseSheet ? days.findIndex((d) => d.key === exerciseSheet.dayKey) : -1;
  const openExerciseIndex = openDayIndex >= 0 ? days[openDayIndex].exercises.findIndex((e) => e.key === exerciseSheet!.key) : -1;
  const openExercise = openExerciseIndex >= 0 ? days[openDayIndex].exercises[openExerciseIndex] : undefined;
  const sheetDayIndex = daySheet ? days.findIndex((d) => d.key === daySheet.key) : -1;
  const dayName = (id: string | number) => days.find((d) => d.key === id)?.name.trim() || "Tag";

  return (
    <div className="space-y-8 pb-24">
      <EditorHeader
        kicker={initial.id ? "Plan bearbeiten" : "Neuer Plan"}
        title={title.trim() || "Ohne Namen"}
        cancelHref={initial.id ? `/sport/plaene/${initial.id}` : "/sport/plaene"}
        dirty={dirty}
        onDiscard={() => setDirty(false)}
      />
      <FormMessage message={message} />

      <div className={cardClass}>
        <div className="px-4 pt-3 pb-2">
          <label htmlFor="plan-title" className="text-sm font-medium text-muted-foreground">
            Name
          </label>
          <input
            id="plan-title"
            value={title}
            onChange={(e) => {
              setDirty(true);
              setTitle(e.target.value);
            }}
            maxLength={100}
            placeholder="z. B. Push / Pull / Beine"
            aria-invalid={Boolean(errors.title) || undefined}
            className="mt-0.5 block min-h-11 w-full bg-transparent font-heading text-[1.75rem] leading-tight font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50"
          />
          {errors.title ? <p className="mt-1 text-sm text-destructive">{errors.title[0]}</p> : null}
        </div>
        <div className="border-t px-4 pt-3 pb-3">
          <label htmlFor="plan-description" className="text-sm font-medium text-muted-foreground">
            Beschreibung <span className="font-normal">· optional</span>
          </label>
          <textarea
            id="plan-description"
            value={description}
            onChange={(e) => {
              setDirty(true);
              setDescription(e.target.value);
            }}
            maxLength={1000}
            rows={2}
            placeholder="Ziel, Rhythmus, Hinweise, z. B. 3× pro Woche, Tage im Wechsel"
            className="mt-1 block min-h-14 w-full resize-none bg-transparent text-base outline-none [field-sizing:content] placeholder:text-muted-foreground/70"
          />
          {errors.description ? <p className="mt-1 text-sm text-destructive">{errors.description[0]}</p> : null}
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4" aria-labelledby="sec-tage">
        <div className="flex items-center justify-between gap-3">
          <h2 id="sec-tage" className="flex items-baseline gap-2 text-[1.75rem] leading-tight font-semibold">
            Trainingstage
            <span className="font-sans text-sm font-normal text-muted-foreground tabular-nums">{days.length}</span>
          </h2>
        </div>
        {errors.days ? <p className="text-sm text-destructive">{errors.days[0]}</p> : null}

        <DndContext
          id="dnd-tage"
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[verticalOnly]}
          onDragEnd={onDayDragEnd}
          accessibility={{ announcements: announcements(dayName), screenReaderInstructions }}
        >
          <SortableContext items={days.map((d) => d.key)} strategy={verticalListSortingStrategy}>
            <ol className="grid grid-cols-1 gap-4" aria-label="Trainingstage">
              {days.map((day, dayIndex) => (
                <DayCard
                  key={day.key}
                  day={day}
                  dayIndex={dayIndex}
                  errors={errors}
                  open={!collapsed.has(day.key)}
                  onToggle={() =>
                    setCollapsed((prev) => {
                      const next = new Set(prev);
                      if (next.has(day.key)) next.delete(day.key);
                      else next.add(day.key);
                      return next;
                    })
                  }
                  onEditDay={() => setDaySheet({ key: day.key, open: true })}
                  onOpenExercise={(key) => setExerciseSheet({ dayKey: day.key, key, open: true })}
                  onAddExercise={() => setPicker({ dayKey: day.key, replaceKey: null })}
                  onReorder={(from, to) => changeDays((prev) => prev.map((d) => (d.key === day.key ? { ...d, exercises: arrayMove(d.exercises, from, to) } : d)))}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>

        <button
          type="button"
          onClick={addDay}
          disabled={days.length >= 14}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-3xl border border-dashed px-4 font-medium text-muted-foreground transition hover:bg-muted/50 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
        >
          <Plus className="size-5" aria-hidden />
          Trainingstag hinzufügen
        </button>
      </section>

      {/* Speicherleiste: am Handy fest unten (Navigation ist ausgeblendet), am Desktop mitlaufend unten im Inhalt */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t bg-background/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:sticky md:bottom-4 md:rounded-2xl md:border md:p-3 md:shadow-lg">
        <p className="min-w-0 tabular-nums">
          <span className="block font-semibold whitespace-nowrap">{planSummary(days)}</span>
          <span className="block text-xs text-muted-foreground">{totalSets(days.flatMap((d) => d.exercises))} Sätze insgesamt</span>
        </p>
        <Button type="button" onClick={save} disabled={pending} className="h-12 shrink-0 rounded-full px-7 text-base">
          {pending ? "Wird gespeichert …" : "Speichern"}
        </Button>
      </div>

      <ExercisePicker
        open={picker != null}
        onOpenChange={(o) => {
          if (!o) setPicker(null);
        }}
        exercises={exercises}
        onCreated={(x) => setExercises((prev) => [...prev, x])}
        onSelect={onPick}
        mode={picker?.replaceKey ? "replace" : "add"}
      />

      <ExerciseSheet
        open={Boolean(exerciseSheet?.open && openExercise)}
        onOpenChange={(o) => setExerciseSheet((s) => (s ? { ...s, open: o } : s))}
        draft={openExercise}
        dayKey={exerciseSheet?.dayKey ?? ""}
        days={days}
        errors={openExercise ? exerciseErrors(errors, openDayIndex, openExerciseIndex) : {}}
        onChange={(patch) => exerciseSheet && updateExercise(exerciseSheet.dayKey, exerciseSheet.key, patch)}
        onMove={(to) => exerciseSheet && moveExercise(exerciseSheet.dayKey, exerciseSheet.key, to)}
        onReplace={() => {
          if (!exerciseSheet) return;
          setExerciseSheet({ ...exerciseSheet, open: false });
          setPicker({ dayKey: exerciseSheet.dayKey, replaceKey: exerciseSheet.key });
        }}
        onRemove={() => exerciseSheet && removeExercise(exerciseSheet.dayKey, exerciseSheet.key)}
      />

      <DaySheet
        open={Boolean(daySheet?.open && sheetDayIndex >= 0)}
        onOpenChange={(o) => setDaySheet((s) => (s ? { ...s, open: o } : s))}
        day={sheetDayIndex >= 0 ? days[sheetDayIndex] : undefined}
        canRemove={days.length > 1}
        errors={sheetDayIndex >= 0 ? dayErrors(errors, sheetDayIndex) : {}}
        onChange={(patch) => daySheet && updateDay(daySheet.key, patch)}
        onRemove={() => daySheet && removeDay(daySheet.key)}
      />
    </div>
  );
}

/** Ein Trainingstag als Karte: Griff, Name/Fokus (antippen klappt auf/zu), Stift, Übungen zum Verschieben. */
function DayCard({
  day,
  dayIndex,
  errors,
  open,
  onToggle,
  onEditDay,
  onOpenExercise,
  onAddExercise,
  onReorder,
}: {
  day: DraftDay;
  dayIndex: number;
  errors: Record<string, string[]>;
  open: boolean;
  onToggle: () => void;
  onEditDay: () => void;
  onOpenExercise: (key: string) => void;
  onAddExercise: () => void;
  onReorder: (from: number, to: number) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: day.key });
  const sensors = useEditorSensors();
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition };
  const ownErrors = dayErrors(errors, dayIndex);
  const hasErrors = Object.keys(errors).some((k) => k.startsWith(`days.${dayIndex}.`));
  const listId = `tag-liste-${day.key}`;
  const exerciseName = (id: string | number) => day.exercises.find((e) => e.key === id)?.exercise.name ?? "Übung";

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    onReorder(
      day.exercises.findIndex((e) => e.key === active.id),
      day.exercises.findIndex((e) => e.key === over.id),
    );
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      id={`tag-${day.key}`}
      className={cn(cardClass, "relative scroll-mt-20", isDragging && "z-10 shadow-xl ring-1 ring-primary/40", hasErrors && "border-destructive")}
    >
      <div className="flex items-center">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`${day.name.trim() || "Tag"} verschieben`}
          className="grid w-11 shrink-0 cursor-grab touch-none place-items-center self-stretch text-muted-foreground/60 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing"
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={listId}
          className="flex min-h-16 min-w-0 flex-1 items-center gap-2 py-2 text-left focus-visible:outline-none"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate font-heading text-xl font-semibold">{day.name.trim() || "Ohne Namen"}</span>
            <span className="block truncate text-sm text-muted-foreground">
              {day.focus.trim() ? `${day.focus.trim()} · ` : ""}
              {day.exercises.length === 1 ? "1 Übung" : `${day.exercises.length} Übungen`} · {totalSets(day.exercises)} Sätze
            </span>
          </span>
          <ChevronDown className={cn("size-5 shrink-0 text-muted-foreground transition-transform", !open && "-rotate-90")} aria-hidden />
        </button>
        <Button type="button" variant="ghost" size="icon" className="mr-1.5 shrink-0 rounded-full" onClick={onEditDay} aria-label={`${day.name.trim() || "Tag"} umbenennen`}>
          <Pencil aria-hidden />
        </Button>
      </div>
      {ownErrors.name || ownErrors.exercises ? (
        <p className="px-4 pb-2 text-sm text-destructive">{(ownErrors.name ?? ownErrors.exercises)[0]}</p>
      ) : null}

      {open ? (
        <div id={listId} className="border-t">
          {day.exercises.length > 0 ? (
            <DndContext
              id={`dnd-uebungen-${day.key}`}
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[verticalOnly]}
              onDragEnd={onDragEnd}
              accessibility={{ announcements: announcements(exerciseName), screenReaderInstructions }}
            >
              <SortableContext items={day.exercises.map((e) => e.key)} strategy={verticalListSortingStrategy}>
                <ol className="divide-y" aria-label={`Übungen ${day.name}`}>
                  {day.exercises.map((e, i) => {
                    const invalid = Object.keys(exerciseErrors(errors, dayIndex, i)).length > 0;
                    const rest = restLabel(e.restSeconds);
                    return (
                      <SortableRow key={e.key} id={e.key} handleLabel={`${e.exercise.name} verschieben`}>
                        <button
                          type="button"
                          onClick={() => onOpenExercise(e.key)}
                          className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pr-4 text-left transition hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{e.exercise.name}</span>
                            <span className="flex items-center gap-1 truncate text-sm text-muted-foreground">
                              {invalid ? <TriangleAlert className="size-3.5 shrink-0 text-destructive" aria-label="Bitte prüfen" /> : null}
                              {e.warmup ? <Flame className="size-3.5 shrink-0 text-primary" aria-label="mit Aufwärmsätzen" /> : null}
                              <span className="truncate">
                                {MUSCLE_LABELS[e.exercise.muscleGroup]}
                                {rest ? ` · ${rest}` : ""}
                                {e.note.trim() ? ` · ${e.note.trim()}` : ""}
                              </span>
                            </span>
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums">
                            {targetLabel({
                              sets: e.sets,
                              repsMin: Number.parseInt(e.repsMin, 10) || null,
                              repsMax: Number.parseInt(e.repsMax, 10) || null,
                              targetSeconds: Number.parseInt(e.targetSeconds, 10) || null,
                              tracking: e.exercise.tracking,
                            })}
                          </span>
                        </button>
                      </SortableRow>
                    );
                  })}
                </ol>
              </SortableContext>
            </DndContext>
          ) : (
            <p className="px-4 pt-3 text-sm text-muted-foreground">Noch keine Übungen an diesem Tag.</p>
          )}
          <div className="p-3">
            <Button type="button" variant="ghost" className="h-12 w-full rounded-2xl text-primary" onClick={onAddExercise}>
              <Plus aria-hidden />
              Übung hinzufügen
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
