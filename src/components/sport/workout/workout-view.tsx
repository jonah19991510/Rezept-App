"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, useTransition, type CSSProperties } from "react";
import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  ChevronLeft,
  CloudCheck,
  CloudOff,
  EllipsisVertical,
  Flame,
  GripVertical,
  Loader2,
  Minus,
  Plus,
  Repeat,
  StickyNote,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { deleteWorkoutAction, lastSetsAction } from "@/app/(app)/sport/training-actions";
import { useWakeLock } from "@/components/cooking/use-wake-lock";
import { announcements, screenReaderInstructions, useEditorSensors, verticalOnly } from "@/components/recipes/editor/sortable";
import { ExercisePicker } from "@/components/sport/editor/exercise-picker";
import { newDraftExercise } from "@/components/sport/editor/plan-model";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EQUIPMENT_LABELS, isTimed, MUSCLE_LABELS, type ExerciseOption } from "@/lib/domain/exercises";
import { repsRange, restLabel } from "@/lib/domain/training-plan";
import { formatCountdown } from "@/lib/domain/timers";
import {
  berlinParts,
  berlinToIso,
  emptySet,
  finalizeEditedSession,
  finalizeSession,
  formatSet,
  mmss,
  resolveSet,
  setHasValues,
  setInputs,
  summarizeSession,
  uuid,
  warmupSets,
  workoutDuration,
  type LastSet,
  type Session,
  type SessionExercise,
  type SessionSet,
} from "@/lib/domain/workout";
import { parseDecimal } from "@/lib/domain/decimal";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useRestTimer } from "./use-rest-timer";
import { clearLocalWorkout, useWorkoutSession, type SyncState } from "./use-workout-session";

const ITEM = "min-h-11 gap-2.5 px-2.5";
const inputClass =
  "h-11 w-full min-w-0 rounded-xl border border-input bg-background px-2 text-center text-base font-semibold tabular-nums outline-none placeholder:font-normal placeholder:text-muted-foreground/45 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-100";

/** Vorgabe vom letzten Mal für den n-ten Arbeitssatz (danach gilt der letzte bekannte Satz). */
function lastFor(last: Record<string, LastSet[]>, exerciseId: string, normalIndex: number): LastSet | null {
  const list = last[exerciseId];
  if (!list?.length) return null;
  return list[normalIndex] ?? list.at(-1) ?? null;
}

/** Sekundentakt nur im Browser (auf dem Server null), damit Server- und Browser-HTML gleich sind. */
function subscribeSeconds(onChange: () => void) {
  const id = window.setInterval(onChange, 1000);
  return () => window.clearInterval(id);
}
function useNow(): number | null {
  return useSyncExternalStore(
    subscribeSeconds,
    () => Math.floor(Date.now() / 1000) * 1000,
    () => null,
  );
}

function withExercise(session: Session, id: string, change: (e: SessionExercise) => SessionExercise): Session {
  return { ...session, exercises: session.exercises.map((e) => (e.id === id ? change(e) : e)) };
}

/**
 * Training im Gym (Vollbild ohne Navigation): Dauer oben, je Übung die Sätze mit den Werten vom letzten Mal (hell,
 * Abhaken übernimmt sie), Aufwärmsätze auf Knopfdruck, Pausentimer, Übungen tauschen/hinzufügen/verschieben.
 * Alles wird zuerst auf dem Handy gesichert und hochgeladen, sobald Netz da ist.
 * mode „edit“: beendetes oder nachgetragenes Training bearbeiten – Datum, Uhrzeit und Dauer statt laufender Uhr, ohne
 * Pausentimer; „Speichern“ übernimmt alle Sätze mit Werten (auch ohne Haken).
 */
export function WorkoutView({
  initial,
  exercises: initialExercises,
  last: initialLast,
  mode = "live",
}: {
  initial: Session;
  exercises: ExerciseOption[];
  last: Record<string, LastSet[]>;
  mode?: "live" | "edit";
}) {
  const edit = mode === "edit";
  const router = useRouter();
  const { session, update, state, synced } = useWorkoutSession(initial);
  const [last, setLast] = useState(initialLast);
  const [exercises, setExercises] = useState(initialExercises);
  const [picker, setPicker] = useState<{ replaceId: string | null } | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [openNotes, setOpenNotes] = useState<Set<string>>(() => new Set());
  // Beendet bzw. gespeichert: sobald hochgeladen, weiter zur Trainingsseite
  const [finished, setFinished] = useState(false);
  const now = useNow();
  const [discarding, startDiscard] = useTransition();
  const rest = useRestTimer();
  const sensors = useEditorSensors();
  // Live: ein beendeter Stand (z. B. offline beendet, dann neu geladen) gilt als fertig
  const done = finished || (!edit && session.endedAt != null);
  useWakeLock(!edit && !done);

  // Abgeschlossen und hochgeladen: lokale Kopie weg, weiter zur Trainingsseite
  useEffect(() => {
    if (done && synced) {
      clearLocalWorkout(session.id);
      router.replace(`/sport/verlauf/${session.id}${edit ? "" : "?fertig=1"}`);
    }
  }, [done, edit, session.id, synced, router]);

  const summary = useMemo(() => summarizeSession(session, new Date(now ?? new Date(session.startedAt).getTime())), [session, now]);

  async function loadLast(ids: string[]) {
    const missing = ids.filter((id) => !(id in last));
    if (missing.length === 0) return;
    try {
      const found = await lastSetsAction(missing, session.id);
      setLast((prev) => ({ ...prev, ...found }));
    } catch {
      // ohne Netz eben ohne Vorgaben
    }
  }

  function updateSet(exerciseId: string, setId: string, patch: Partial<SessionSet>) {
    update((s) => withExercise(s, exerciseId, (e) => ({ ...e, sets: e.sets.map((x) => (x.id === setId ? { ...x, ...patch } : x)) })));
  }

  function toggleSet(e: SessionExercise, set: SessionSet, normalIndex: number) {
    if (set.done) {
      updateSet(e.id, set.id, { done: false, doneAt: null });
      return;
    }
    const values = resolveSet(set, set.kind === "normal" ? lastFor(last, e.exercise.id, normalIndex) : null, e.exercise.tracking);
    if (!setHasValues(values, e.exercise.tracking)) {
      toast(
        e.exercise.tracking === "distance_time"
          ? "Trag zuerst Zeit oder Strecke ein."
          : isTimed(e.exercise.tracking)
            ? "Trag zuerst die Zeit ein."
            : "Trag zuerst die Wiederholungen ein.",
      );
      return;
    }
    updateSet(e.id, set.id, { ...setInputs(values), done: true, doneAt: new Date().toISOString() });
    if (!edit && set.kind === "normal" && e.restSeconds) rest.start(e.restSeconds, e.exercise.name);
  }

  function addSet(e: SessionExercise) {
    update((s) => withExercise(s, e.id, (x) => ({ ...x, sets: [...x.sets, emptySet()] })));
  }

  function removeSet(e: SessionExercise) {
    // zuerst den letzten nicht erledigten Satz, sonst den letzten
    const index = e.sets.findLastIndex((x) => !x.done);
    const removeAt = index >= 0 ? index : e.sets.length - 1;
    if (removeAt < 0) return;
    update((s) => withExercise(s, e.id, (x) => ({ ...x, sets: x.sets.filter((_, i) => i !== removeAt) })));
  }

  function addWarmups(e: SessionExercise) {
    const firstNormal = e.sets.find((x) => x.kind === "normal");
    const working = parseDecimal(firstNormal?.weight ?? "") ?? lastFor(last, e.exercise.id, 0)?.weightKg ?? null;
    if (!working) {
      toast("Trag zuerst das Arbeitsgewicht im ersten Satz ein.");
      return;
    }
    const warmups = warmupSets(working, e.exercise.equipment);
    if (warmups.length === 0) {
      toast("Bei diesem Gewicht braucht es keine Aufwärmsätze.");
      return;
    }
    update((s) =>
      withExercise(s, e.id, (x) => ({
        ...x,
        sets: [
          ...warmups.map((w) => ({ ...emptySet("warmup"), ...setInputs({ weightKg: w.weightKg, reps: w.reps, seconds: null, distanceM: null }) })),
          // erledigte Aufwärmsätze bleiben, offene werden ersetzt
          ...x.sets.filter((set) => set.kind === "normal" || set.done),
        ],
      })),
    );
  }

  function removeExercise(e: SessionExercise) {
    const index = session.exercises.findIndex((x) => x.id === e.id);
    update((s) => ({ ...s, exercises: s.exercises.filter((x) => x.id !== e.id) }));
    toast(`${e.exercise.name} entfernt`, {
      action: {
        label: "Rückgängig",
        onClick: () => update((s) => ({ ...s, exercises: [...s.exercises.slice(0, index), e, ...s.exercises.slice(index)] })),
      },
    });
  }

  function onPick(chosen: ExerciseOption[]) {
    if (!picker) return;
    if (picker.replaceId) {
      const replaceId = picker.replaceId;
      update((s) =>
        withExercise(s, replaceId, (e) => ({
          ...e,
          exercise: chosen[0],
          // Werte gehören zur alten Übung: erledigte Sätze bleiben nicht stehen
          sets: e.sets.filter((x) => x.kind === "normal").map(() => emptySet()),
          warmup: chosen[0].tracking === "weight_reps" && e.warmup,
        })),
      );
    } else {
      update((s) => ({
        ...s,
        exercises: [
          ...s.exercises,
          ...chosen.map((x) => {
            const d = newDraftExercise("neu", x);
            return {
              id: uuid(),
              exercise: x,
              repsMin: Number.parseInt(d.repsMin, 10) || null,
              repsMax: Number.parseInt(d.repsMax, 10) || null,
              targetSeconds: Number.parseInt(d.targetSeconds, 10) || null,
              restSeconds: d.restSeconds,
              warmup: false,
              note: "",
              sets: Array.from({ length: d.sets }, () => emptySet()),
            };
          }),
        ],
      }));
    }
    void loadLast(chosen.map((x) => x.id));
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    update((s) => ({
      ...s,
      exercises: arrayMove(s.exercises, s.exercises.findIndex((e) => e.id === active.id), s.exercises.findIndex((e) => e.id === over.id)),
    }));
  }

  function finish() {
    setConfirmFinish(false);
    rest.stop();
    update((s) => finalizeSession(s, new Date().toISOString(), last));
    setFinished(true);
  }

  /** Bearbeiten: Sätze mit Werten übernehmen und speichern (ohne Satz bleibt nichts zu speichern). */
  function saveEdit() {
    const result = finalizeEditedSession(session, last);
    if (result.exercises.length === 0) {
      toast("Trag zuerst bei mindestens einem Satz Werte ein.");
      return;
    }
    update(() => result);
    setFinished(true);
  }

  /** Datum, Beginn oder Dauer eines bearbeiteten Trainings ändern (Ende = Beginn + Dauer). */
  function setTiming(change: { date?: string; time?: string; minutes?: number }) {
    const current = berlinParts(session.startedAt);
    const minutes = change.minutes ?? Math.max(1, Math.round((new Date(session.endedAt ?? session.startedAt).getTime() - new Date(session.startedAt).getTime()) / 60000));
    const start = berlinToIso(change.date ?? current.date, change.time ?? current.time);
    if (!start || !(minutes >= 1 && minutes <= 600)) return;
    update((s) => ({ ...s, startedAt: start, endedAt: new Date(new Date(start).getTime() + minutes * 60_000).toISOString() }));
  }

  function discard() {
    startDiscard(async () => {
      try {
        const result = await deleteWorkoutAction(session.id);
        if (!result.ok) throw new Error();
        clearLocalWorkout(session.id);
        router.replace(edit ? "/sport/verlauf" : "/sport/plaene");
      } catch {
        toast.error("Verwerfen geht nur mit Netz. Versuch es gleich noch einmal.");
      }
    });
  }

  const elapsed = now == null ? null : Math.max(0, now - new Date(session.startedAt).getTime());
  const exerciseName = (id: string | number) => session.exercises.find((e) => e.id === id)?.exercise.name ?? "Übung";

  // Abgeschlossen, aber noch nicht hochgeladen (kein Netz)
  if (done) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background p-6 text-center">
        <div className="max-w-sm space-y-3">
          {state === "offline" ? <CloudOff className="mx-auto size-10 text-muted-foreground" aria-hidden /> : <Loader2 className="mx-auto size-10 animate-spin text-muted-foreground" aria-hidden />}
          <h1 className="text-2xl font-semibold">{edit ? "Training gespeichert" : "Training beendet"}</h1>
          <p className="text-muted-foreground">
            {state === "offline"
              ? "Es ist auf dem Handy gesichert und wird hochgeladen, sobald du wieder Netz hast. Du kannst die Seite offen lassen."
              : "Wird gespeichert …"}
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-[calc(9rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 border-b bg-background/95 px-2 pt-[max(0.375rem,env(safe-area-inset-top))] pb-1.5 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-1">
          <Link
            href={edit ? `/sport/verlauf/${session.id}` : "/sport/plaene"}
            aria-label={edit ? "Zurück zum Training (Änderungen sind gesichert)" : "Zu den Plänen (Training läuft weiter)"}
            className="grid size-11 shrink-0 place-items-center rounded-full transition hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-muted-foreground">{session.title}</p>
            <p className="flex items-center gap-2">
              {edit ? (
                <span className="font-heading text-2xl leading-tight font-semibold">Bearbeiten</span>
              ) : (
                <span className="font-heading text-2xl leading-tight font-semibold tabular-nums" aria-label="Trainingsdauer">
                  {elapsed == null ? "–:–" : formatCountdown(elapsed)}
                </span>
              )}
              <SyncBadge state={state} />
            </p>
          </div>
          <Button type="button" onClick={edit ? saveEdit : () => setConfirmFinish(true)} className="h-11 shrink-0 rounded-full px-5">
            {edit ? "Speichern" : "Beenden"}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-3 pt-4 md:px-4">
        {edit ? <TimingCard session={session} onChange={setTiming} /> : null}
        {edit ? (
          <p className="px-1 text-sm text-muted-foreground">
            Trag die Werte ein; beim Speichern zählen alle Sätze mit Werten, auch ohne Haken. Ein Haken bei leerem Satz übernimmt
            die hellen Werte vom letzten Mal.
          </p>
        ) : null}
        {session.exercises.length === 0 ? (
          <p className="rounded-3xl border border-dashed p-6 text-center text-muted-foreground">
            Noch keine Übungen. Füg unten die erste hinzu.
          </p>
        ) : (
          <DndContext
            id="dnd-training"
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[verticalOnly]}
            onDragEnd={onDragEnd}
            accessibility={{ announcements: announcements(exerciseName), screenReaderInstructions }}
          >
            <SortableContext items={session.exercises.map((e) => e.id)} strategy={verticalListSortingStrategy}>
              <ol className="space-y-4" aria-label="Übungen">
                {session.exercises.map((e) => (
                  <ExerciseCard
                    key={e.id}
                    entry={e}
                    last={last}
                    noteOpen={openNotes.has(e.id) || e.note.trim() !== ""}
                    onToggleSet={toggleSet}
                    onChangeSet={(setId, patch) => updateSet(e.id, setId, patch)}
                    onAddSet={() => addSet(e)}
                    onRemoveSet={() => removeSet(e)}
                    onWarmups={() => addWarmups(e)}
                    onReplace={() => setPicker({ replaceId: e.id })}
                    onRemove={() => removeExercise(e)}
                    onShowNote={() => setOpenNotes((prev) => new Set(prev).add(e.id))}
                    onNote={(note) => update((s) => withExercise(s, e.id, (x) => ({ ...x, note })))}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}

        <Button type="button" variant="outline" className="h-14 w-full rounded-3xl border-dashed text-base" onClick={() => setPicker({ replaceId: null })}>
          <Plus aria-hidden />
          Übung hinzufügen
        </Button>

        <div className="rounded-3xl border bg-card p-4">
          <label htmlFor="training-note" className="text-sm font-medium text-muted-foreground">
            Notiz zum Training <span className="font-normal">· optional</span>
          </label>
          <textarea
            id="training-note"
            value={session.note}
            maxLength={1000}
            rows={2}
            onChange={(ev) => update((s) => ({ ...s, note: ev.target.value }))}
            placeholder="z. B. Schulter gezwickt, nächstes Mal leichter"
            className="mt-1 block w-full resize-none bg-transparent text-base outline-none [field-sizing:content] placeholder:text-muted-foreground/70"
          />
        </div>

        <Button type="button" variant="ghost" className="w-full text-destructive" onClick={() => setConfirmDiscard(true)}>
          <Trash2 aria-hidden />
          {edit ? "Training löschen" : "Training verwerfen"}
        </Button>
      </main>

      <RestBar rest={rest} />

      <ExercisePicker
        open={picker != null}
        onOpenChange={(o) => {
          if (!o) setPicker(null);
        }}
        exercises={exercises}
        onCreated={(x) => setExercises((prev) => [...prev, x])}
        onSelect={onPick}
        mode={picker?.replaceId ? "replace" : "add"}
      />

      <Dialog open={confirmFinish} onOpenChange={setConfirmFinish}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Training beenden?</DialogTitle>
            <DialogDescription>
              {summary.sets === 0
                ? "Du hast noch keinen Satz abgehakt. Ohne erledigte Sätze wird nichts gespeichert."
                : "Nicht abgehakte Sätze werden nicht gespeichert."}
            </DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Dauer" value={workoutDuration(summary.durationSeconds)} />
            <Stat label="Sätze" value={String(summary.sets)} />
            <Stat label="Volumen" value={`${formatNumber(Math.round(summary.volumeKg), 0)} kg`} />
          </dl>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmFinish(false)}>
              Weiter trainieren
            </Button>
            {summary.sets === 0 ? (
              <Button type="button" variant="destructive" onClick={discard} disabled={discarding}>
                Verwerfen
              </Button>
            ) : (
              <Button type="button" onClick={finish}>
                Beenden und speichern
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit ? "Training löschen?" : "Training verwerfen?"}</DialogTitle>
            <DialogDescription>Alle Sätze dieses Trainings werden gelöscht. Das lässt sich nicht rückgängig machen.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmDiscard(false)}>
              Behalten
            </Button>
            <Button type="button" variant="destructive" onClick={discard} disabled={discarding}>
              {edit ? "Löschen" : "Verwerfen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Bearbeiten: Datum, Beginn und Dauer des Trainings (deutsche Zeit). */
function TimingCard({ session, onChange }: { session: Session; onChange: (change: { date?: string; time?: string; minutes?: number }) => void }) {
  const { date, time } = berlinParts(session.startedAt);
  const minutes = Math.max(1, Math.round((new Date(session.endedAt ?? session.startedAt).getTime() - new Date(session.startedAt).getTime()) / 60000));
  const field = "h-11 w-full min-w-0 rounded-xl border border-input bg-background px-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
  return (
    <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.9fr)] gap-2 rounded-3xl border bg-card p-3">
      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
        Datum
        <input type="date" value={date} max={berlinParts(new Date().toISOString()).date} onChange={(e) => e.target.value && onChange({ date: e.target.value })} className={field} />
      </label>
      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
        Beginn
        <input type="time" value={time} onChange={(e) => e.target.value && onChange({ time: e.target.value })} className={field} />
      </label>
      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
        Minuten
        <input
          inputMode="numeric"
          defaultValue={minutes}
          onBlur={(e) => {
            const v = Number.parseInt(e.target.value, 10);
            if (v >= 1 && v <= 600) onChange({ minutes: v });
            else e.target.value = String(minutes);
          }}
          className={cn(field, "text-center tabular-nums")}
        />
      </label>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-heading text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function SyncBadge({ state }: { state: SyncState }) {
  if (state === "offline") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs whitespace-nowrap text-muted-foreground"
        role="status"
        title="Auf dem Handy gesichert, wird hochgeladen, sobald Netz da ist"
      >
        <CloudOff className="size-3.5" aria-hidden />
        offline gesichert
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" role="status">
      {state === "saving" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <CloudCheck className="size-3.5 text-sage" aria-hidden />}
      <span className="sr-only">{state === "saving" ? "wird gespeichert" : "gespeichert"}</span>
    </span>
  );
}

/** Pausentimer unten: Restzeit groß, Balken, −15 s / +15 s, Überspringen. */
function RestBar({ rest }: { rest: ReturnType<typeof useRestTimer> }) {
  if (!rest.timer) return null;
  const share = rest.timer.totalMs > 0 ? rest.remainingMs / rest.timer.totalMs : 0;
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 px-3 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgb(0_0_0/0.06)] backdrop-blur"
      role="timer"
      aria-live="polite"
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full transition-[width]", rest.finished ? "bg-sage" : "bg-primary")} style={{ width: `${share * 100}%` }} />
        </div>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">{rest.finished ? "Pause vorbei" : `Pause · ${rest.timer.label}`}</p>
            <p className="font-heading text-3xl leading-none font-semibold tabular-nums">{rest.finished ? "Weiter geht’s" : formatCountdown(rest.remainingMs)}</p>
          </div>
          {rest.finished ? null : (
            <>
              <Button type="button" variant="outline" className="h-11 rounded-full px-3" onClick={() => rest.add(-15)} aria-label="15 Sekunden weniger">
                −15
              </Button>
              <Button type="button" variant="outline" className="h-11 rounded-full px-3" onClick={() => rest.add(15)} aria-label="15 Sekunden mehr">
                +15
              </Button>
            </>
          )}
          <Button type="button" className="h-11 rounded-full px-4" onClick={rest.stop}>
            {rest.finished ? "OK" : "Überspringen"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Eine Übung im Training: Kopf mit Griff und Menü, Sätze mit Vorgaben vom letzten Mal, Satz hinzufügen/entfernen. */
function ExerciseCard({
  entry,
  last,
  noteOpen,
  onToggleSet,
  onChangeSet,
  onAddSet,
  onRemoveSet,
  onWarmups,
  onReplace,
  onRemove,
  onShowNote,
  onNote,
}: {
  entry: SessionExercise;
  last: Record<string, LastSet[]>;
  noteOpen: boolean;
  onToggleSet: (e: SessionExercise, set: SessionSet, normalIndex: number) => void;
  onChangeSet: (setId: string, patch: Partial<SessionSet>) => void;
  onAddSet: () => void;
  onRemoveSet: () => void;
  onWarmups: () => void;
  onReplace: () => void;
  onRemove: () => void;
  onShowNote: () => void;
  onNote: (note: string) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id });
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition };
  const { exercise } = entry;
  const tracking = exercise.tracking;
  const timed = isTimed(tracking);
  const target = timed
    ? entry.targetSeconds
      ? mmss(entry.targetSeconds)
      : null
    : repsRange(entry.repsMin, entry.repsMax)
      ? `${repsRange(entry.repsMin, entry.repsMax)} Wdh.`
      : null;
  const rest = restLabel(entry.restSeconds);
  const done = entry.sets.filter((s) => s.done && s.kind === "normal").length;
  const normal = entry.sets.filter((s) => s.kind === "normal").length;
  const hasWarmups = entry.sets.some((s) => s.kind === "warmup");
  const lastDate = last[exercise.id]?.length ? true : false;

  // Spalten je nach Erfassung. Strecke und Zeit: drei Felder (km/h, km, Zeit) ohne „Zuletzt“-Spalte, sonst passt es
  // am Handy nicht; die Werte vom letzten Mal stehen ohnehin hell in den Feldern.
  const cardio = tracking === "distance_time";
  const columns = cardio
    ? "grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_2.75rem]"
    : tracking === "time"
        ? "grid-cols-[2.25rem_minmax(0,1fr)_5.5rem_2.75rem]"
        : "grid-cols-[2.25rem_minmax(0,1fr)_4.5rem_3.75rem_2.75rem]";

  let normalIndex = 0;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn("rounded-3xl border bg-card", isDragging && "z-10 shadow-xl ring-1 ring-primary/40", done === normal && normal > 0 && "border-sage/50")}
    >
      <div className="flex items-start gap-1 pt-2 pr-1.5 pl-1">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`${exercise.name} verschieben`}
          className="grid size-11 shrink-0 cursor-grab touch-none place-items-center rounded-xl text-muted-foreground/60 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing"
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
        <div className="min-w-0 flex-1 py-1">
          <h2 className="font-sans text-lg leading-snug font-semibold tracking-normal wrap-anywhere">{exercise.name}</h2>
          <p className="text-sm text-muted-foreground">
            {MUSCLE_LABELS[exercise.muscleGroup]}
            {target ? ` · ${target}` : ""}
            {rest ? ` · ${rest}` : ""}
            <span className="tabular-nums"> · {done}/{normal}</span>
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full" aria-label={`Aktionen für ${exercise.name}`} />}>
            <EllipsisVertical className="size-5" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 rounded-xl p-1.5">
            {tracking === "weight_reps" ? (
              <DropdownMenuItem className={ITEM} onClick={onWarmups}>
                <Flame aria-hidden />
                Aufwärmsätze berechnen
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem className={ITEM} onClick={onReplace}>
              <Repeat aria-hidden />
              Austauschen
            </DropdownMenuItem>
            <DropdownMenuItem className={ITEM} onClick={onShowNote}>
              <StickyNote aria-hidden />
              Notiz
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className={ITEM} variant="destructive" onClick={onRemove}>
              <Trash2 aria-hidden />
              Entfernen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {entry.warmup && !hasWarmups && tracking === "weight_reps" ? (
        <div className="px-4 pb-1">
          <Button type="button" variant="ghost" size="sm" className="-ml-2 text-primary" onClick={onWarmups}>
            <Flame aria-hidden />
            Aufwärmsätze berechnen
          </Button>
        </div>
      ) : null}

      {noteOpen ? (
        <div className="px-4 pb-2">
          <input
            value={entry.note}
            maxLength={200}
            onChange={(ev) => onNote(ev.target.value)}
            placeholder="Notiz zur Übung, z. B. Sitz Stufe 4"
            aria-label={`Notiz zu ${exercise.name}`}
            className="h-10 w-full rounded-xl bg-muted px-3 text-base outline-none placeholder:text-muted-foreground/70 focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      ) : null}

      <div className="px-3 pb-2">
        <div className={cn("grid items-center gap-1.5 px-1 pb-1 text-xs font-medium text-muted-foreground", columns)} aria-hidden>
          <span className="text-center">Satz</span>
          {cardio ? null : <span>{lastDate ? "Zuletzt" : ""}</span>}
          {cardio ? (
            <>
              <span className="text-center">km/h</span>
              <span className="text-center">km</span>
              <span className="text-center">Zeit</span>
            </>
          ) : tracking === "time" ? (
            <span className="text-center">Zeit</span>
          ) : (
            <>
              <span className="text-center">{tracking === "bodyweight_reps" ? "+kg" : "kg"}</span>
              <span className="text-center">Wdh.</span>
            </>
          )}
          <span />
        </div>
        <ul className="space-y-1">
          {entry.sets.map((set) => {
            const index = set.kind === "normal" ? normalIndex++ : -1;
            const prev = set.kind === "normal" ? lastFor(last, exercise.id, index) : null;
            const label = set.kind === "warmup" ? "A" : String(index + 1);
            const ph = prev ? setInputs(prev) : null;
            const field = (key: "weight" | "reps" | "seconds" | "distance" | "speed", aria: string, mode: "decimal" | "numeric" | "text") => (
              <input
                inputMode={mode}
                value={set[key] ?? ""}
                placeholder={ph?.[key] || (key === "seconds" ? "0:00" : "")}
                onChange={(ev) => onChangeSet(set.id, { [key]: ev.target.value })}
                aria-label={`${aria}, ${set.kind === "warmup" ? "Aufwärmsatz" : `Satz ${index + 1}`}`}
                className={cn(inputClass, set.done && "border-transparent bg-transparent")}
              />
            );
            return (
              <li
                key={set.id}
                className={cn("grid items-center gap-1.5 rounded-2xl px-1 py-0.5 transition-colors", columns, set.done && "bg-sage/12")}
              >
                <span
                  className={cn("text-center text-sm font-semibold tabular-nums", set.kind === "warmup" ? "text-primary" : "text-muted-foreground")}
                  title={set.kind === "warmup" ? "Aufwärmsatz" : undefined}
                >
                  {label}
                </span>
                {cardio ? null : <span className="truncate text-sm text-muted-foreground/80 tabular-nums">{prev ? formatSet(prev, tracking) : ""}</span>}
                {cardio ? (
                  <>
                    {field("speed", "Geschwindigkeit in km/h", "decimal")}
                    {field("distance", "Strecke in km", "decimal")}
                    {field("seconds", "Zeit", "text")}
                  </>
                ) : tracking === "time" ? (
                  field("seconds", "Zeit", "text")
                ) : (
                  <>
                    {field("weight", tracking === "bodyweight_reps" ? "Zusatzgewicht in kg" : "Gewicht in kg", "decimal")}
                    {field("reps", "Wiederholungen", "numeric")}
                  </>
                )}
                <button
                  type="button"
                  onClick={() => onToggleSet(entry, set, index)}
                  aria-pressed={set.done}
                  aria-label={`${set.kind === "warmup" ? "Aufwärmsatz" : `Satz ${index + 1}`} ${set.done ? "nicht erledigt" : "erledigt"}`}
                  className={cn(
                    "grid size-11 place-items-center rounded-xl border-2 transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    set.done ? "border-sage bg-sage text-sage-foreground" : "border-input text-muted-foreground/50 hover:border-sage hover:text-sage",
                  )}
                >
                  <Check className="size-5" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-1 flex gap-2">
          <Button type="button" variant="ghost" className="h-11 flex-1 rounded-2xl" onClick={onAddSet}>
            <Plus aria-hidden />
            Satz
          </Button>
          <Button type="button" variant="ghost" className="h-11 rounded-2xl text-muted-foreground" onClick={onRemoveSet} disabled={entry.sets.length === 0} aria-label="Satz entfernen">
            <Minus aria-hidden />
          </Button>
        </div>
        <p className="sr-only">{EQUIPMENT_LABELS[exercise.equipment]}</p>
      </div>
    </li>
  );
}
