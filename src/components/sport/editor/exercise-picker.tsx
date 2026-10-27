"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, ChevronDown, Plus, SearchX } from "lucide-react";
import { createExerciseAction } from "@/app/(app)/sport/plaene/actions";
import { ChipRow, CountChip, groupHeadingClass, SearchField, TagLabel } from "@/components/layout/list-blocks";
import { EditorSheet, FieldHeading, RadioSegments } from "@/components/recipes/editor/editor-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  EQUIPMENT_LABELS,
  EQUIPMENT_ORDER,
  groupByMuscle,
  MUSCLE_LABELS,
  MUSCLE_ORDER,
  normalizeSearch,
  searchExercises,
  type Equipment,
  type ExerciseOption,
  type MuscleGroup,
  type Tracking,
} from "@/lib/domain/exercises";
import { cn } from "@/lib/utils";

const TRACKING_CHOICES: { value: Tracking; label: string }[] = [
  { value: "weight_reps", label: "Gewicht" },
  { value: "bodyweight_reps", label: "Körpergew." },
  { value: "time", label: "Zeit" },
  { value: "distance_time", label: "Strecke" },
];

type Form = { name: string; muscle: MuscleGroup | ""; equipment: Equipment | ""; tracking: Tracking };

/**
 * Übungen aus der Datenbank wählen: Suche, Muskelgruppe als wischbare Chips, ohne Filter nach Muskelgruppe in
 * aufklappbaren Abschnitten. Mehrfachauswahl („3 hinzufügen“); beim Austauschen genügt ein Tipp. Gibt es eine Übung
 * nicht, lässt sie sich selbst anlegen.
 */
export function ExercisePicker({
  open,
  onOpenChange,
  exercises,
  onCreated,
  onSelect,
  mode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercises: ExerciseOption[];
  /** neu angelegte Übung in die Liste des Editors übernehmen */
  onCreated: (exercise: ExerciseOption) => void;
  onSelect: (exercises: ExerciseOption[]) => void;
  /** add: mehrere wählen; replace: eine Übung austauschen */
  mode: "add" | "replace";
}) {
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [openGroups, setOpenGroups] = useState<Set<MuscleGroup>>(() => new Set());
  const [form, setForm] = useState<Form | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});
  const [formMessage, setFormMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  const filtering = normalizeSearch(query) !== "" || muscle !== null;
  const results = useMemo(() => searchExercises(exercises, query, muscle), [exercises, query, muscle]);
  const groups = useMemo(() => groupByMuscle(exercises), [exercises]);
  const counts = useMemo(() => {
    const byMuscle = new Map<MuscleGroup, number>();
    for (const m of MUSCLE_ORDER) byMuscle.set(m, searchExercises(exercises, query, m).length);
    return byMuscle;
  }, [exercises, query]);

  function reset() {
    setQuery("");
    setMuscle(null);
    setSelected([]);
    setOpenGroups(new Set());
    setForm(null);
    setFormErrors({});
    setFormMessage(undefined);
  }

  function close() {
    reset();
    onOpenChange(false);
  }

  function choose(exercise: ExerciseOption) {
    if (mode === "replace") {
      onSelect([exercise]);
      close();
      return;
    }
    setSelected((prev) => (prev.includes(exercise.id) ? prev.filter((id) => id !== exercise.id) : [...prev, exercise.id]));
  }

  function confirm() {
    const byId = new Map(exercises.map((e) => [e.id, e]));
    onSelect(selected.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])));
    close();
  }

  function saveForm() {
    if (!form) return;
    startTransition(async () => {
      const result = await createExerciseAction({
        name: form.name,
        muscle_group: form.muscle as MuscleGroup,
        equipment: form.equipment as Equipment,
        tracking: form.tracking,
      });
      if (!result.ok) {
        setFormErrors(result.fieldErrors ?? {});
        setFormMessage(result.message);
        return;
      }
      onCreated(result.exercise);
      setForm(null);
      setFormErrors({});
      setQuery(result.exercise.name);
      setMuscle(null);
      if (mode === "replace") {
        onSelect([result.exercise]);
        close();
      } else setSelected((prev) => [...prev, result.exercise.id]);
    });
  }

  const row = (e: ExerciseOption) => {
    const isSelected = selected.includes(e.id);
    return (
      <li key={e.id}>
        <button
          type="button"
          onClick={() => choose(e)}
          aria-pressed={mode === "add" ? isSelected : undefined}
          className="flex min-h-13 w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate font-medium">{e.name}</span>
              {e.own ? <TagLabel>Eigene</TagLabel> : null}
            </span>
            <span className="block truncate text-sm text-muted-foreground">
              {MUSCLE_LABELS[e.muscleGroup]} · {EQUIPMENT_LABELS[e.equipment]}
            </span>
          </span>
          {mode === "add" ? (
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full border-2 transition",
                isSelected ? "border-primary bg-primary text-primary-foreground" : "border-input",
              )}
              aria-hidden
            >
              {isSelected ? <Check className="size-4" /> : null}
            </span>
          ) : null}
        </button>
      </li>
    );
  };

  if (form) {
    return (
      <EditorSheet
        open={open}
        onOpenChange={(o) => (o ? onOpenChange(o) : close())}
        title="Eigene Übung"
        description="Sie steht danach in der Auswahl, auch für andere Mitglieder. Ändern kannst nur du sie."
        footer={
          <>
            <Button type="button" variant="outline" className="h-12 flex-1" onClick={() => setForm(null)} disabled={pending}>
              Zurück
            </Button>
            <Button type="button" className="h-12 flex-1" onClick={saveForm} disabled={pending}>
              {pending ? "Wird angelegt …" : "Anlegen"}
            </Button>
          </>
        }
      >
        {formMessage ? <p className="text-sm text-destructive">{formMessage}</p> : null}
        <div>
          <FieldHeading htmlFor="exercise-name">Name</FieldHeading>
          <Input
            id="exercise-name"
            value={form.name}
            maxLength={80}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="z. B. Bankdrücken (Kabel)"
            aria-invalid={Boolean(formErrors.name) || undefined}
          />
          {formErrors.name ? <p className="mt-1 text-sm text-destructive">{formErrors.name[0]}</p> : null}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <FieldHeading htmlFor="exercise-muscle">Muskelgruppe</FieldHeading>
            <NativeSelect
              id="exercise-muscle"
              value={form.muscle}
              onChange={(e) => setForm({ ...form, muscle: e.target.value as MuscleGroup })}
              aria-invalid={Boolean(formErrors.muscle_group) || undefined}
            >
              <option value="" disabled>
                Bitte wählen
              </option>
              {MUSCLE_ORDER.map((m) => (
                <option key={m} value={m}>
                  {MUSCLE_LABELS[m]}
                </option>
              ))}
            </NativeSelect>
            {formErrors.muscle_group ? <p className="mt-1 text-sm text-destructive">{formErrors.muscle_group[0]}</p> : null}
          </div>
          <div>
            <FieldHeading htmlFor="exercise-equipment">Gerät</FieldHeading>
            <NativeSelect
              id="exercise-equipment"
              value={form.equipment}
              onChange={(e) => setForm({ ...form, equipment: e.target.value as Equipment })}
              aria-invalid={Boolean(formErrors.equipment) || undefined}
            >
              <option value="" disabled>
                Bitte wählen
              </option>
              {EQUIPMENT_ORDER.map((m) => (
                <option key={m} value={m}>
                  {EQUIPMENT_LABELS[m]}
                </option>
              ))}
            </NativeSelect>
            {formErrors.equipment ? <p className="mt-1 text-sm text-destructive">{formErrors.equipment[0]}</p> : null}
          </div>
        </div>
        <div>
          <FieldHeading>Erfassen als</FieldHeading>
          <RadioSegments label="Erfassen als" value={form.tracking} options={TRACKING_CHOICES} onChange={(tracking) => setForm({ ...form, tracking })} />
        </div>
      </EditorSheet>
    );
  }

  return (
    <EditorSheet
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(o) : close())}
      title={mode === "replace" ? "Übung austauschen" : "Übungen hinzufügen"}
      description={mode === "replace" ? "Tippe die neue Übung an." : "Tippe alle Übungen an, die du hinzufügen möchtest."}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1"
            onClick={() => setForm({ name: query.trim(), muscle: muscle ?? "", equipment: "", tracking: "weight_reps" })}
          >
            <Plus aria-hidden />
            Eigene Übung
          </Button>
          {mode === "add" ? (
            <Button type="button" className="h-12 flex-1" onClick={confirm} disabled={selected.length === 0}>
              {selected.length === 0 ? "Hinzufügen" : `${selected.length} hinzufügen`}
            </Button>
          ) : null}
        </>
      }
    >
      {/* grid-cols-1 = eine Spalte mit minmax(0, 1fr): sonst wächst sie mit dem längsten Übungsnamen über den Rand */}
      <div className="grid grid-cols-1 gap-3">
        <SearchField value={query} onChange={setQuery} placeholder="Übung suchen …" label="Übung suchen" />
        <ChipRow label="Muskelgruppe">
          <CountChip active={muscle === null} count={searchExercises(exercises, query).length} onClick={() => setMuscle(null)}>
            Alle
          </CountChip>
          {MUSCLE_ORDER.filter((m) => (counts.get(m) ?? 0) > 0 || m === muscle).map((m) => (
            <CountChip key={m} active={muscle === m} count={counts.get(m) ?? 0} onClick={() => setMuscle(muscle === m ? null : m)}>
              {MUSCLE_LABELS[m]}
            </CountChip>
          ))}
        </ChipRow>
      </div>

      {filtering ? (
        results.length > 0 ? (
          <ul className="divide-y overflow-hidden rounded-2xl border" aria-label="Treffer">
            {results.map(row)}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
            <SearchX className="size-8" aria-hidden />
            <p>Keine Übung passt. Leg sie mit „Eigene Übung“ an.</p>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {groups.map(({ muscle: m, items }) => {
            const expanded = openGroups.has(m);
            const listId = `uebungen-${m}`;
            const chosen = items.filter((e) => selected.includes(e.id)).length;
            return (
              <section key={m} aria-label={MUSCLE_LABELS[m]}>
                <h3>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={listId}
                    onClick={() =>
                      setOpenGroups((prev) => {
                        const next = new Set(prev);
                        if (next.has(m)) next.delete(m);
                        else next.add(m);
                        return next;
                      })
                    }
                    className={cn(groupHeadingClass, "rounded-lg transition hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none")}
                  >
                    <span className="truncate">{MUSCLE_LABELS[m]}</span>
                    <span className="flex shrink-0 items-center gap-1.5 font-medium tabular-nums">
                      {chosen > 0 ? <span className="text-primary normal-case">{chosen} gewählt ·</span> : null}
                      {items.length}
                      <ChevronDown className={cn("size-4 transition-transform", !expanded && "-rotate-90")} aria-hidden />
                    </span>
                  </button>
                </h3>
                {expanded ? (
                  <ul id={listId} className="mt-1 divide-y overflow-hidden rounded-2xl border">
                    {items.map(row)}
                  </ul>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </EditorSheet>
  );
}
