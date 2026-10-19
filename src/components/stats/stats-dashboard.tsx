"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { MacroDot } from "@/components/recipes/macro-dot";
import { Button } from "@/components/ui/button";
import type { Goals } from "@/lib/domain/plan";
import { goalsForDay, isTrainingDay } from "@/lib/domain/training";
import {
  applySelection,
  autoTagShares,
  averageMacroDistribution,
  categorySlices,
  categoryTable,
  compositionRows,
  COMPOSITION_BUCKETS,
  mostPlanned,
  weeklyPlanSeries,
  withNutrition,
  type StatsPlanEntry,
  type StatsRecipe,
  type StatsSelection,
} from "@/lib/domain/stats";
import { isoWeekNumber, mondayOf } from "@/lib/domain/week";
import { formatNumber } from "@/lib/format";
import { AUTO_TAG_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { CategoryDonut } from "./category-donut";
import { ChartCard, DataTable } from "./chart-card";
import { CompositionChart } from "./composition-chart";
import { PlanTrend } from "./plan-trend";
import { ProteinScatter } from "./protein-scatter";

export function StatsDashboard({
  recipes,
  planEntries,
  recipeTitles,
  mondays,
  goals,
  training,
}: {
  recipes: StatsRecipe[];
  planEntries: StatsPlanEntry[];
  recipeTitles: Record<string, string>;
  mondays: string[];
  goals: { default: Goals; training: Goals };
  training: { weekdays: number[]; overrides: Record<string, boolean> };
}) {
  const [selection, setSelection] = useState<StatsSelection | null>(null);
  const listRef = useRef<HTMLElement>(null);

  const slices = useMemo(() => categorySlices(recipes), [recipes]);
  const tags = useMemo(() => autoTagShares(recipes), [recipes]);
  const macros = useMemo(() => averageMacroDistribution(recipes), [recipes]);
  const scatter = useMemo(
    () => withNutrition(recipes).map((r) => ({ id: r.id, title: r.title, kcal: r.kcal, protein: r.protein, highProtein: r.isHighProtein })),
    [recipes],
  );
  const weeks = useMemo(
    () =>
      weeklyPlanSeries(planEntries, mondays, mondayOf, (date) => {
        const isTraining = isTrainingDay(date, training.weekdays, training.overrides);
        return { training: isTraining, goals: goalsForDay(isTraining, goals.default, goals.training) };
      }),
    [planEntries, mondays, training, goals],
  );
  const top = useMemo(() => mostPlanned(planEntries, new Map(Object.entries(recipeTitles))), [planEntries, recipeTitles]);
  const selected = useMemo(() => applySelection(recipes, selection), [recipes, selection]);

  function select(next: StatsSelection) {
    // Zweiter Klick auf dieselbe Auswahl hebt sie wieder auf
    setSelection((prev) => (prev && prev.label === next.label && prev.kind === next.kind ? null : next));
    requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const plannedMeals = planEntries.length;

  return (
    <div className="space-y-6">
      {/* Kennzahlen */}
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Rezepte" value={formatNumber(recipes.length, 0)} />
        <Kpi label="Ø kcal pro Portion" value={macros ? formatNumber(Math.round(macros.perServing.kcal), 0) : "–"} />
        <Kpi label="Ø Protein pro Portion" value={macros ? `${formatNumber(macros.perServing.protein, 0)} g` : "–"} />
        <Kpi label={`Geplante Mahlzeiten (${mondays.length} Wochen)`} value={formatNumber(plannedMeals, 0)} />
      </dl>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Rezepte nach Kategorie"
          description="Tipp auf eine Kategorie, um die Rezepte unten zu sehen."
          table={<DataTable head={["Kategorie", "Rezepte"]} rows={categoryTable(recipes).map((c) => [c.label, c.count])} />}
        >
          <CategoryDonut
            slices={slices}
            total={recipes.length}
            selectedKey={selection?.kind === "category" ? (slices.find((s) => s.label === selection.label)?.key ?? null) : null}
            onSelect={(s) => select({ kind: "category", label: s.label, members: s.members })}
          />
        </ChartCard>

        <ChartCard title="Auto-Tags" description="Anteil deiner Rezepte mit dem jeweiligen Tag.">
          <ul className="grid gap-2">
            {tags.map((t) => {
              const label = AUTO_TAG_LABELS[t.tag];
              const active = selection?.kind === "tag" && selection.tag === t.tag;
              return (
                <li key={t.tag}>
                  <button
                    type="button"
                    onClick={() => select({ kind: "tag", label, tag: t.tag })}
                    aria-pressed={active}
                    className={cn("grid w-full gap-1 rounded-xl px-2 py-1.5 text-left hover:bg-muted", active && "bg-accent")}
                  >
                    <span className="flex items-baseline justify-between text-sm">
                      <span>{label}</span>
                      <span>
                        <span className="font-semibold">{Math.round(t.share * 100)} %</span>
                        <span className="text-muted-foreground"> · {t.count}</span>
                      </span>
                    </span>
                    <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <span className="block h-full rounded-full bg-sage" style={{ width: `${t.share * 100}%` }} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </ChartCard>

        <ChartCard
          title="Protein und Kalorien"
          description="Jeder Punkt ist ein Rezept (pro Portion). Oben links: viel Protein für wenig Kalorien."
          table={
            <DataTable
              head={["Rezept", "kcal", "Protein (g)"]}
              rows={[...scatter].sort((a, b) => b.protein - a.protein).map((p) => [p.title, Math.round(p.kcal), Math.round(p.protein)])}
            />
          }
        >
          {scatter.length > 0 ? (
            <ProteinScatter points={scatter} onSelect={(p) => select({ kind: "recipes", label: p.title, ids: [p.id] })} />
          ) : (
            <p className="text-sm text-muted-foreground">Noch keine Rezepte mit Zutaten.</p>
          )}
        </ChartCard>

        <ChartCard
          title="Durchschnittliche Makroverteilung"
          description="Anteil der Kalorien aus Protein, Kohlenhydraten und Fett, gemittelt über alle Rezepte."
        >
          {macros ? (
            <div className="space-y-4">
              <div className="flex h-8 overflow-hidden rounded-xl" role="img" aria-label="Makroverteilung">
                {(
                  [
                    ["protein", "bg-macro-protein"],
                    ["carbs", "bg-macro-carbs"],
                    ["fat", "bg-macro-fat"],
                  ] as const
                ).map(([key, color], i) => (
                  <div
                    key={key}
                    className={cn(color, i > 0 && "border-l-2 border-card")}
                    style={{ width: `${macros.shares[key] * 100}%` }}
                  />
                ))}
              </div>
              <dl className="grid grid-cols-3 gap-2 text-sm">
                {(
                  [
                    ["protein", "Protein", "Protein"],
                    ["carbs", "Kohlenhydrate", "KH"],
                    ["fat", "Fett", "Fett"],
                  ] as const
                ).map(([key, label, short]) => (
                  <div key={key} className="min-w-0 rounded-2xl bg-muted/60 p-3">
                    <dt className="flex items-center gap-1.5 text-muted-foreground">
                      <MacroDot macro={key} />
                      <span className="truncate sm:hidden" aria-hidden>
                        {short}
                      </span>
                      <span className="sr-only sm:not-sr-only sm:truncate">{label}</span>
                    </dt>
                    <dd className="text-xl font-semibold">{Math.round(macros.shares[key] * 100)} %</dd>
                    <dd className="text-xs text-muted-foreground">Ø {formatNumber(macros.perServing[key], 0)} g pro Portion</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Noch keine Rezepte mit Zutaten.</p>
          )}
        </ChartCard>

        <ChartCard
          className="lg:col-span-2"
          title="Zusammensetzung nach Zutatengruppe"
          description="Gramm pro Portion. Tipp auf einen Balken, um das Rezept unten zu sehen."
          table={
            <DataTable
              head={["Rezept", ...COMPOSITION_BUCKETS.map((b) => `${b.label} (g)`)]}
              rows={compositionRows(recipes).map((r) => [r.title, ...COMPOSITION_BUCKETS.map((b) => r[b.key])])}
            />
          }
        >
          <CompositionChart recipes={recipes} onSelect={(id, title) => select({ kind: "recipes", label: title, ids: [id] })} />
        </ChartCard>

        <ChartCard
          title="Wochenplan: Kalorien"
          description="Durchschnitt pro geplantem Tag, die letzten Wochen im Vergleich zum Ziel (an Trainingstagen das Trainingsziel)."
          table={
            <DataTable
              head={["Woche", "Ø kcal", "Ø Ziel", "Geplante Tage", "Trainingstage"]}
              rows={weeks.map((w) => [
                `KW ${isoWeekNumber(w.monday)}`,
                w.kcal == null ? "–" : Math.round(w.kcal),
                w.goalKcal == null ? "–" : Math.round(w.goalKcal),
                w.plannedDays,
                w.trainingDays,
              ])}
            />
          }
        >
          <PlanTrend points={weeks} metric="kcal" color="var(--macro-kcal)" unit=" kcal" />
        </ChartCard>

        <ChartCard
          title="Wochenplan: Protein"
          description="Durchschnitt pro geplantem Tag in Gramm."
          table={
            <DataTable
              head={["Woche", "Ø Protein (g)", "Ø Ziel (g)", "Geplante Tage", "Trainingstage"]}
              rows={weeks.map((w) => [
                `KW ${isoWeekNumber(w.monday)}`,
                w.protein == null ? "–" : Math.round(w.protein),
                w.goalProtein == null ? "–" : Math.round(w.goalProtein),
                w.plannedDays,
                w.trainingDays,
              ])}
            />
          }
        >
          <PlanTrend points={weeks} metric="protein" color="var(--macro-protein)" unit=" g" />
        </ChartCard>

        <ChartCard
          className="lg:col-span-2"
          title="Meistgeplant"
          description={`Wie oft ein Rezept in den letzten ${mondays.length} Wochen im Wochenplan stand.`}
        >
          {top.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch nichts geplant.</p>
          ) : (
            <ol className="grid gap-1">
              {top.map((t) => (
                <li key={t.recipeId}>
                  <button
                    type="button"
                    onClick={() => select({ kind: "recipes", label: t.title, ids: [t.recipeId] })}
                    className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-xl px-2 py-1.5 text-left hover:bg-muted"
                  >
                    <span className="truncate text-sm">{t.title}</span>
                    <span className="text-sm font-semibold">{t.count}×</span>
                    <span className="col-span-2 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <span className="block h-full rounded-full bg-primary" style={{ width: `${(t.count / top[0].count) * 100}%` }} />
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </ChartCard>
      </div>

      {/* Rezeptliste zur Auswahl im Diagramm */}
      <section ref={listRef} className="scroll-mt-20 rounded-3xl border bg-card p-4 md:p-5" aria-labelledby="auswahl" aria-live="polite">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="auswahl" className="text-lg font-semibold">
            {selection ? `Auswahl: ${selection.label}` : "Alle Rezepte"}
            <span className="ml-2 font-sans text-base font-normal text-muted-foreground">({selected.length})</span>
          </h2>
          {selection ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setSelection(null)}>
              <X aria-hidden />
              Auswahl aufheben
            </Button>
          ) : null}
        </div>
        {!selection ? (
          <p className="mb-3 text-sm text-muted-foreground">Tipp auf ein Diagramm, um hier nur die passenden Rezepte zu sehen.</p>
        ) : null}
        <ul className="divide-y">
          {[...selected]
            .sort((a, b) => a.title.localeCompare(b.title, "de"))
            .map((r) => (
              <li key={r.id}>
                <Link href={`/rezepte/${r.id}`} className="flex min-h-12 items-center justify-between gap-3 py-2 hover:text-primary">
                  <span className="min-w-0 truncate font-medium">{r.title}</span>
                  {r.ingredientCount > 0 ? (
                    <span className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MacroDot macro="kcal" />
                        {formatNumber(Math.round(r.kcal), 0)} kcal
                      </span>
                      <span className="flex items-center gap-1">
                        <MacroDot macro="protein" />
                        {formatNumber(r.protein, 0)} g P
                      </span>
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold">{value}</dd>
    </div>
  );
}
