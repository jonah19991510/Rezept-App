"use client";

import { Pie, PieChart, ResponsiveContainer, Tooltip, type TooltipContentProps } from "recharts";
import type { CategorySlice } from "@/lib/domain/stats";
import { cn } from "@/lib/utils";
import { CHART_COLORS, CHART_OTHER, TooltipBox } from "./chart-card";

const colorOf = (slice: CategorySlice) => (slice.colorSlot ? CHART_COLORS[slice.colorSlot - 1] : CHART_OTHER);

/** Rezepte nach Kategorie. Klick auf Segment oder Legende wählt die Kategorie aus. */
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
  const data = slices.map((s) => ({ name: s.label, value: s.count, fill: colorOf(s) }));

  function renderTooltip({ active, payload }: TooltipContentProps) {
    if (!active || !payload?.length) return null;
    const entry = payload[0];
    const count = Number(entry.value ?? 0);
    return (
      <TooltipBox
        rows={[{ label: String(entry.name), value: `${count} · ${Math.round((count / total) * 100)} %`, color: String(entry.payload?.fill ?? "") }]}
      />
    );
  }

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
              className="cursor-pointer outline-none"
            />
            <Tooltip content={renderTooltip} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-2xl font-semibold">{total}</div>
            <div className="text-xs text-muted-foreground">Rezepte</div>
          </div>
        </div>
      </div>

      {/* Legende = Tastatur-Weg zum Filtern */}
      <ul className="grid gap-1">
        {slices.map((s) => {
          const active = selectedKey === s.key;
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => onSelect(s)}
                aria-pressed={active}
                className={cn(
                  "flex min-h-10 w-full items-center gap-2 rounded-xl px-2 text-left text-sm hover:bg-muted",
                  active && "bg-accent",
                )}
              >
                <span className="size-3 shrink-0 rounded-sm" style={{ background: colorOf(s) }} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                <span className="font-semibold tabular-nums">{s.count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
