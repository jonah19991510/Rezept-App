"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArrowDownAZ, Check, ChevronDown, Dumbbell, LayoutList, SearchX, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createExerciseAction } from "@/app/(app)/sport/plaene/actions";
import { deleteExerciseAction, updateExerciseAction } from "@/app/(app)/sport/uebungen/actions";
import { EmptyState } from "@/components/layout/empty-state";
import { ChipRow, CountChip, GroupHeading, groupHeadingClass, ListCard, SearchField, SegmentToggle, TagLabel } from "@/components/layout/list-blocks";
import { chipClass } from "@/components/recipes/chip-select";
import { EditorSheet, FieldHeading, RadioSegments } from "@/components/recipes/editor/editor-parts";
import { FabButton } from "@/components/recipes/new-recipe-fab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  canEditExercise,
  EQUIPMENT_LABELS,
  EQUIPMENT_ORDER,
  filterLibrary,
  groupByMuscle,
  LIBRARY_VIEW_LABELS,
  matchesLibraryView,
  MUSCLE_LABELS,
  MUSCLE_ORDER,
  normalizeSearch,
  TRACKING_LABELS,
  type Equipment,
  type LibraryExercise,
  type LibraryView,
  type MuscleGroup,
  type Tracking,
} from "@/lib/domain/exercises";
import { cn } from "@/lib/utils";

const VIEWS: LibraryView[] = ["alle", "eigene", "plaene", "trainiert"];
const SORT_OPTIONS = [
  { value: "muskel", label: "Nach Muskelgruppe", icon: LayoutList },
  { value: "name", label: "A–Z", icon: ArrowDownAZ, showLabel: true },
] as const;
const TRACKING_CHOICES: { value: Tracking; label: string }[] = [
  { value: "weight_reps", label: "Gewicht" },
  { value: "bodyweight_reps", label: "Körpergew." },
  { value: "time", label: "Zeit" },
  { value: "distance_time", label: "Strecke" },
];

type Draft = { name: string; muscle: MuscleGroup | ""; equipment: Equipment | ""; tracking: Tracking; secondary: MuscleGroup[] };

const draftOf = (e: LibraryExercise | null): Draft =>
  e
    ? { name: e.name, muscle: e.muscleGroup, equipment: e.equipment, tracking: e.tracking, secondary: e.secondaryMuscles }
    : { name: "", muscle: "", equipment: "", tracking: "weight_reps", secondary: [] };

function usage(e: LibraryExercise): string | null {
  const parts = [
    e.planCount ? (e.planCount === 1 ? "1 Plan" : `${e.planCount} Pläne`) : null,
    e.workoutCount ? `${e.workoutCount}× trainiert` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * Übungsdatenbank (Profilmenü im Sport-Bereich): Suche, Ansicht und Muskelgruppe als Chips, Liste nach Muskelgruppe
 * (aufklappbar) oder A–Z. Antippen öffnet die Übung; eigene (und als Admin der Grundbestand) lassen sich ändern und
 * löschen. Plus-Knopf: neue Übung.
 */
export function ExerciseLibrary({ exercises, isAdmin }: { exercises: LibraryExercise[]; isAdmin: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<LibraryView>("alle");
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [sort, setSort] = useState<"muskel" | "name">("muskel");
  const [openGroups, setOpenGroups] = useState<Set<MuscleGroup>>(() => new Set());
  const [sheet, setSheet] = useState<{ id: string | null; open: boolean } | null>(null);
  const [draft, setDraft] = useState<Draft>(draftOf(null));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();

  const shown = useMemo(() => filterLibrary(exercises, { query, view, muscle }), [exercises, query, view, muscle]);
  const filtering = normalizeSearch(query) !== "" || muscle !== null || view !== "alle";
  const muscles = MUSCLE_ORDER.filter((m) => exercises.some((e) => e.muscleGroup === m));
  const current = sheet?.id ? (exercises.find((e) => e.id === sheet.id) ?? null) : null;
  const editable = sheet?.id == null || (current != null && canEditExercise(current, isAdmin));

  function open(e: LibraryExercise | null) {
    setDraft(draftOf(e));
    setErrors({});
    setSheet({ id: e?.id ?? null, open: true });
  }

  function save() {
    const input = {
      name: draft.name,
      muscle_group: draft.muscle as MuscleGroup,
      equipment: draft.equipment as Equipment,
      tracking: draft.tracking,
      secondary_muscles: draft.secondary.filter((m) => m !== draft.muscle),
    };
    startTransition(async () => {
      const result = sheet?.id ? await updateExerciseAction(sheet.id, input) : await createExerciseAction(input);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        if (result.message) toast.error(result.message);
        return;
      }
      toast.success(sheet?.id ? "Gespeichert." : `„${draft.name.trim()}“ angelegt.`);
      setSheet(null);
      router.refresh();
    });
  }

  function remove() {
    if (!current) return;
    startTransition(async () => {
      const result = await deleteExerciseAction(current.id);
      if (!result.ok) {
        toast.error(result.message ?? "Das hat nicht geklappt.");
        return;
      }
      toast.success(`„${current.name}“ gelöscht.`);
      setSheet(null);
      router.refresh();
    });
  }

  const row = (e: LibraryExercise) => {
    const use = usage(e);
    return (
      <li key={e.id}>
        <button
          type="button"
          onClick={() => open(e)}
          className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate font-medium">{e.name}</span>
              {e.origin === "own" ? <TagLabel>Eigene</TagLabel> : null}
            </span>
            <span className="block truncate text-sm text-muted-foreground">
              {MUSCLE_LABELS[e.muscleGroup]} · {EQUIPMENT_LABELS[e.equipment]}
              {use ? ` · ${use}` : ""}
            </span>
          </span>
        </button>
      </li>
    );
  };

  return (
    // Unten Platz lassen, damit der schwebende Knopf die letzte Zeile nicht verdeckt
    <div className="space-y-4 pb-16 md:pb-20">
      <div className="space-y-3">
        <SearchField value={query} onChange={setQuery} placeholder="Übungen suchen …" label="Übungen suchen" />
        <ChipRow label="Anzeigen">
          {VIEWS.map((v) => (
            <CountChip key={v} active={view === v} count={exercises.filter((e) => matchesLibraryView(e, v)).length} onClick={() => setView(v)}>
              {LIBRARY_VIEW_LABELS[v]}
            </CountChip>
          ))}
        </ChipRow>
        <ChipRow label="Muskelgruppe">
          {muscles.map((m) => (
            <button key={m} type="button" aria-pressed={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)} className={chipClass(muscle === m)}>
              {MUSCLE_LABELS[m]}
            </button>
          ))}
        </ChipRow>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {shown.length === exercises.length ? `${exercises.length} Übungen` : `${shown.length} von ${exercises.length} Übungen`}
        </p>
        <SegmentToggle label="Sortierung" value={sort} options={SORT_OPTIONS} onChange={setSort} />
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={SearchX} title="Nichts gefunden">
          Keine Übung passt. Mit dem Plus-Knopf unten rechts legst du eine neue an.
        </EmptyState>
      ) : sort === "name" ? (
        <div className="space-y-4">
          {[...new Set(shown.map((e) => e.name.charAt(0).toLocaleUpperCase("de")))]
            .sort((a, b) => a.localeCompare(b, "de"))
            .map((letter) => {
              const items = shown.filter((e) => e.name.charAt(0).toLocaleUpperCase("de") === letter).sort((a, b) => a.name.localeCompare(b.name, "de"));
              return (
                <section key={letter} aria-label={letter}>
                  <GroupHeading aside={items.length}>{letter}</GroupHeading>
                  <ListCard className="mt-1">{items.map(row)}</ListCard>
                </section>
              );
            })}
        </div>
      ) : (
        <div className="space-y-2">
          {groupByMuscle(shown).map(({ muscle: m, items }) => {
            // Beim Suchen/Filtern sind alle Gruppen offen
            const expanded = filtering || openGroups.has(m);
            const listId = `uebungen-${m}`;
            return (
              <section key={m} aria-label={MUSCLE_LABELS[m]}>
                <h2>
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
                      {items.length}
                      <ChevronDown className={cn("size-4 transition-transform", !expanded && "-rotate-90")} aria-hidden />
                    </span>
                  </button>
                </h2>
                {expanded ? (
                  <ListCard id={listId} className="mt-1">
                    {items.map(row)}
                  </ListCard>
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      <FabButton label="Neue Übung" onClick={() => open(null)} />

      <EditorSheet
        open={Boolean(sheet?.open)}
        onOpenChange={(o) => setSheet((s) => (s ? { ...s, open: o } : s))}
        title={sheet?.id ? (editable ? "Übung bearbeiten" : (current?.name ?? "Übung")) : "Neue Übung"}
        description={
          current
            ? [
                current.origin === "seed" ? "Grundbestand" : current.origin === "own" ? "Von dir angelegt" : "Von jemand anderem angelegt",
                usage(current),
              ]
                .filter(Boolean)
                .join(" · ")
            : "Sie steht danach in der Auswahl, auch für andere aus der Runde."
        }
        footer={
          editable ? (
            <>
              {current ? (
                <Button type="button" variant="destructive" className="h-12" onClick={remove} disabled={pending} aria-label="Übung löschen">
                  <Trash2 aria-hidden />
                </Button>
              ) : null}
              <Button type="button" className="h-12 flex-1" onClick={save} disabled={pending}>
                {pending ? "Wird gespeichert …" : current ? "Speichern" : "Anlegen"}
              </Button>
            </>
          ) : (
            <Button type="button" className="h-12 flex-1" onClick={() => setSheet(null)}>
              Fertig
            </Button>
          )
        }
      >
        {editable ? (
          <>
            {current?.origin === "seed" ? (
              <p className="rounded-2xl bg-muted p-3 text-sm text-muted-foreground">
                Das ist eine Übung aus dem Grundbestand. Als Admin änderst du sie für alle aus der Runde.
              </p>
            ) : null}
            <div>
              <FieldHeading htmlFor="lib-name">Name</FieldHeading>
              <Input
                id="lib-name"
                value={draft.name}
                maxLength={80}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="z. B. Bankdrücken (Kabel)"
                aria-invalid={Boolean(errors.name) || undefined}
              />
              {errors.name ? <p className="mt-1 text-sm text-destructive">{errors.name[0]}</p> : null}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <FieldHeading htmlFor="lib-muscle">Muskelgruppe</FieldHeading>
                <NativeSelect
                  id="lib-muscle"
                  value={draft.muscle}
                  onChange={(e) => setDraft({ ...draft, muscle: e.target.value as MuscleGroup })}
                  aria-invalid={Boolean(errors.muscle_group) || undefined}
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
                {errors.muscle_group ? <p className="mt-1 text-sm text-destructive">{errors.muscle_group[0]}</p> : null}
              </div>
              <div>
                <FieldHeading htmlFor="lib-equipment">Gerät</FieldHeading>
                <NativeSelect
                  id="lib-equipment"
                  value={draft.equipment}
                  onChange={(e) => setDraft({ ...draft, equipment: e.target.value as Equipment })}
                  aria-invalid={Boolean(errors.equipment) || undefined}
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
                {errors.equipment ? <p className="mt-1 text-sm text-destructive">{errors.equipment[0]}</p> : null}
              </div>
            </div>
            <div>
              <FieldHeading>Erfassen als</FieldHeading>
              <RadioSegments label="Erfassen als" value={draft.tracking} options={TRACKING_CHOICES} onChange={(tracking) => setDraft({ ...draft, tracking })} />
              {current && current.workoutCount > 0 && draft.tracking !== current.tracking ? (
                <p className="mt-1 text-xs text-muted-foreground">Bisherige Trainings behalten ihre Werte; Statistik und Vorgaben richten sich nach der neuen Erfassung.</p>
              ) : null}
            </div>
            <div>
              <FieldHeading aside="optional">Nebenmuskeln</FieldHeading>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Nebenmuskeln">
                {MUSCLE_ORDER.filter((m) => m !== draft.muscle).map((m) => {
                  const on = draft.secondary.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setDraft({ ...draft, secondary: on ? draft.secondary.filter((x) => x !== m) : [...draft.secondary, m] })}
                      className={chipClass(on)}
                    >
                      {on ? <Check aria-hidden /> : null}
                      {MUSCLE_LABELS[m]}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Zählen in der Statistik „Sätze pro Muskelgruppe“ halb.</p>
            </div>
          </>
        ) : current ? (
          <dl className="grid gap-3">
            <Detail label="Muskelgruppe" value={MUSCLE_LABELS[current.muscleGroup]} />
            {current.secondaryMuscles.length ? <Detail label="Nebenmuskeln" value={current.secondaryMuscles.map((m) => MUSCLE_LABELS[m]).join(", ")} /> : null}
            <Detail label="Gerät" value={EQUIPMENT_LABELS[current.equipment]} />
            <Detail label="Erfassen als" value={TRACKING_LABELS[current.tracking]} />
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Dumbbell className="size-4" aria-hidden />
              {current.origin === "seed" ? "Den Grundbestand ändern nur Admins." : "Ändern kann nur, wer die Übung angelegt hat."}
            </p>
          </dl>
        ) : null}
      </EditorSheet>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
