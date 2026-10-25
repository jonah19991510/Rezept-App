"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { formatDecimalInput, parseDecimal } from "@/lib/domain/decimal";
import { stepAmount } from "@/lib/domain/recipe-editor";
import { needsManualGrams, resolveLineGrams, type Unit } from "@/lib/domain/units";
import { formatNumber } from "@/lib/format";
import { FOOD_GROUP_LABELS, UNIT_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { EditorSheet, FieldHeading, radioKeys, RadioSegments, StepNumber } from "./editor-parts";
import type { FieldErrors, Line, Step } from "./editor-model";

const KITCHEN_MAIN: Unit[] = ["g", "ml", "piece", "tbsp", "tsp"];
const KITCHEN_MORE: Unit[] = ["cl", "pinch", "dash", "barspoon"];
const BAR_MAIN: Unit[] = ["cl", "ml", "dash", "barspoon", "tsp"];
const BAR_MORE: Unit[] = ["piece", "g", "tbsp", "pinch"];

/** Zutat bearbeiten: Menge, Einheit, Schritt, Notiz, optional. Änderungen wirken sofort aufs Formular. */
export function IngredientSheet({
  open,
  onOpenChange,
  line,
  index,
  steps,
  isCocktail,
  errors,
  onChange,
  onRemove,
  onReplace,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** undefined, während das Sheet nach dem Entfernen zugeht */
  line: Line | undefined;
  index: number;
  steps: Step[];
  isCocktail: boolean;
  errors: FieldErrors;
  onChange: (patch: Partial<Line>) => void;
  onRemove: () => void;
  onReplace: () => void;
}) {
  // Beim Schließen (Animation) die zuletzt gezeigte Zutat behalten
  const [shown, setShown] = useState(line);
  if (line && line !== shown) setShown(line);
  const l = line ?? shown;
  if (!l) return null;

  const err = (key: string) => errors[`ingredients.${index}.${key}`]?.[0];
  const amount = parseDecimal(l.amount);
  const unit = l.unit || null;
  const grams = resolveLineGrams(amount, unit, l.ingredient, parseDecimal(l.manualGrams));
  const manual = needsManualGrams(amount, unit, l.ingredient);
  const per = (v: number) => (grams != null ? (grams * v) / 100 : 0);
  const main = isCocktail ? BAR_MAIN : KITCHEN_MAIN;
  const more = isCocktail ? BAR_MORE : KITCHEN_MORE;

  function step(direction: 1 | -1) {
    onChange({ amount: formatDecimalInput(stepAmount(amount, unit, direction)) });
  }

  return (
    <EditorSheet
      open={open}
      onOpenChange={onOpenChange}
      title={l.ingredient.name}
      description={
        <>
          {FOOD_GROUP_LABELS[l.ingredient.food_group]} · {formatNumber(l.ingredient.kcal, 0)} kcal je 100 g ·{" "}
          <button type="button" onClick={onReplace} className="-my-2 py-2 font-medium text-primary underline-offset-4 hover:underline">
            Austauschen
          </button>
        </>
      }
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
        <FieldHeading htmlFor="sheet-amount">Menge</FieldHeading>
        <div
          className={cn(
            "flex h-14 items-stretch overflow-hidden rounded-2xl border bg-background/40 focus-within:ring-3 focus-within:ring-ring/50",
            err("amount") && "border-destructive",
          )}
        >
          <button type="button" onClick={() => step(-1)} className="grid w-16 shrink-0 place-items-center border-r hover:bg-muted" aria-label="Weniger">
            <Minus className="size-5" aria-hidden />
          </button>
          <input
            id="sheet-amount"
            inputMode="decimal"
            value={l.amount}
            onChange={(e) => onChange({ amount: e.target.value })}
            placeholder="–"
            aria-invalid={Boolean(err("amount")) || undefined}
            className="min-w-0 flex-1 bg-transparent text-center text-2xl font-semibold tabular-nums outline-none"
          />
          <button type="button" onClick={() => step(1)} className="grid w-16 shrink-0 place-items-center border-l hover:bg-muted" aria-label="Mehr">
            <Plus className="size-5" aria-hidden />
          </button>
        </div>
        {err("amount") ? <p className="mt-1 text-sm text-destructive">{err("amount")}</p> : null}

        <UnitPicker main={main} more={more} value={unit} onChange={(u) => onChange({ unit: u })} onNoAmount={() => onChange({ unit: "", amount: "" })} />
        {err("unit") ? <p className="mt-1 text-sm text-destructive">{err("unit")}</p> : null}

        {manual ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="sheet-manual" className="text-muted-foreground">
              Wie viel wiegt das zusammen? ≈
            </label>
            <Input
              id="sheet-manual"
              inputMode="decimal"
              className="w-24"
              value={l.manualGrams}
              onChange={(e) => onChange({ manualGrams: e.target.value })}
            />
            <span>g</span>
          </div>
        ) : null}

        <div className="mt-3 flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl bg-muted/60 px-3 py-2 text-sm" aria-live="polite">
          {grams != null ? (
            <>
              <span className="font-semibold tabular-nums">
                {formatNumber(Math.round(per(l.ingredient.kcal)), 0)} kcal
                {l.optional ? <span className="font-normal text-muted-foreground"> · nicht eingerechnet</span> : null}
              </span>
              <span className="flex flex-wrap gap-x-3 text-muted-foreground tabular-nums">
                <Macro color="bg-macro-protein" label="P" value={per(l.ingredient.protein)} />
                <Macro color="bg-macro-carbs" label="KH" value={per(l.ingredient.carbs)} />
                <Macro color="bg-macro-fat" label="F" value={per(l.ingredient.fat)} />
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">
              {amount == null ? "Ohne Menge (z. B. nach Geschmack), zählt nicht in den Nährwerten" : "Gewicht unbekannt, zählt nicht in den Nährwerten"}
            </span>
          )}
        </div>
      </div>

      {steps.length > 0 ? (
        <StepCards steps={steps} value={l.stepKey != null && steps.some((s) => s.key === l.stepKey) ? l.stepKey : null} onChange={(stepKey) => onChange({ stepKey })} />
      ) : null}

      <div>
        <FieldHeading htmlFor="sheet-note">Notiz</FieldHeading>
        <Input
          id="sheet-note"
          value={l.note}
          maxLength={200}
          onChange={(e) => onChange({ note: e.target.value })}
          placeholder="z. B. gewürfelt, zimmerwarm"
          className="h-12"
        />
      </div>

      <label htmlFor="sheet-optional" className="flex cursor-pointer items-center justify-between gap-4">
        <span>
          <span className="block font-medium">Optional</span>
          <span className="block text-sm text-muted-foreground">Zählt nicht in Nährwerten, Kosten und Einkaufsliste</span>
        </span>
        <Switch id="sheet-optional" checked={l.optional} onCheckedChange={(v) => onChange({ optional: v })} />
      </label>
    </EditorSheet>
  );
}

function Macro({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", color)} aria-hidden />
      {formatNumber(value, 0)} g {label}
    </span>
  );
}

/** Einheit als Segment-Leiste; seltene Einheiten hinter „Mehr“. */
function UnitPicker({
  main,
  more,
  value,
  onChange,
  onNoAmount,
}: {
  main: Unit[];
  more: Unit[];
  value: Unit | null;
  onChange: (u: Unit) => void;
  onNoAmount: () => void;
}) {
  const inMore = value != null && more.includes(value);
  const [showMore, setShowMore] = useState(inMore);
  const onKeyDown = radioKeys(more, value, onChange);
  return (
    <div className="mt-3">
      <RadioSegments
        label="Einheit"
        value={value && main.includes(value) ? value : null}
        options={main.map((u) => ({ value: u, label: UNIT_LABELS[u] }))}
        onChange={onChange}
        extra={
          <button
            type="button"
            aria-expanded={showMore}
            onClick={() => setShowMore((v) => !v)}
            className={cn(
              "h-11 min-w-0 flex-1 basis-0 truncate rounded-xl px-1 text-sm font-medium transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              inMore ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {inMore && value ? UNIT_LABELS[value] : "Mehr"}
          </button>
        }
      />
      {showMore ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <div role="radiogroup" aria-label="Weitere Einheiten" onKeyDown={onKeyDown} className="contents">
            {more.map((u, i) => (
              <button
                key={u}
                type="button"
                role="radio"
                aria-checked={value === u}
                tabIndex={value === u || (!inMore && i === 0) ? 0 : -1}
                onClick={() => onChange(u)}
                className={cn(
                  "h-11 rounded-full border px-4 text-sm font-medium transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  value === u ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                )}
              >
                {UNIT_LABELS[u]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onNoAmount}
            className={cn(
              "h-11 rounded-full border border-dashed px-4 text-sm font-medium text-muted-foreground transition hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              value == null && "border-primary text-primary",
            )}
          >
            Ohne Menge
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** „Gebraucht in Schritt“: wischbare Karten, erste „Kein Schritt“; die gewählte wird beim Öffnen ins Bild gescrollt. */
function StepCards({ steps, value, onChange }: { steps: Step[]; value: number | null; onChange: (stepKey: number | null) => void }) {
  const options: (number | null)[] = [null, ...steps.map((s) => s.key)];
  const onKeyDown = radioKeys(options, value, onChange);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (el && scroller.current) scroller.current.scrollLeft = Math.max(0, el.offsetLeft - 20);
  }, []); // nur beim Öffnen
  const cardClass = (selected: boolean) =>
    cn(
      "flex w-44 shrink-0 snap-start flex-col gap-1.5 rounded-2xl border p-3 text-left transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
      selected ? "border-primary bg-primary/10" : "bg-card hover:bg-muted/50",
    );
  return (
    <div>
      <FieldHeading id="sheet-steps-label" aside={steps.length > 1 ? "wischen für mehr" : undefined}>
        Gebraucht in Schritt
      </FieldHeading>
      <div
        ref={scroller}
        role="radiogroup"
        aria-labelledby="sheet-steps-label"
        onKeyDown={onKeyDown}
        data-base-ui-swipe-ignore="x"
        className="relative -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-2.5 overflow-x-auto overscroll-x-contain px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <button type="button" role="radio" aria-checked={value == null} tabIndex={value == null ? 0 : -1} onClick={() => onChange(null)} className={cardClass(value == null)}>
          <span className="flex items-center gap-2 font-semibold">
            <StepNumber n="–" size="sm" muted />
            Kein Schritt
          </span>
          <span className="line-clamp-2 text-sm text-muted-foreground">Zum Servieren oder nicht zugeordnet</span>
        </button>
        {steps.map((s, i) => {
          const selected = value === s.key;
          return (
            <button key={s.key} type="button" role="radio" aria-checked={selected} tabIndex={selected ? 0 : -1} onClick={() => onChange(s.key)} className={cardClass(selected)}>
              <span className="flex items-center gap-2 font-semibold">
                <StepNumber n={i + 1} size="sm" muted={!selected} />
                Schritt {i + 1}
              </span>
              <span className="line-clamp-2 text-sm text-muted-foreground">{s.text.trim() || "Noch ohne Text"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
