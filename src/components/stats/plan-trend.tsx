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
 * Ein Wert (kcal ODER Protein) pro Woche als Linie, Ziel als ruhige Referenzlinie. Schwankt das Ziel
 * (Trainingstage haben eigene Ziele), wird es eine gestrichelte Linie mit dem Ø-Ziel je Woche.
 * Zwei Maße mit verschiedener Skala bekommen zwei Diagramme statt einer zweiten Achse.
 */
export function PlanTrend({
  points,
  metric,
  color,
  unit,
}: {
  points: WeekPoint[];
  metric: "kcal" | "protein";
  color: string;
  unit: string;
}) {
  const data = points.map((p) => ({
    ...p,
    label: `KW ${isoWeekNumber(p.monday)}`,
    value: p[metric],
    goal: metric === "kcal" ? p.goalKcal : p.goalProtein,
  }));
  const goals = [...new Set(data.map((d) => d.goal).filter((g): g is number => g != null).map((g) => Math.round(g)))];
  // Ein einheitliches Ziel als Referenzlinie, sonst Linie
  const steadyGoal = goals.length === 1 ? goals[0] : null;

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
          ...(p.goal != null ? [{ label: p.trainingDays > 0 ? "Ø Ziel" : "Ziel", value: `${formatNumber(Math.round(p.goal), 0)}${unit}` }] : []),
          { label: "Geplante Tage", value: String(p.plannedDays) },
          ...(p.trainingDays > 0 ? [{ label: "davon Trainingstage", value: String(p.trainingDays) }] : []),
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
          {steadyGoal ? (
            <ReferenceLine
              y={steadyGoal}
              stroke="var(--chart-axis)"
              strokeWidth={1}
              ifOverflow="extendDomain"
              label={{ value: "Ziel", position: "insideTopRight", fill: "var(--muted-foreground)", fontSize: 12 }}
            />
          ) : null}
          {goals.length > 1 ? (
            <Line
              type="linear"
              dataKey="goal"
              stroke="var(--chart-axis)"
              strokeWidth={1}
              strokeDasharray="4 4"
              dot={false}
              activeDot={false}
              connectNulls
              isAnimationActive={false}
            />
          ) : null}
          <Tooltip content={renderTooltip} cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={(props: { cx?: number; cy?: number; index?: number }) => <WeekDot key={props.index} {...props} color={color} training={(data[props.index ?? 0]?.trainingDays ?? 0) > 0} />}
            activeDot={{ r: 6, fill: color, stroke: "var(--card)", strokeWidth: 2 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Punkt je Woche; Wochen mit Trainingstagen bekommen einen Ring (Trainingstage markiert). */
function WeekDot({ cx, cy, color, training }: { cx?: number; cy?: number; color: string; training: boolean }) {
  if (cx == null || cy == null) return null;
  return (
    <g>
      {training ? <circle cx={cx} cy={cy} r={8} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.6} /> : null}
      <circle cx={cx} cy={cy} r={4} fill={color} stroke="var(--card)" strokeWidth={2} />
    </g>
  );
}
