"use client";

import { Flame, Minus, Plus, Repeat, Trash2 } from "lucide-react";
import { EditorSheet, FieldHeading, RadioSegments } from "@/components/recipes/editor/editor-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { EQUIPMENT_LABELS, isTimed, MUSCLE_LABELS } from "@/lib/domain/exercises";
import { durationLabel, REST_CHOICES } from "@/lib/domain/training-plan";
import type { DraftDay, DraftExercise } from "./plan-model";

const numberClass = "h-12 text-center text-xl font-semibold tabular-nums";

/** Übung im Plan bearbeiten: Sätze, Wiederholungen bzw. Dauer, Pause, Aufwärmsätze, Notiz, Tag; austauschen, entfernen. */
export function ExerciseSheet({
  open,
  onOpenChange,
  draft,
  dayKey,
  days,
  errors,
  onChange,
  onMove,
  onReplace,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: DraftExercise | undefined;
  dayKey: string;
  days: DraftDay[];
  errors: Record<string, string[]>;
  onChange: (patch: Partial<DraftExercise>) => void;
  onMove: (toDayKey: string) => void;
  onReplace: () => void;
  onRemove: () => void;
}) {
  if (!draft) return null;
  const { exercise } = draft;
  const timed = isTimed(exercise.tracking);
  const restOptions = [
    { value: "none", label: "–" },
    ...[...new Set([...REST_CHOICES, ...(draft.restSeconds != null && draft.restSeconds > 0 ? [draft.restSeconds] : [])])]
      .sort((a, b) => a - b)
      .map((s) => ({ value: String(s), label: durationLabel(s).replace(" Min.", " min") })),
  ];
  const err = (k: string) => errors[k]?.[0];

  return (
    <EditorSheet
      open={open}
      onOpenChange={onOpenChange}
      title={exercise.name}
      description={`${MUSCLE_LABELS[exercise.muscleGroup]} · ${EQUIPMENT_LABELS[exercise.equipment]}`}
      footer={
        <>
          <Button type="button" variant="destructive" className="h-12" onClick={onRemove} aria-label="Übung entfernen">
            <Trash2 aria-hidden />
          </Button>
          <Button type="button" variant="outline" className="h-12 flex-1" onClick={onReplace}>
            <Repeat aria-hidden />
            Austauschen
          </Button>
          <Button type="button" className="h-12 flex-1" onClick={() => onOpenChange(false)}>
            Fertig
          </Button>
        </>
      }
    >
      <div>
        <FieldHeading id="sets-label">Sätze</FieldHeading>
        <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-1.5" role="group" aria-labelledby="sets-label">
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            onClick={() => onChange({ sets: Math.max(1, draft.sets - 1) })}
            disabled={draft.sets <= 1}
            aria-label="Ein Satz weniger"
          >
            <Minus aria-hidden />
          </Button>
          <output className="text-3xl font-semibold tabular-nums" aria-live="polite">
            {draft.sets}
          </output>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            onClick={() => onChange({ sets: Math.min(20, draft.sets + 1) })}
            disabled={draft.sets >= 20}
            aria-label="Ein Satz mehr"
          >
            <Plus aria-hidden />
          </Button>
        </div>
      </div>

      {timed ? (
        <div>
          <FieldHeading htmlFor="target-seconds" aside="optional">
            Dauer pro Satz (Sekunden)
          </FieldHeading>
          <Input
            id="target-seconds"
            inputMode="numeric"
            value={draft.targetSeconds}
            onChange={(e) => onChange({ targetSeconds: e.target.value })}
            placeholder="z. B. 45"
            className={numberClass}
            aria-invalid={Boolean(err("target_seconds")) || undefined}
          />
          {err("target_seconds") ? <p className="mt-1 text-sm text-destructive">{err("target_seconds")}</p> : null}
        </div>
      ) : (
        <div>
          <FieldHeading aside="optional">Wiederholungen</FieldHeading>
          <div className="flex items-center gap-3">
            <Input
              inputMode="numeric"
              value={draft.repsMin}
              onChange={(e) => onChange({ repsMin: e.target.value })}
              placeholder="8"
              aria-label="Wiederholungen von"
              className={numberClass}
              aria-invalid={Boolean(err("reps_min")) || undefined}
            />
            <span className="text-muted-foreground">bis</span>
            <Input
              inputMode="numeric"
              value={draft.repsMax}
              onChange={(e) => onChange({ repsMax: e.target.value })}
              placeholder="12"
              aria-label="Wiederholungen bis"
              className={numberClass}
              aria-invalid={Boolean(err("reps_max")) || undefined}
            />
          </div>
          {err("reps_min") || err("reps_max") ? (
            <p className="mt-1 text-sm text-destructive">{err("reps_min") ?? err("reps_max")}</p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">Für eine feste Zahl beide Felder gleich ausfüllen.</p>
          )}
        </div>
      )}

      <div>
        <FieldHeading>Pause nach jedem Satz</FieldHeading>
        <RadioSegments
          label="Pause nach jedem Satz"
          value={draft.restSeconds == null ? "none" : String(draft.restSeconds)}
          options={restOptions}
          onChange={(v) => onChange({ restSeconds: v === "none" ? null : Number(v) })}
        />
      </div>

      {exercise.tracking === "weight_reps" ? (
        <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border bg-card p-4">
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 font-medium">
              <Flame className="size-4 text-primary" aria-hidden />
              Aufwärmsätze vorschlagen
            </span>
            <span className="block text-sm text-muted-foreground">
              Im Training berechnet aus deinem Arbeitsgewicht, z. B. 50 % × 8, 70 % × 5, 85 % × 3.
            </span>
          </span>
          <Switch checked={draft.warmup} onCheckedChange={(warmup) => onChange({ warmup })} className="mt-1" />
        </label>
      ) : null}

      <div>
        <FieldHeading htmlFor="exercise-note" aside="optional">
          Notiz
        </FieldHeading>
        <Input
          id="exercise-note"
          value={draft.note}
          maxLength={200}
          onChange={(e) => onChange({ note: e.target.value })}
          placeholder="z. B. Sitz auf Stufe 4, eng greifen"
          aria-invalid={Boolean(err("note")) || undefined}
        />
        {err("note") ? <p className="mt-1 text-sm text-destructive">{err("note")}</p> : null}
      </div>

      {days.length > 1 ? (
        <div>
          <FieldHeading htmlFor="exercise-day">Trainingstag</FieldHeading>
          <NativeSelect id="exercise-day" value={dayKey} onChange={(e) => onMove(e.target.value)}>
            {days.map((d) => (
              <option key={d.key} value={d.key}>
                {d.name.trim() || "Ohne Namen"}
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : null}
    </EditorSheet>
  );
}
