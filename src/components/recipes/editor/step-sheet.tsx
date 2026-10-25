"use client";

import { useState } from "react";
import { Check, Clock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { stepNumberOf, type TimerMode } from "@/lib/domain/recipe-editor";
import { detectTimers } from "@/lib/domain/timers";
import { cn } from "@/lib/utils";
import { EditorSheet, FieldHeading, RadioSegments, StepBadge, StepNumber } from "./editor-parts";
import type { FieldErrors, Line, Step } from "./editor-model";

/** Schritt bearbeiten: Anleitung, Timer, zugeordnete Zutaten. Änderungen wirken sofort aufs Formular. */
export function StepSheet({
  open,
  onOpenChange,
  step,
  steps,
  lines,
  errors,
  onChange,
  onToggleLine,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** undefined, während das Sheet nach dem Entfernen zugeht */
  step: Step | undefined;
  steps: Step[];
  lines: Line[];
  errors: FieldErrors;
  onChange: (patch: Partial<Step>) => void;
  /** Zutat diesem Schritt zuordnen bzw. lösen */
  onToggleLine: (lineKey: number) => void;
  onRemove: () => void;
}) {
  const [shown, setShown] = useState(step);
  if (step && step !== shown) setShown(step);
  const s = step ?? shown;
  if (!s) return null;

  const index = steps.findIndex((x) => x.key === s.key);
  const number = index >= 0 ? index + 1 : steps.length;
  const err = (key: string) => (index >= 0 ? errors[`steps.${index}.${key}`]?.[0] : undefined);
  const detected = detectTimers(s.text);

  return (
    <EditorSheet
      open={open}
      onOpenChange={onOpenChange}
      leading={<StepNumber n={number} size="lg" />}
      title={`Schritt ${number}`}
      description={`von ${steps.length}`}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={onRemove}
            className="h-12 rounded-full border-destructive/40 px-5 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 aria-hidden />
            Entfernen
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)} className="h-12 flex-1 rounded-full text-base">
            Fertig
          </Button>
        </>
      }
    >
      <div>
        <FieldHeading htmlFor="sheet-step-text">Anleitung</FieldHeading>
        <textarea
          id="sheet-step-text"
          value={s.text}
          maxLength={2000}
          rows={4}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="z. B. Zwiebeln fein würfeln und 5 Minuten glasig anschwitzen."
          aria-invalid={Boolean(err("text")) || undefined}
          className="block min-h-32 w-full resize-none rounded-2xl border border-input bg-background/40 px-4 py-3 text-base leading-relaxed outline-none [field-sizing:content] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
        />
        {err("text") ? <p className="mt-1 text-sm text-destructive">{err("text")}</p> : null}
      </div>

      <div>
        <FieldHeading>Timer</FieldHeading>
        <RadioSegments<TimerMode>
          label="Timer"
          value={s.timerMode}
          onChange={(timerMode) => onChange({ timerMode })}
          options={[
            { value: "text", label: "Aus dem Text" },
            { value: "custom", label: "Eigener" },
            { value: "none", label: "Keiner" },
          ]}
        />
        <div className="mt-2.5 flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
          {s.timerMode === "text" ? (
            <>
              <Clock className="size-4 shrink-0" aria-hidden />
              {detected.length > 0 ? (
                <span>
                  Erkannt: <span className="text-foreground">{detected.map((t) => t.label).join(", ")}</span> – im Kochmodus antippbar
                </span>
              ) : (
                <span>Keine Zeitangabe im Text gefunden.</span>
              )}
            </>
          ) : s.timerMode === "custom" ? (
            <>
              <label htmlFor="sheet-timer" className="sr-only">
                Eigener Timer in Minuten
              </label>
              <Input
                id="sheet-timer"
                inputMode="decimal"
                value={s.timerMinutes}
                onChange={(e) => onChange({ timerMinutes: e.target.value })}
                placeholder="z. B. 10"
                aria-invalid={Boolean(err("timer_seconds")) || undefined}
                className="w-24"
              />
              <span>Min. – im Kochmodus als Timer-Knopf</span>
            </>
          ) : (
            <span>Kein Timer im Kochmodus, auch nicht für Zeiten im Text.</span>
          )}
        </div>
        {err("timer_seconds") ? (
          <p className="text-sm text-destructive">Bitte den Timer in Minuten angeben (z. B. 10 oder 1,5), höchstens 24 Stunden.</p>
        ) : null}
      </div>

      <StepIngredients key={s.key} stepKey={s.key} steps={steps} lines={lines} onToggle={onToggleLine} />
    </EditorSheet>
  );
}

/** Zugeordnete Zutaten zuerst (mit Häkchen), dann die übrigen; die Reihenfolge bleibt, solange das Sheet offen ist. */
function StepIngredients({ stepKey, steps, lines, onToggle }: { stepKey: number; steps: Step[]; lines: Line[]; onToggle: (lineKey: number) => void }) {
  const [order] = useState(() => [...lines.filter((l) => l.stepKey === stepKey), ...lines.filter((l) => l.stepKey !== stepKey)].map((l) => l.key));
  const byKey = new Map(lines.map((l) => [l.key, l]));
  // Neu hinzugekommene Zutaten hinten anhängen
  const ordered = [...order.filter((k) => byKey.has(k)), ...lines.filter((l) => !order.includes(l.key)).map((l) => l.key)].map((k) => byKey.get(k)!);
  const selected = ordered.filter((l) => l.stepKey === stepKey).length;

  return (
    <div>
      <FieldHeading id="sheet-step-ingredients" aside={lines.length > 0 ? `${selected} ausgewählt${lines.length > 2 ? " · wischen" : ""}` : undefined}>
        Zutaten in diesem Schritt
      </FieldHeading>
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Zutaten im Rezept.</p>
      ) : (
        <>
          <div
            role="group"
            aria-labelledby="sheet-step-ingredients"
            data-base-ui-swipe-ignore="x"
            className="-mx-5 flex gap-2 overflow-x-auto overscroll-x-contain px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {ordered.map((l) => {
              const mine = l.stepKey === stepKey;
              const other = mine ? null : stepNumberOf(l.stepKey, steps);
              return (
                <button
                  key={l.key}
                  type="button"
                  aria-pressed={mine}
                  onClick={() => onToggle(l.key)}
                  className={cn(
                    "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    mine ? "border-primary/60 bg-primary/15 text-foreground" : "bg-card hover:bg-muted",
                  )}
                >
                  {mine ? <Check className="size-4 text-primary" aria-hidden /> : <Plus className="size-4 text-muted-foreground" aria-hidden />}
                  {l.ingredient.name}
                  {other ? <StepBadge n={other} className="ml-0.5" /> : null}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Jede Zutat gehört zu einem Schritt – antippen verschiebt sie hierher.</p>
        </>
      )}
    </div>
  );
}
