"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import type { BarStats, CountSlice } from "@/lib/domain/bar-stats";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AXIS_TICK, CHART_COLORS, CHART_OTHER, ChartCard, DataTable, TooltipBox } from "./chart-card";

const colorOf = (slice: CountSlice) => (slice.colorSlot ? CHART_COLORS[slice.colorSlot - 1] : CHART_OTHER);

/** Phase 15: Bar-Statistiken. Ein Tipp auf ein Segment öffnet die Bar-Liste mit diesem Filter. */
export function BarStatsDashboard({ stats }: { stats: BarStats }) {
  const router = useRouter();
  const open = (param: "basis" | "methode") => (slice: CountSlice) => {
    if (slice.filter) router.push(`/rezepte/bar?${param}=${encodeURIComponent(slice.filter)}`);
  };

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure label="Cocktails" value={String(stats.total)} />
        <Figure label="Ø Alkoholgehalt" value={stats.avgAbv != null ? `${formatNumber(stats.avgAbv, 1)} % vol` : "–"} />
        <Figure label="Ø Alkohol pro Drink" value={stats.avgAlcoholGrams != null ? `${formatNumber(stats.avgAlcoholGrams, 0)} g` : "–"} />
        <Figure label="Ø kcal pro Drink" value={stats.avgKcal != null ? formatNumber(Math.round(stats.avgKcal), 0) : "–"} />
      </dl>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Nach Basisspirituose"
          description="Die Spirituose mit der größten Menge im Glas. Tipp auf einen Eintrag zeigt die Cocktails."
          table={<DataTable head={["Spirituose", "Cocktails"]} rows={stats.bySpirit.map((s) => [s.label, s.count])} />}
        >
          <CountDonut slices={stats.bySpirit} total={stats.total} onSelect={open("basis")} />
        </ChartCard>
        <ChartCard
          title="Nach Methode"
          description="Geshaked, gerührt, gebaut oder geblendet."
          table={<DataTable head={["Methode", "Cocktails"]} rows={stats.byMethod.map((s) => [s.label, s.count])} />}
        >
          <CountDonut slices={stats.byMethod} total={stats.total} onSelect={open("methode")} />
        </ChartCard>
      </div>

      <ChartCard
        title="Nach Alkoholgehalt"
        description="Fertiger Drink inklusive Schmelzwasser, in % vol."
        table={<DataTable head={["Alkoholgehalt", "Cocktails"]} rows={stats.byAbv.map((b) => [b.label, b.count])} />}
      >
        <AbvChart data={stats.byAbv} />
      </ChartCard>

      <div className="grid gap-4 sm:grid-cols-2">
        <TopList title="Die stärksten" items={stats.strongest.map((s) => ({ id: s.id, title: s.title, value: `${formatNumber(s.abv, 1)} % vol` }))} empty="Noch keine alkoholischen Cocktails." />
        <TopList
          title="Am häufigsten gemixt"
          items={stats.mostMixed.map((s) => ({ id: s.id, title: s.title, value: s.times === 1 ? "einmal" : `${s.times}-mal` }))}
          empty="Noch nichts gemixt. „Gemixt!“ am Ende des Mix-Modus trägt es ein."
        />
      </div>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border bg-card p-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-heading text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function CountDonut({ slices, total, onSelect }: { slices: CountSlice[]; total: number; onSelect: (slice: CountSlice) => void }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const focus = hovered != null ? slices[hovered] : null;
  const data = slices.map((s, i) => ({
    name: s.label,
    value: s.count,
    fill: colorOf(s),
    fillOpacity: hovered == null || hovered === i ? 1 : 0.45,
  }));

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,10rem)_1fr]">
      <div className="relative mx-auto aspect-square w-full max-w-40">
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
          <div className="max-w-[60%]">
            <div className="text-2xl font-semibold">{focus ? focus.count : total}</div>
            <div className="truncate text-xs text-muted-foreground">{focus ? focus.label : "Cocktails"}</div>
          </div>
        </div>
      </div>
      <ul className="grid gap-1">
        {slices.map((s, i) => (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => onSelect(s)}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(i)}
              onBlur={() => setHovered(null)}
              disabled={!s.filter}
              className={cn("flex min-h-10 w-full items-center gap-2 rounded-xl px-2 text-left text-sm hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent")}
            >
              <span className="size-3 shrink-0 rounded-sm" style={{ background: colorOf(s) }} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              <span className="font-semibold tabular-nums">{s.count}</span>
              <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{Math.round((s.count / total) * 100)} %</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AbvChart({ data }: { data: BarStats["byAbv"] }) {
  function renderTooltip({ active, payload }: TooltipContentProps) {
    const p = payload?.[0]?.payload as BarStats["byAbv"][number] | undefined;
    if (!active || !p) return null;
    return <TooltipBox title={p.label} rows={[{ label: "Cocktails", value: String(p.count), color: CHART_COLORS[3] }]} />;
  }
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} interval={0} />
          <YAxis width={32} tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip content={renderTooltip} cursor={{ fill: "var(--muted)" }} />
          <Bar dataKey="count" fill={CHART_COLORS[3]} radius={[6, 6, 0, 0]} maxBarSize={48} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TopList({ title, items, empty }: { title: string; items: { id: string; title: string; value: string }[]; empty: string }) {
  return (
    <section className="space-y-2 rounded-3xl border bg-card p-4 md:p-5" aria-label={title}>
      <h2 className="text-lg font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ol className="divide-y">
          {items.map((i) => (
            <li key={i.id}>
              <Link href={`/rezepte/${i.id}`} className="flex min-h-11 items-center justify-between gap-3 hover:text-primary">
                <span className="min-w-0 truncate">{i.title}</span>
                <span className="shrink-0 text-sm font-medium tabular-nums">{i.value}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
