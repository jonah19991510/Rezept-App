"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { WeekPoint } from "@/lib/domain/stats";
import { isoWeekNumber, dayMonth } from "@/lib/domain/week";
import { formatNumber } from "@/lib/format";
import { AXIS_TICK, TooltipBox } from "./chart-card";

/**
 * Ein Wert (kcal ODER Protein) pro Woche als Linie, Ziel als ruhige Referenzlinie.
 * Zwei Maße mit verschiedener Skala bekommen zwei Diagramme statt einer zweiten Achse.
 */
export function PlanTrend({
  points,
  metric,
  goal,
  color,
  unit,
}: {
  points: WeekPoint[];
  metric: "kcal" | "protein";
  goal: number | null;
  color: string;
  unit: string;
}) {
  const data = points.map((p) => ({ ...p, label: `KW ${isoWeekNumber(p.monday)}`, value: p[metric] }));

  function renderTooltip({ active, payload }: TooltipContentProps) {
    const p = payload?.[0]?.payload as (typeof data)[number] | undefined;
    if (!active || !p) return null;
    return (
      <TooltipBox
        title={`${p.label} (ab ${dayMonth(p.monday)})`}
        rows={[
          {
            label: "Ø pro geplantem Tag",
            value: p.value == null ? "nichts geplant" : `${formatNumber(Math.round(p.value), 0)}${unit}`,
            color,
          },
          ...(goal ? [{ label: "Ziel", value: `${formatNumber(goal, 0)}${unit}` }] : []),
          { label: "Geplante Tage", value: String(p.plannedDays) },
        ]}
      />
    );
  }

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} interval="preserveStartEnd" />
          <YAxis
            width={48}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            domain={[0, "auto"]}
            tickFormatter={(v: number) => formatNumber(v, 0)}
          />
          {goal ? (
            <ReferenceLine
              y={goal}
              stroke="var(--chart-axis)"
              strokeWidth={1}
              ifOverflow="extendDomain"
              label={{ value: "Ziel", position: "insideTopRight", fill: "var(--muted-foreground)", fontSize: 12 }}
            />
          ) : null}
          <Tooltip content={renderTooltip} cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={{ r: 4, fill: color, stroke: "var(--card)", strokeWidth: 2 }}
            activeDot={{ r: 6, fill: color, stroke: "var(--card)", strokeWidth: 2 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
