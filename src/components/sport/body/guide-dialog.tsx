"use client";

import { ChipRow } from "@/components/layout/list-blocks";
import { chipClass } from "@/components/recipes/chip-select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GENERAL_TIPS, MEASURES, measureOf, type MeasureKey } from "@/lib/domain/body";
import { BodyFigure } from "./body-figure";

/** Messanleitung: je Maß Figur mit Messstelle, wo gemessen wird und die Schritte; darunter Tipps für alle Umfänge. */
export function GuideDialog({
  open,
  onOpenChange,
  measure,
  onMeasure,
  keys = MEASURES.map((m) => m.key),
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  measure: MeasureKey;
  onMeasure: (key: MeasureKey) => void;
  /** angezeigte Maße (ausgeblendete fehlen) */
  keys?: MeasureKey[];
}) {
  const m = measureOf(measure);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Messanleitung</DialogTitle>
          <DialogDescription className="sr-only">So misst du {m.label} richtig.</DialogDescription>
        </DialogHeader>
        <ChipRow label="Maß" className="-mx-1 px-1">
          {keys.map((k) => (
            <button key={k} type="button" aria-pressed={k === measure} onClick={() => onMeasure(k)} className={chipClass(k === measure)}>
              {measureOf(k).label}
            </button>
          ))}
        </ChipRow>
        <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
          <BodyFigure mark={m.guide.mark} className="h-auto w-full" />
          <div className="min-w-0">
            <h3 className="font-sans text-lg font-semibold tracking-normal">{m.label}</h3>
            <p className="mb-3 text-sm text-muted-foreground">{m.guide.where}</p>
            <ol className="space-y-2 text-sm">
              {m.guide.steps.map((step, i) => (
                <li key={step} className="flex gap-2">
                  <span className="w-4 shrink-0 font-semibold text-sport tabular-nums">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
        {m.unit === "cm" ? (
          <div className="border-t pt-3">
            <h3 className="mb-2 font-sans text-xs font-semibold tracking-wide text-muted-foreground uppercase">Für alle Umfänge</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {GENERAL_TIPS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
