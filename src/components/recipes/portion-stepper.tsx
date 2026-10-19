"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { stepServings } from "@/lib/domain/scaling";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Portionen für Rezeptseite und Kochmodus: ganze Portionen, unter 1 halbe. */
export function PortionStepper({
  value,
  onChange,
  size = "default",
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: "default" | "lg";
  className?: string;
}) {
  const big = size === "lg";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        type="button"
        variant="outline"
        size={big ? "icon-lg" : "icon"}
        onClick={() => onChange(stepServings(value, -1))}
        disabled={value <= 0.5}
        aria-label="Weniger Portionen"
      >
        <Minus aria-hidden />
      </Button>
      <output className={cn("text-center font-semibold tabular-nums", big ? "min-w-32 text-2xl" : "min-w-24 text-base")} aria-live="polite">
        {formatNumber(value, 1)} {value === 1 ? "Portion" : "Portionen"}
      </output>
      <Button
        type="button"
        variant="outline"
        size={big ? "icon-lg" : "icon"}
        onClick={() => onChange(stepServings(value, 1))}
        disabled={value >= 100}
        aria-label="Mehr Portionen"
      >
        <Plus aria-hidden />
      </Button>
    </div>
  );
}
