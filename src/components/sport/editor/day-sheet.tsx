"use client";

import { Sparkles, Trash2 } from "lucide-react";
import { EditorSheet, FieldHeading } from "@/components/recipes/editor/editor-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { suggestedFocus } from "@/lib/domain/training-plan";
import type { DraftDay } from "./plan-model";

/** Trainingstag umbenennen, Fokus setzen (mit Vorschlag aus den Übungen) oder löschen. */
export function DaySheet({
  open,
  onOpenChange,
  day,
  canRemove,
  errors,
  onChange,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: DraftDay | undefined;
  canRemove: boolean;
  errors: Record<string, string[]>;
  onChange: (patch: Partial<DraftDay>) => void;
  onRemove: () => void;
}) {
  if (!day) return null;
  const suggestion = suggestedFocus(day.exercises.map((e) => ({ muscleGroup: e.exercise.muscleGroup, sets: e.sets })));
  return (
    <EditorSheet
      open={open}
      onOpenChange={onOpenChange}
      title={day.name.trim() || "Trainingstag"}
      description={day.exercises.length === 1 ? "1 Übung" : `${day.exercises.length} Übungen`}
      footer={
        <>
          {canRemove ? (
            <Button type="button" variant="destructive" className="h-12" onClick={onRemove}>
              <Trash2 aria-hidden />
              Tag löschen
            </Button>
          ) : null}
          <Button type="button" className="h-12 flex-1" onClick={() => onOpenChange(false)}>
            Fertig
          </Button>
        </>
      }
    >
      <div>
        <FieldHeading htmlFor="day-name">Name</FieldHeading>
        <Input
          id="day-name"
          value={day.name}
          maxLength={60}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="z. B. Tag A oder Push"
          aria-invalid={Boolean(errors.name) || undefined}
        />
        {errors.name ? <p className="mt-1 text-sm text-destructive">{errors.name[0]}</p> : null}
      </div>
      <div>
        <FieldHeading htmlFor="day-focus" aside="optional">
          Fokus
        </FieldHeading>
        <Input
          id="day-focus"
          value={day.focus}
          maxLength={60}
          onChange={(e) => onChange({ focus: e.target.value })}
          placeholder="z. B. Brust, Trizeps"
          aria-invalid={Boolean(errors.focus) || undefined}
        />
        {errors.focus ? <p className="mt-1 text-sm text-destructive">{errors.focus[0]}</p> : null}
        {suggestion && suggestion !== day.focus.trim() ? (
          <Button type="button" variant="ghost" size="sm" className="mt-2 text-primary" onClick={() => onChange({ focus: suggestion })}>
            <Sparkles aria-hidden />
            Vorschlag: {suggestion}
          </Button>
        ) : null}
      </div>
    </EditorSheet>
  );
}
