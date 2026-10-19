"use client";

import { useState } from "react";
import { Pie, PieChart, ResponsiveContainer } from "recharts";
import type { CategorySlice } from "@/lib/domain/stats";
import { cn } from "@/lib/utils";
import { CHART_COLORS, CHART_OTHER } from "./chart-card";

const colorOf = (slice: CategorySlice) => (slice.colorSlot ? CHART_COLORS[slice.colorSlot - 1] : CHART_OTHER);

/**
 * Rezepte nach Kategorie. Statt eines schwebenden Tooltips (der die Mitte verdecken würde)
 * zeigt die Mitte das Segment unter dem Zeiger bzw. das ausgewählte, sonst die Gesamtzahl.
 * Klick auf Segment oder Legende wählt die Kategorie aus.
 */
export function CategoryDonut({
  slices,
  total,
  selectedKey,
  onSelect,
}: {
  slices: CategorySlice[];
  total: number;
  selectedKey: string | null;
  onSelect: (slice: CategorySlice) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const selectedIndex = slices.findIndex((s) => s.key === selectedKey);
  const focusIndex = hovered ?? (selectedIndex >= 0 ? selectedIndex : null);
  const focus = focusIndex != null ? slices[focusIndex] : null;

  // Hervorgehobenes Segment voll, die anderen etwas zurückgenommen
  const data = slices.map((s, i) => ({
    name: s.label,
    value: s.count,
    fill: colorOf(s),
    fillOpacity: focusIndex == null || focusIndex === i ? 1 : 0.45,
  }));

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,12rem)_1fr]">
      <div className="relative mx-auto aspect-square w-full max-w-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="100%"
              paddingAngle={data.length > 1 ? 2 : 0}
              cornerRadius={4}
              stroke="var(--card)"
              strokeWidth={2}
              isAnimationActive={false}
              onClick={(_, index) => onSelect(slices[index])}
              onMouseEnter={(_, index) => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              className="cursor-pointer outline-none"
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center" aria-live="polite">
          {focus ? (
            <div className="max-w-[60%]">
              <div className="text-2xl font-semibold">{focus.count}</div>
              <div className="truncate text-xs font-medium">{focus.label}</div>
              <div className="text-xs text-muted-foreground">{Math.round((focus.count / total) * 100)} %</div>
            </div>
          ) : (
            <div>
              <div className="text-2xl font-semibold">{total}</div>
              <div className="text-xs text-muted-foreground">Rezepte</div>
            </div>
          )}
        </div>
      </div>

      {/* Legende = Tastatur-Weg zum Filtern; Überfahren hebt das Segment im Donut hervor */}
      <ul className="grid gap-1">
        {slices.map((s, i) => {
          const active = selectedKey === s.key;
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => onSelect(s)}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered(null)}
                aria-pressed={active}
                className={cn(
                  "flex min-h-10 w-full items-center gap-2 rounded-xl px-2 text-left text-sm hover:bg-muted",
                  active && "bg-accent",
                )}
              >
                <span className="size-3 shrink-0 rounded-sm" style={{ background: colorOf(s) }} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                <span className="font-semibold tabular-nums">{s.count}</span>
                <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
                  {Math.round((s.count / total) * 100)} %
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
