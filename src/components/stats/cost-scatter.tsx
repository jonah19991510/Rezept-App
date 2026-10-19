"use client";

import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { formatEuro, formatNumber } from "@/lib/format";
import { AXIS_TICK, TooltipBox } from "./chart-card";

export type CostPoint = { id: string; title: string; cost: number; protein: number; proteinPerEuro: number };

const COLOR = "var(--macro-protein)";

/** Protein pro Euro (Phase 12): Kosten pro Portion gegen Protein; oben links = viel Protein für wenig Geld. */
export function CostScatter({ points, onSelect }: { points: CostPoint[]; onSelect: (p: CostPoint) => void }) {
  function renderTooltip({ active, payload }: TooltipContentProps) {
    const p = payload?.[0]?.payload as CostPoint | undefined;
    if (!active || !p) return null;
    return (
      <TooltipBox
        title={p.title}
        rows={[
          { label: "Kosten pro Portion", value: formatEuro(p.cost) },
          { label: "Protein", value: `${formatNumber(p.protein, 0)} g` },
          { label: "Protein pro Euro", value: `${formatNumber(p.proteinPerEuro, 0)} g`, color: COLOR },
        ]}
      />
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 12, bottom: 20, left: 0 }}>
          <CartesianGrid stroke="var(--chart-grid)" />
          <XAxis
            type="number"
            dataKey="cost"
            tick={AXIS_TICK}
            tickFormatter={(v: number) => formatEuro(v)}
            tickLine={false}
            axisLine={{ stroke: "var(--chart-grid)" }}
            label={{ value: "€ pro Portion", position: "insideBottom", offset: -12, fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <YAxis type="number" dataKey="protein" unit=" g" width={48} tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <Tooltip content={renderTooltip} cursor={false} />
          <Scatter data={points} shape={Dot} isAnimationActive={false} onClick={(_, index) => onSelect(points[index])} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Punkt mit Ring in Kartenfarbe; Trefferfläche größer als der Punkt */
function Dot(props: { cx?: number; cy?: number }) {
  if (props.cx == null || props.cy == null) return <g />;
  return (
    <g className="cursor-pointer">
      <circle cx={props.cx} cy={props.cy} r={12} fill="transparent" />
      <circle cx={props.cx} cy={props.cy} r={5} fill={COLOR} stroke="var(--card)" strokeWidth={2} />
    </g>
  );
}
