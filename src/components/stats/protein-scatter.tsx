"use client";

import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { formatNumber } from "@/lib/format";
import { AXIS_TICK, TooltipBox } from "./chart-card";

export type ScatterPoint = { id: string; title: string; kcal: number; protein: number; highProtein: boolean };

const HIGHLIGHT = "var(--macro-protein)";
const MUTED = "var(--chart-other)";

/** Protein gegen kcal pro Portion. High-Protein-Rezepte betont, der Rest grau. Klick wählt das Rezept. */
export function ProteinScatter({ points, onSelect }: { points: ScatterPoint[]; onSelect: (p: ScatterPoint) => void }) {
  const high = points.filter((p) => p.highProtein);
  const other = points.filter((p) => !p.highProtein);

  function renderTooltip({ active, payload }: TooltipContentProps) {
    const p = payload?.[0]?.payload as ScatterPoint | undefined;
    if (!active || !p) return null;
    return (
      <TooltipBox
        title={p.title}
        rows={[
          { label: "Protein", value: `${formatNumber(p.protein, 0)} g` },
          { label: "kcal", value: formatNumber(Math.round(p.kcal), 0) },
          { label: "Protein-Anteil", value: p.kcal > 0 ? `${Math.round(((p.protein * 4) / p.kcal) * 100)} %` : "–" },
        ]}
      />
    );
  }

  // Punkt mit Ring in Kartenfarbe; Trefferfläche größer als der Punkt
  const dot = (fill: string) =>
    function Dot(props: { cx?: number; cy?: number }) {
      if (props.cx == null || props.cy == null) return <g />;
      return (
        <g className="cursor-pointer">
          <circle cx={props.cx} cy={props.cy} r={12} fill="transparent" />
          <circle cx={props.cx} cy={props.cy} r={5} fill={fill} stroke="var(--card)" strokeWidth={2} />
        </g>
      );
    };

  return (
    <div className="space-y-2">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 12, bottom: 20, left: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" />
            <XAxis
              type="number"
              dataKey="kcal"
              name="kcal"
              tick={AXIS_TICK}
              tickFormatter={(v: number) => formatNumber(v, 0)}
              tickLine={false}
              axisLine={{ stroke: "var(--chart-grid)" }}
              label={{ value: "kcal pro Portion", position: "insideBottom", offset: -12, fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <YAxis
              type="number"
              dataKey="protein"
              name="Protein"
              unit=" g"
              width={48}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={renderTooltip} cursor={false} />
            <Scatter
              name="Weitere Rezepte"
              data={other}
              shape={dot(MUTED)}
              isAnimationActive={false}
              onClick={(_, index) => onSelect(other[index])}
            />
            <Scatter
              name="High Protein"
              data={high}
              shape={dot(HIGHLIGHT)}
              isAnimationActive={false}
              onClick={(_, index) => onSelect(high[index])}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-wrap gap-4 text-sm text-muted-foreground" aria-label="Legende">
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: HIGHLIGHT }} aria-hidden />
          High Protein
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: MUTED }} aria-hidden />
          Weitere Rezepte
        </li>
      </ul>
    </div>
  );
}
