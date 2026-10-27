"use client";

import { useRef } from "react";
import { weekdayShort } from "@/lib/domain/week";
import { cn } from "@/lib/utils";

export type DayBar = {
  date: string;
  /** Teile von unten nach oben */
  parts: { key: string; color: string; value: number }[];
  /** Tag liegt in der Zukunft: kein Balken */
  future?: boolean;
  /** Balken hervorheben (z. B. über 400 mg Koffein) */
  alert?: boolean;
};

export type BarLine = { value: number; label: string; kind: "dashed" | "dotted" };

/**
 * Balken je Tag (Woche: 7, Monat: bis 31), nach Teilen gestapelt. Antippen wählt den Tag, Wischen nach links/rechts
 * wechselt den Zeitraum. Linien (Ziel gestrichelt, Durchschnitt gepunktet) liegen quer darüber. Werte stehen über den
 * Balken (im Monat nur beim gewählten Tag, sonst wird es zu eng).
 */
export function DayBars({
  bars,
  lines,
  selected,
  onSelect,
  onSwipe,
  format,
  describe,
  label,
  compact,
}: {
  bars: DayBar[];
  lines: BarLine[];
  selected: string | null;
  onSelect: (date: string) => void;
  onSwipe?: (step: -1 | 1) => void;
  format: (value: number) => string;
  /** Wert mit Einheit für Screenreader, z. B. „1,80 l“ */
  describe: (value: number) => string;
  /** Beschreibung für Screenreader, z. B. „Menge pro Tag“ */
  label: string;
  /** Monat: schmale Balken, Beschriftung nur jeden fünften Tag */
  compact: boolean;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const totals = bars.map((b) => b.parts.reduce((s, p) => s + p.value, 0));
  const max = Math.max(1, ...totals, ...lines.map((l) => l.value)) * 1.12;
  const height = 168;

  return (
    <div
      className="select-none"
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        const s = start.current;
        start.current = null;
        if (!s || !onSwipe) return;
        const dx = e.clientX - s.x;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(e.clientY - s.y) * 1.5) onSwipe(dx < 0 ? 1 : -1);
      }}
      style={{ touchAction: "pan-y" }}
    >
      <div className="relative" style={{ height: height + 22 }} role="group" aria-label={label}>
        {/* Linien quer über alle Balken */}
        {lines.map((l) => (
          <div key={l.label} className="pointer-events-none absolute inset-x-0 z-10" style={{ bottom: 22 + (l.value / max) * height }} aria-hidden>
            <div className={cn("border-t-2", l.kind === "dashed" ? "border-dashed border-foreground/55" : "border-dotted border-primary")} />
            {/* Ziel rechts, Durchschnitt links: liegen beide nah beieinander, überdecken sich die Beschriftungen nicht */}
            <span
              className={cn(
                "absolute -translate-y-full rounded bg-card/85 px-1 text-[0.7rem] font-medium",
                l.kind === "dashed" ? "right-0 text-foreground/70" : "left-0 text-primary",
              )}
            >
              {l.label}
            </span>
          </div>
        ))}
        <div className={cn("absolute inset-0 flex items-end", compact ? "gap-px" : "gap-1.5")}>
          {bars.map((b, i) => {
            const total = totals[i];
            const isSelected = b.date === selected;
            const day = Number(b.date.slice(8));
            const showTick = !compact || day === 1 || day % 5 === 0 || isSelected;
            return (
              <button
                key={b.date}
                type="button"
                onClick={() => onSelect(b.date)}
                aria-pressed={isSelected}
                aria-label={`${weekdayShort(b.date)}, ${day}.: ${b.future ? "noch nicht" : describe(total)}`}
                className={cn(
                  "group relative flex h-full min-w-0 flex-1 flex-col items-stretch justify-end rounded-t-md pb-[22px] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  isSelected && "bg-muted/70",
                )}
              >
                {(!compact || isSelected) && total > 0 ? (
                  <span className="mb-0.5 truncate text-center text-[0.7rem] font-semibold tabular-nums">{format(total)}</span>
                ) : null}
                <span className={cn("flex flex-col-reverse overflow-hidden", compact ? "mx-0 rounded-t-sm" : "mx-auto w-[calc(100%-0.5rem)] max-w-14 rounded-t-md", b.alert && "ring-2 ring-destructive")} style={{ height: (total / max) * height }}>
                  {b.parts.map((p) => (
                    <span key={p.key} className="w-full shrink-0" style={{ height: `${(p.value / (total || 1)) * 100}%`, background: p.color }} />
                  ))}
                </span>
                <span
                  className={cn(
                    "absolute inset-x-0 bottom-0 flex h-[22px] items-end justify-center text-[0.7rem] text-muted-foreground tabular-nums",
                    isSelected && "font-semibold text-foreground",
                  )}
                  aria-hidden
                >
                  {showTick ? (compact ? day : weekdayShort(b.date)) : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
