"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { COMPOSITION_BUCKETS, compositionRows, type BucketKey, type StatsRecipe } from "@/lib/domain/stats";
import { formatNumber } from "@/lib/format";
import { AXIS_TICK, CHART_COLORS, CHART_OTHER, TooltipBox } from "./chart-card";

// Feste Reihenfolge der geprüften Palette: nur so sind benachbarte Segmente sicher unterscheidbar
const BUCKET_COLOR: Record<BucketKey, string> = {
  veg: CHART_COLORS[0],
  grains: CHART_COLORS[1],
  meatfish: CHART_COLORS[2],
  dairy: CHART_COLORS[3],
  legumes: CHART_COLORS[4],
  rest: CHART_OTHER,
};

const INITIAL_ROWS = 10;

function truncate(text: string, max = 15) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Rezeptname einzeilig und gekürzt; der volle Name steht im Tooltip und in der Tabelle. */
function TitleTick({ x, y, payload }: { x?: number | string; y?: number | string; payload?: { value?: unknown } }) {
  const title = String(payload?.value ?? "");
  return (
    <text x={Number(x)} y={Number(y)} dy={4} textAnchor="end" fill="var(--muted-foreground)" fontSize={12}>
      <title>{title}</title>
      {truncate(title)}
    </text>
  );
}

/** Gramm pro Portion je Zutatengruppe, ein Balken pro Rezept. Sortierbar; Klick wählt das Rezept. */
export function CompositionChart({ recipes, onSelect }: { recipes: StatsRecipe[]; onSelect: (id: string, title: string) => void }) {
  const [sortBy, setSortBy] = useState<BucketKey | "total">("veg");
  const [showAll, setShowAll] = useState(false);
  const all = compositionRows(recipes, sortBy);
  const rows = showAll ? all : all.slice(0, INITIAL_ROWS);

  function renderTooltip({ active, payload }: TooltipContentProps) {
    const row = payload?.[0]?.payload as (typeof all)[number] | undefined;
    if (!active || !row) return null;
    return (
      <TooltipBox
        title={row.title}
        rows={[
          ...COMPOSITION_BUCKETS.filter((b) => row[b.key] > 0).map((b) => ({
            label: b.label,
            value: `${formatNumber(row[b.key], 0)} g`,
            color: BUCKET_COLOR[b.key],
          })),
          { label: "Gesamt", value: `${formatNumber(row.total, 0)} g` },
        ]}
      />
    );
  }

  if (all.length === 0) return <p className="text-sm text-muted-foreground">Noch keine Rezepte mit Zutaten.</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="composition-sort" className="text-sm text-muted-foreground">
          Sortieren nach
        </label>
        <NativeSelect id="composition-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value as BucketKey | "total")} className="w-52">
          {COMPOSITION_BUCKETS.map((b) => (
            <option key={b.key} value={b.key}>
              {b.label}
            </option>
          ))}
          <option value="total">Gesamtgewicht</option>
        </NativeSelect>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground" aria-label="Legende">
        {COMPOSITION_BUCKETS.map((b) => (
          <li key={b.key} className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm" style={{ background: BUCKET_COLOR[b.key] }} aria-hidden />
            {b.label}
          </li>
        ))}
      </ul>

      <div style={{ height: rows.length * 34 + 40 }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 0 }} barCategoryGap={8}>
            <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
            <XAxis
              type="number"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${formatNumber(v, 0)} g`}
            />
            <YAxis
              type="category"
              dataKey="title"
              width={124}
              tick={TitleTick}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={renderTooltip} cursor={{ fill: "var(--muted)", opacity: 0.6 }} />
            {COMPOSITION_BUCKETS.map((b, i) => (
              <Bar
                key={b.key}
                dataKey={b.key}
                name={b.label}
                stackId="g"
                fill={BUCKET_COLOR[b.key]}
                stroke="var(--card)"
                strokeWidth={2}
                maxBarSize={22}
                radius={i === COMPOSITION_BUCKETS.length - 1 ? [0, 4, 4, 0] : 0}
                isAnimationActive={false}
                className="cursor-pointer"
                onClick={(_, index) => onSelect(rows[index].id, rows[index].title)}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {all.length > INITIAL_ROWS ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Weniger anzeigen" : `Alle ${all.length} Rezepte anzeigen`}
        </Button>
      ) : null}
    </div>
  );
}
