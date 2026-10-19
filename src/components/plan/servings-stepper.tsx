"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clampServings } from "@/lib/domain/plan";
import { formatNumber } from "@/lib/format";

/** Portionen in halben Schritten (¼ bis 20). */
export function ServingsStepper({ value, onChange, id }: { value: number; onChange: (v: number) => void; id?: string }) {
  return (
    <div className="flex items-center gap-2" id={id}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => onChange(clampServings(value <= 0.5 ? 0.25 : value - 0.5))}
        disabled={value <= 0.25}
        aria-label="Eine halbe Portion weniger"
      >
        <Minus aria-hidden />
      </Button>
      <output className="min-w-20 text-center text-lg font-semibold tabular-nums" aria-live="polite">
        {formatNumber(value, 2)} {value === 1 ? "Portion" : "Portionen"}
      </output>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => onChange(clampServings(value < 0.5 ? 0.5 : value + 0.5))}
        disabled={value >= 20}
        aria-label="Eine halbe Portion mehr"
      >
        <Plus aria-hidden />
      </Button>
    </div>
  );
}
