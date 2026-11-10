"use client";

import { useState, useTransition } from "react";
import { Pill, Plus, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteHabitAction, saveHabitAction, saveRoutineAction } from "@/app/(app)/sport/habits/actions";
import { SegmentToggle } from "@/components/layout/list-blocks";
import { chipClass } from "@/components/recipes/chip-select";
import { EditorSheet, FieldHeading, RadioSegments } from "@/components/recipes/editor/editor-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DRINK_COLOR_KEYS, type DrinkColor } from "@/lib/domain/drinks";
import {
  DAYTIMES,
  daytimeOfTime,
  FREQUENCIES,
  HABIT_PRESETS,
  routinePresets,
  targetForRoutines,
  WEEKDAYS,
  type Daytime,
  type Habit,
  type HabitFrequency,
  type HabitKind,
  type HabitRoutine,
} from "@/lib/domain/habits";
import { cn } from "@/lib/utils";
import { ColorChoice, CountStepper, HabitIcon } from "./habit-parts";

/** Neues Habit: Art und optional die Routine, zu der es gehört. */
export type HabitDraft = { kind: HabitKind; routineId?: string | null };

type Form = {
  kind: HabitKind;
  name: string;
  dose: string;
  frequency: HabitFrequency;
  target: number;
  weekdays: number[];
  daytime: Daytime | null;
  atTime: string;
  routineIds: string[];
  color: string;
  notes: string;
  paused: boolean;
};

const ALL_DAYS = WEEKDAYS.map((w) => w.n);
const norm = (name: string) => name.trim().toLocaleLowerCase("de");

function initialForm(habit: Habit | null, usedColors: string[], kind: HabitKind, routineId: string | null): Form {
  if (!habit) {
    const color = DRINK_COLOR_KEYS.find((c) => !usedColors.includes(c)) ?? "blau";
    return { kind, name: "", dose: "", frequency: "daily", target: 1, weekdays: ALL_DAYS, daytime: null, atTime: "", routineIds: routineId ? [routineId] : [], color, notes: "", paused: false };
  }
  return {
    kind: habit.kind,
    name: habit.name,
    dose: habit.dose ?? "",
    frequency: habit.frequency,
    target: habit.target,
    weekdays: habit.weekdays.length ? habit.weekdays : ALL_DAYS,
    daytime: habit.daytime,
    atTime: habit.atTime ?? "",
    routineIds: habit.routineIds,
    color: habit.color,
    notes: habit.notes ?? "",
    paused: habit.pausedOn != null,
  };
}

/**
 * Gewohnheit oder Supplement anlegen bzw. bearbeiten: Art, Name (mit Vorschlägen), Dosis, Rhythmus und wie oft,
 * Wochentage (täglich), Routinen (täglich, optional, auch mehrere) oder Tageszeit und Uhrzeit (optional), Farbe,
 * Notizen; beim Bearbeiten Pausieren und Löschen. Neuer Punkt einer Routine: Vorhandenes lässt sich direkt in die
 * Routine übernehmen (statt es doppelt anzulegen).
 */
export function HabitSheet({
  habit,
  habits,
  routines,
  defaultKind = "habit",
  defaultRoutineId = null,
  onClose,
}: {
  habit: Habit | null;
  habits: Habit[];
  routines: HabitRoutine[];
  defaultKind?: HabitKind;
  /** neues Habit gleich als Punkt dieser Routine */
  defaultRoutineId?: string | null;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [form, setForm] = useState<Form>(() => initialForm(habit, habits.map((h) => h.color), defaultKind, defaultRoutineId));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const frequency = FREQUENCIES.find((f) => f.key === form.frequency) ?? FREQUENCIES[0];
  const noDays = form.frequency === "daily" && form.weekdays.length === 0;
  const patch = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));
  const err = (key: string) => errors[key]?.[0];
  const usedNames = new Set(habits.map((h) => norm(h.name)));
  const draftRoutine = !habit && defaultRoutineId ? (routines.find((r) => r.id === defaultRoutineId) ?? null) : null;
  const inRoutines = form.frequency === "daily" && form.routineIds.length > 0;
  // Neuer Punkt einer Routine: tägliche Habits, die noch nicht drinstehen
  const existing = draftRoutine ? habits.filter((h) => h.frequency === "daily" && h.pausedOn == null && !draftRoutine.habitIds.includes(h.id)) : [];
  const sameName = !habit ? habits.find((h) => norm(h.name) === norm(form.name) && form.name.trim() !== "") : undefined;
  const firstRoutine = routines.find((r) => form.routineIds.includes(r.id));

  function close() {
    setOpen(false);
    setTimeout(onClose, 300);
  }

  function setFrequency(next: HabitFrequency) {
    const max = FREQUENCIES.find((f) => f.key === next)?.max ?? 1;
    // Routinen gibt es nur bei täglichen
    patch({ frequency: next, target: Math.min(form.target, max), routineIds: next === "daily" ? form.routineIds : [] });
  }

  function toggleRoutine(id: string) {
    const next = form.routineIds.includes(id) ? form.routineIds.filter((r) => r !== id) : [...form.routineIds, id];
    // Tagesziel folgt der Zahl der Routinen (je Routine ein Häkchen)
    patch({ routineIds: next, target: Math.min(frequency.max, targetForRoutines(form.target, form.routineIds.length, next.length)) });
  }

  function toggleDay(n: number) {
    patch({ weekdays: form.weekdays.includes(n) ? form.weekdays.filter((d) => d !== n) : [...form.weekdays, n].sort((a, b) => a - b) });
  }

  function setTime(value: string) {
    // Mit Uhrzeit passt die Tageszeit sich an (07:30 → morgens)
    patch(value ? { atTime: value, daytime: daytimeOfTime(value) } : { atTime: "" });
  }

  /** Vorhandenes Habit in die Routine übernehmen. */
  function addExisting(h: Habit) {
    if (!draftRoutine) return;
    startTransition(async () => {
      const result = await saveRoutineAction(draftRoutine.id, {
        name: draftRoutine.name,
        daytime: draftRoutine.daytime,
        color: draftRoutine.color as DrinkColor,
        habitIds: [...draftRoutine.habitIds, h.id],
      });
      if (!result.ok) {
        toast.error(result.message ?? "Das konnte nicht gespeichert werden.");
        return;
      }
      toast.success(`${h.name} steht jetzt auch in der Routine ${draftRoutine.name}`);
      close();
    });
  }

  function save() {
    startTransition(async () => {
      const result = await saveHabitAction(habit?.id ?? null, {
        name: form.name,
        kind: form.kind,
        frequency: form.frequency,
        target: form.target,
        weekdays: form.frequency === "daily" ? form.weekdays : [],
        daytime: form.daytime,
        atTime: inRoutines ? null : form.atTime || null,
        routineIds: form.frequency === "daily" ? form.routineIds : [],
        dose: form.kind === "supplement" ? form.dose : null,
        notes: form.notes,
        color: form.color as DrinkColor,
        paused: form.paused,
      });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message ?? "Bitte die markierten Felder prüfen.");
        return;
      }
      toast.success(habit ? "Gespeichert" : `${form.name.trim()} hinzugefügt`);
      close();
    });
  }

  function remove() {
    if (!habit) return;
    startTransition(async () => {
      const result = await deleteHabitAction(habit.id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(`${habit.name} gelöscht`);
      close();
    });
  }

  return (
    <EditorSheet
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : close())}
      title={habit ? habit.name : draftRoutine ? `Punkt für „${draftRoutine.name}“` : form.kind === "supplement" ? "Supplement hinzufügen" : "Gewohnheit hinzufügen"}
      description={habit ? "Änderungen gelten ab sofort; Abgehaktes bleibt." : draftRoutine ? "Neue Punkte kommen ans Ende der Routine." : "Was möchtest du regelmäßig tun oder nehmen?"}
      footer={
        <>
          {habit ? (
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
              <Button type="button" variant="outline" size="icon-lg" onClick={() => setConfirmDelete(true)} aria-label="Löschen">
                <Trash2 aria-hidden />
              </Button>
            )
          ) : null}
          {!confirmDelete ? (
            <Button type="button" size="lg" onClick={save} disabled={pending || form.name.trim() === "" || noDays} className="flex-1">
              Speichern
            </Button>
          ) : null}
        </>
      }
    >
      {confirmDelete ? (
        <p className="rounded-2xl bg-destructive/10 p-3 text-sm">
          Damit verschwinden auch alle Häkchen von {habit?.name} aus Verlauf und Statistik
          {habit && habit.routineIds.length ? ", und es fällt aus seinen Routinen" : ""}. Wenn du nur aufhören willst: lieber pausieren.
        </p>
      ) : null}

      {existing.length > 0 ? (
        <section>
          <FieldHeading aside="steht dann in beiden">Vorhandenes übernehmen</FieldHeading>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {existing.map((h) => (
              <button key={h.id} type="button" onClick={() => addExisting(h)} disabled={pending} className={chipClass(false)}>
                <HabitIcon kind={h.kind} color={h.color} className="size-5 rounded-md [&_svg]:size-3" />
                {h.name}
                <Plus className="size-3.5 text-muted-foreground" aria-hidden />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <SegmentToggle
        label="Art"
        value={form.kind}
        onChange={(kind) => patch({ kind })}
        options={[
          { value: "habit", label: "Gewohnheit", icon: Sparkles, showLabel: true },
          { value: "supplement", label: "Supplement", icon: Pill, showLabel: true },
        ]}
      />

      {!habit ? (
        <section>
          <FieldHeading>Vorschläge</FieldHeading>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(form.kind === "habit" && firstRoutine ? routinePresets(firstRoutine.daytime) : HABIT_PRESETS[form.kind])
              .filter((p) => !usedNames.has(norm(p.name)))
              .map((p) => (
                <button
                  key={p.name}
                  type="button"
                  aria-pressed={form.name === p.name}
                  onClick={() => patch({ name: p.name, dose: p.dose ?? form.dose, daytime: p.daytime ?? form.daytime })}
                  className={chipClass(form.name === p.name)}
                >
                  {p.name}
                  {p.dose ? <span className="text-muted-foreground">{p.dose}</span> : null}
                </button>
              ))}
          </div>
        </section>
      ) : null}

      <div className={cn("grid gap-3", form.kind === "supplement" && "grid-cols-[minmax(0,1fr)_8rem]")}>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="habit-name">Name</Label>
          <Input
            id="habit-name"
            value={form.name}
            maxLength={60}
            onChange={(e) => patch({ name: e.target.value })}
            className="h-12 text-base"
            aria-invalid={Boolean(err("name"))}
            placeholder={form.kind === "supplement" ? "z. B. Kreatin" : "z. B. Dehnen"}
          />
        </div>
        {form.kind === "supplement" ? (
          <div className="grid min-w-0 gap-1.5">
            <Label htmlFor="habit-dose">Dosis</Label>
            <Input id="habit-dose" value={form.dose} maxLength={40} onChange={(e) => patch({ dose: e.target.value })} className="h-12 text-base" placeholder="5 g" />
          </div>
        ) : null}
        {err("name") ? <p className="text-sm text-destructive">{err("name")}</p> : null}
      </div>
      {sameName ? (
        <p className="-mt-2 rounded-2xl bg-muted/60 p-3 text-sm">
          {sameName.name} gibt es schon.{" "}
          {draftRoutine && existing.some((h) => h.id === sameName.id) ? (
            <button type="button" onClick={() => addExisting(sameName)} className="font-medium text-primary hover:underline">
              In „{draftRoutine.name}“ übernehmen
            </button>
          ) : (
            "Ein Habit kann in mehreren Routinen stehen und zählt dann nur einmal."
          )}
        </p>
      ) : null}

      <section className="space-y-3">
        <FieldHeading>Rhythmus</FieldHeading>
        <RadioSegments label="Rhythmus" value={form.frequency} onChange={setFrequency} options={FREQUENCIES.map((f) => ({ value: f.key, label: f.label }))} />
        <CountStepper value={form.target} min={inRoutines ? form.routineIds.length : 1} max={frequency.max} onChange={(target) => patch({ target })} unit={frequency.unit} label="Wie oft" />
        {inRoutines && form.routineIds.length > 1 ? <p className="text-sm text-muted-foreground">Mindestens {form.routineIds.length}×: in jeder Routine ein Häkchen.</p> : null}
        {err("target") ? <p className="text-sm text-destructive">{err("target")}</p> : null}
      </section>

      {form.frequency === "daily" ? (
        <section>
          <FieldHeading aside={form.weekdays.length === 7 ? "jeden Tag" : undefined}>An diesen Tagen</FieldHeading>
          <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Wochentage">
            {WEEKDAYS.map((w) => {
              const on = form.weekdays.includes(w.n);
              return (
                <button
                  key={w.n}
                  type="button"
                  aria-pressed={on}
                  aria-label={w.long}
                  onClick={() => toggleDay(w.n)}
                  className={cn(
                    "h-11 rounded-full border text-sm font-medium transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted",
                  )}
                >
                  {w.short}
                </button>
              );
            })}
          </div>
          {noDays ? <p className="mt-2 text-sm text-destructive">Mindestens einen Tag wählen.</p> : null}
        </section>
      ) : null}

      {form.frequency === "daily" && routines.length > 0 ? (
        <section>
          <FieldHeading aside="optional, auch mehrere">Routinen</FieldHeading>
          <div className="flex flex-wrap gap-2">
            {routines.map((r) => (
              <button key={r.id} type="button" aria-pressed={form.routineIds.includes(r.id)} onClick={() => toggleRoutine(r.id)} className={chipClass(form.routineIds.includes(r.id))}>
                {r.name}
              </button>
            ))}
          </div>
          {inRoutines ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Steht unter „Heute“ in {form.routineIds.length > 1 ? "diesen Routinen" : "dieser Routine"}, dort per Drag & Drop sortierbar. In der Statistik zählt es einmal.
            </p>
          ) : null}
        </section>
      ) : null}

      {!inRoutines ? (
        <section>
          <FieldHeading aside="optional">Tageszeit</FieldHeading>
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={form.daytime == null} onClick={() => patch({ daytime: null, atTime: "" })} className={chipClass(form.daytime == null)}>
              Jederzeit
            </button>
            {DAYTIMES.map((d) => (
              <button
                key={d.key}
                type="button"
                aria-pressed={form.daytime === d.key}
                // Andere Tageszeit als die Uhrzeit: Uhrzeit verwerfen
                onClick={() => patch({ daytime: d.key, atTime: form.atTime && daytimeOfTime(form.atTime) !== d.key ? "" : form.atTime })}
                className={chipClass(form.daytime === d.key)}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Label htmlFor="habit-time" className="w-20 shrink-0">
              Uhrzeit
            </Label>
            <Input id="habit-time" type="time" value={form.atTime} onChange={(e) => setTime(e.target.value)} className="h-12 max-w-40 min-w-0 px-3 text-base" />
            {form.atTime ? (
              <Button type="button" variant="ghost" size="icon" onClick={() => setTime("")} aria-label="Uhrzeit entfernen">
                <X aria-hidden />
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      <section>
        <FieldHeading>Farbe</FieldHeading>
        <ColorChoice value={form.color} onChange={(color) => patch({ color })} />
      </section>

      <div className="grid gap-1.5">
        <Label htmlFor="habit-notes">Notizen</Label>
        <Textarea
          id="habit-notes"
          value={form.notes}
          maxLength={1000}
          onChange={(e) => patch({ notes: e.target.value })}
          className="min-h-24 text-base"
          placeholder={form.kind === "supplement" ? "z. B. mit dem Frühstück, Marke, wann nachkaufen" : "z. B. warum, wie, worauf achten"}
        />
      </div>

      {habit ? (
        <label className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border px-4 py-2">
          <span>
            <span className="block font-medium">Pausiert</span>
            <span className="block text-sm text-muted-foreground">Nicht unter „Heute“, zählt ab jetzt nicht in der Statistik</span>
          </span>
          <Switch checked={form.paused} onCheckedChange={(paused) => patch({ paused })} />
        </label>
      ) : null}
    </EditorSheet>
  );
}
