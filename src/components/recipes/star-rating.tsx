"use client";

import { Star } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Bewertung 1–5 antippen; nochmal auf denselben Stern nimmt sie zurück. */
export function StarRatingInput({
  value,
  onChange,
  size = "md",
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  size?: "md" | "lg";
}) {
  return (
    <div className={cn("flex gap-1", size === "lg" && "justify-center")}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? null : n)}
          aria-pressed={value != null && n <= value}
          aria-label={`${n} von 5 Sternen`}
          className={cn(
            "grid place-items-center rounded-2xl hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            size === "lg" ? "size-14" : "size-11",
          )}
        >
          <Star
            className={cn(size === "lg" ? "size-9" : "size-6", value != null && n <= value ? "fill-primary text-primary" : "text-muted-foreground")}
            aria-hidden
          />
        </button>
      ))}
    </div>
  );
}

/** Kleine Anzeige „★ 4,5“ (Durchschnitt oder Einzelbewertung). */
export function StarValue({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 tabular-nums", className)} aria-label={`${formatNumber(value, 1)} von 5 Sternen`}>
      <Star className="size-3.5 fill-primary text-primary" aria-hidden />
      {formatNumber(value, 1)}
    </span>
  );
}
