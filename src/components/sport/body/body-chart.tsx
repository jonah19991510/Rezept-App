"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { AXIS_TICK, TooltipBox } from "@/components/stats/chart-card";
import { fixed, longDay, shortDay, type Point } from "@/lib/domain/body";

/** Verlauf einer Größe als Fläche mit Punkten (ein Punkt je Messung); die Achse beginnt nicht bei 0. */
export function BodyChart({ points, label, unit, digits }: { points: Point[]; label: string; unit: string; digits: number }) {
  const data = points.map((p) => ({ ...p, day: shortDay(p.date) }));
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.15, digits === 2 ? 0.01 : 0.5);
  // Achse in glatten Schritten (z. B. 0,5 kg oder 2 cm), höchstens fünf Abstände, damit die Beschriftung rund ist
  const steps = digits === 2 ? [0.01, 0.02, 0.05, 0.1, 0.2] : [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];
  const step = steps.find((s) => (max + pad - (min - pad)) / s <= 5) ?? steps[steps.length - 1];
  const lower = Math.floor((min - pad) / step) * step;
  const upper = Math.ceil((max + pad) / step) * step;
  const ticks = Array.from({ length: Math.round((upper - lower) / step) + 1 }, (_, i) => lower + i * step);
  const format = (v: number) => `${fixed(v, digits)}${unit ? ` ${unit}` : ""}`;

  function renderTooltip({ active, payload }: TooltipContentProps) {
    const p = payload?.[0]?.payload as (typeof data)[number] | undefined;
    if (!active || !p) return null;
    return <TooltipBox title={longDay(p.date)} rows={[{ label, value: format(p.value), color: "var(--sport)" }]} />;
  }

  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="body-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--sport)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--sport)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="day" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} interval="preserveStartEnd" minTickGap={20} />
          <YAxis
            width={48}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            domain={[lower, upper]}
            ticks={ticks}
            tickFormatter={(v: number) => fixed(v, digits)}
            allowDecimals
          />
          <Tooltip content={renderTooltip} cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="value"
            name={label}
            stroke="var(--sport)"
            strokeWidth={2}
            fill="url(#body-fill)"
            isAnimationActive={false}
            dot={{ r: 3.5, fill: "var(--card)", stroke: "var(--sport)", strokeWidth: 2 }}
            activeDot={{ r: 6, fill: "var(--sport)", stroke: "var(--card)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
