"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { dayMonth, isoWeekNumber } from "@/lib/domain/week";
import { AXIS_TICK, TooltipBox } from "./chart-card";

export type WeekValue = { monday: string; value: number | null; note?: string };

/**
 * Ein Wert pro Woche (Phase 12): gekochte Gerichte als Balken, Essenskosten als Linie.
 * Wochen ohne Wert bleiben leer (Lücke in der Linie).
 */
export function WeekSeries({
  points,
  kind,
  color,
  label,
  format,
}: {
  points: WeekValue[];
  kind: "bar" | "line";
  color: string;
  label: string;
  format: (value: number) => string;
}) {
  const data = points.map((p) => ({ ...p, week: `KW ${isoWeekNumber(p.monday)}` }));

  function renderTooltip({ active, payload }: TooltipContentProps) {
    const p = payload?.[0]?.payload as (typeof data)[number] | undefined;
    if (!active || !p) return null;
    return (
      <TooltipBox
        title={`${p.week} (ab ${dayMonth(p.monday)})`}
        rows={[
          { label, value: p.value == null ? "–" : format(p.value), color },
          ...(p.note ? [{ label: "Hinweis", value: p.note }] : []),
        ]}
      />
    );
  }

  const axes = (
    <>
      <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
      <XAxis dataKey="week" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} interval="preserveStartEnd" />
      <YAxis width={48} tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={kind === "line"} tickFormatter={(v: number) => format(v)} />
      <Tooltip content={renderTooltip} cursor={kind === "bar" ? { fill: "var(--muted)" } : { stroke: "var(--chart-axis)", strokeWidth: 1 }} />
    </>
  );

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {kind === "bar" ? (
          <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            {axes}
            <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} maxBarSize={36} isAnimationActive={false} />
          </BarChart>
        ) : (
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            {axes}
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={{ r: 4, fill: color, stroke: "var(--card)", strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
