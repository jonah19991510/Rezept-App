"use client";

import { useMemo, useState, useTransition } from "react";
import { BookOpen, Plus, Ruler, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { deleteMeasurementAction } from "@/app/(app)/sport/koerper/actions";
import { EmptyState } from "@/components/layout/empty-state";
import { ChipRow } from "@/components/layout/list-blocks";
import { PageHeader } from "@/components/layout/page-header";
import { chipClass } from "@/components/recipes/chip-select";
import { Button } from "@/components/ui/button";
import {
  bmi,
  bmiCategory,
  bodyFatCategory,
  changeStats,
  CIRCUMFERENCES,
  digitsOf,
  fixed,
  inChartRange,
  longDay,
  measureOf,
  MEASURES,
  metricLabel,
  navyBodyFat,
  navyNeeds,
  seriesOf,
  shortDay,
  signed,
  sparklinePath,
  unitOf,
  weekdayDay,
  whr,
  whrLimit,
  type BodySettings,
  type ChangeStats,
  type ChartRange,
  type Measurement,
  type MeasureKey,
  type MetricKey,
} from "@/lib/domain/body";
import { cn } from "@/lib/utils";
import { BodyChart } from "./body-chart";
import { GuideDialog } from "./guide-dialog";
import { MeasurementSheet } from "./measurement-sheet";
import { SettingsDialog } from "./settings-dialog";

type View = "uebersicht" | "diagramme" | "verlauf";
const VIEWS: { value: View; label: string }[] = [
  { value: "uebersicht", label: "Übersicht" },
  { value: "diagramme", label: "Diagramme" },
  { value: "verlauf", label: "Verlauf" },
];
const RANGES: { value: ChartRange; label: string }[] = [
  { value: "1m", label: "1 M" },
  { value: "3m", label: "3 M" },
  { value: "1j", label: "1 J" },
  { value: "alle", label: "Alle" },
];

/** Pfeil zur Richtung einer Veränderung. */
const arrow = (v: number) => (Math.abs(v) < 0.05 ? "" : v < 0 ? "↓ " : "↑ ");
const withUnit = (text: string, unit: string) => (unit ? `${text} ${unit}` : text);

/**
 * Körpermaße: Übersicht (Gewicht, BMI, Taille-Hüft-Verhältnis, Umfänge mit Verlauf), Diagramme je Größe mit Zeitraum
 * und Kennzahlen, Verlauf aller Messungen; „Neue Messung“, Messanleitung und Einstellungen.
 */
export function BodyTracker({ measurements, settings, today }: { measurements: Measurement[]; settings: BodySettings; today: string }) {
  const [view, setView] = useState<View>("uebersicht");
  const [metric, setMetric] = useState<MetricKey>("weight");
  const [range, setRange] = useState<ChartRange>("alle");
  const [sheet, setSheet] = useState<{ measurement: Measurement | null } | null>(null);
  const [guide, setGuide] = useState<MeasureKey | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const keys = MEASURES.filter((m) => !settings.hidden.includes(m.key)).map((m) => m.key);
  const latest = measurements.at(-1) ?? null;

  function openChart(key: MetricKey) {
    setMetric(key);
    setView("diagramme");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <PageHeader
        title="Körpermaße"
        description={
          latest ? `${measurements.length === 1 ? "1 Messung" : `${measurements.length} Messungen`} · zuletzt ${longDay(latest.date)}` : "Gewicht und Umfänge festhalten."
        }
        actions={
          <>
            <Button type="button" variant="outline" className="h-11 rounded-full px-4" onClick={() => setGuide("weight")}>
              <Ruler aria-hidden />
              Messanleitung
            </Button>
            <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={() => setSettingsOpen(true)} aria-label="Einstellungen">
              <SlidersHorizontal aria-hidden />
            </Button>
          </>
        }
      />

      {measurements.length === 0 ? (
        <EmptyState icon={Ruler} title="Noch keine Messung">
          Trag dein Gewicht und deine Umfänge ein. Wie und wo du misst, steht in der Messanleitung.
        </EmptyState>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-3 rounded-2xl border bg-card p-1" role="group" aria-label="Ansicht">
            {VIEWS.map((v) => (
              <button
                key={v.value}
                type="button"
                aria-pressed={view === v.value}
                onClick={() => setView(v.value)}
                className={cn(
                  "h-11 rounded-xl text-sm font-medium text-muted-foreground transition hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  view === v.value && "bg-foreground text-background hover:text-background",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
          {view === "uebersicht" ? <Overview measurements={measurements} settings={settings} keys={keys} onOpenChart={openChart} onSettings={() => setSettingsOpen(true)} /> : null}
          {view === "diagramme" ? (
            <Charts
              measurements={measurements}
              settings={settings}
              keys={keys}
              metric={metric}
              onMetric={setMetric}
              range={range}
              onRange={setRange}
              today={today}
              onGuide={setGuide}
            />
          ) : null}
          {view === "verlauf" ? <History measurements={measurements} settings={settings} keys={keys} onEdit={(m) => setSheet({ measurement: m })} /> : null}
        </>
      )}

      <button
        type="button"
        onClick={() => setSheet({ measurement: null })}
        className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 inline-flex h-14 items-center gap-2 rounded-full bg-sport px-5 font-semibold text-sport-foreground shadow-lg transition hover:opacity-90 focus-visible:ring-4 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95 md:right-8 md:bottom-8"
      >
        <Plus className="size-5" aria-hidden />
        Neue Messung
      </button>
      {/* Platz, damit der Knopf das Ende der Seite nicht verdeckt */}
      <div className="h-16" aria-hidden />

      {sheet ? (
        <MeasurementSheet
          key={sheet.measurement?.id ?? "neu"}
          measurement={sheet.measurement}
          measurements={measurements}
          keys={keys}
          today={today}
          onClose={() => setSheet(null)}
          onGuide={setGuide}
        />
      ) : null}
      <GuideDialog open={guide != null} onOpenChange={(o) => !o && setGuide(null)} measure={guide ?? "weight"} onMeasure={setGuide} keys={keys} />
      <SettingsDialog settings={settings} open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Übersicht
// ---------------------------------------------------------------------------

function Overview({
  measurements,
  settings,
  keys,
  onOpenChart,
  onSettings,
}: {
  measurements: Measurement[];
  settings: BodySettings;
  keys: MeasureKey[];
  onOpenChart: (key: MetricKey) => void;
  onSettings: () => void;
}) {
  const sex = settings.sex;
  const weight = changeStats(seriesOf(measurements, "weight", settings.heightCm));
  const bmiStats = changeStats(seriesOf(measurements, "bmi", settings.heightCm));
  const whrStats = changeStats(seriesOf(measurements, "whr", settings.heightCm));
  const kfaStats = changeStats(seriesOf(measurements, "kfa", settings.heightCm, sex));
  const limit = whrLimit(sex);

  return (
    <div className="space-y-6">
      <section aria-labelledby="gewicht">
        <h2 id="gewicht" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Gewicht
        </h2>
        {weight ? (
          <>
            <button type="button" onClick={() => onOpenChart("weight")} className="text-left">
              <span className="font-heading text-6xl font-semibold tabular-nums">{fixed(weight.last.value)}</span>
              <span className="ml-1 text-xl text-muted-foreground">kg</span>
            </button>
            <div className="mt-2 flex flex-wrap gap-2 text-sm tabular-nums">
              {weight.count > 1 ? (
                <>
                  <Pill>
                    seit Start {arrow(weight.change)}
                    {signed(weight.change)} kg · {signed(weight.changePercent)} %
                  </Pill>
                  <Pill>seit letzter {signed(weight.sinceLast!)} kg</Pill>
                  {weight.perWeek != null ? <Pill>Trend {signed(weight.perWeek, 2)} kg/Woche</Pill> : null}
                </>
              ) : (
                <Pill>Erste Messung</Pill>
              )}
            </div>
          </>
        ) : (
          <p className="text-muted-foreground">Noch kein Gewicht eingetragen.</p>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {bmiStats ? (
          <button type="button" onClick={() => onOpenChart("bmi")} className="rounded-3xl border bg-card p-4 text-left transition hover:bg-muted/40">
            <span className="block text-xs font-semibold tracking-wide text-muted-foreground uppercase">BMI</span>
            <span className="block font-heading text-3xl font-semibold tabular-nums">{fixed(bmiStats.last.value)}</span>
            <span className="block text-sm text-muted-foreground">
              {bmiCategory(bmiStats.last.value)}
              {bmiStats.count > 1 ? ` · ${signed(bmiStats.change)} seit Start` : ""}
            </span>
          </button>
        ) : (
          <div className="rounded-3xl border bg-card p-4">
            <span className="block text-xs font-semibold tracking-wide text-muted-foreground uppercase">BMI</span>
            {settings.heightCm == null ? (
              <button type="button" onClick={onSettings} className="mt-1 min-h-11 text-left text-sm font-medium text-primary underline-offset-4 hover:underline">
                Körpergröße eintragen
              </button>
            ) : (
              <span className="block text-sm text-muted-foreground">Braucht ein Gewicht.</span>
            )}
          </div>
        )}
        <button type="button" onClick={() => onOpenChart("whr")} className="rounded-3xl border bg-card p-4 text-left transition hover:bg-muted/40">
          <span className="block text-xs font-semibold tracking-wide text-muted-foreground uppercase">Taille-Hüft-Verhältnis</span>
          {whrStats ? (
            <>
              <span className="block font-heading text-3xl font-semibold tabular-nums">{fixed(whrStats.last.value, 2)}</span>
              <span className="block text-sm text-muted-foreground">
                {whrStats.count > 1 ? `${signed(whrStats.change, 2)} seit Start` : "Erste Messung"}
                {limit != null ? ` · ${whrStats.last.value > limit ? "über" : "unter"} ${fixed(limit, 2)}` : ""}
              </span>
            </>
          ) : (
            <span className="block text-sm text-muted-foreground">Braucht Taille und Hüfte.</span>
          )}
        </button>
        {kfaStats && sex ? (
          <button type="button" onClick={() => onOpenChart("kfa")} className="col-span-2 rounded-3xl border bg-card p-4 text-left transition hover:bg-muted/40 md:col-span-1">
            <span className="block text-xs font-semibold tracking-wide text-muted-foreground uppercase">Körperfett (Navy)</span>
            <span className="block font-heading text-3xl font-semibold tabular-nums">
              {fixed(kfaStats.last.value)}
              <span className="ml-1 font-sans text-lg font-normal text-muted-foreground">%</span>
            </span>
            <span className="block text-sm text-muted-foreground">
              {bodyFatCategory(kfaStats.last.value, sex)}
              {kfaStats.count > 1 ? ` · ${signed(kfaStats.change)} Pkt. seit Start` : ""}
            </span>
          </button>
        ) : (
          <div className="col-span-2 rounded-3xl border bg-card p-4 md:col-span-1">
            <span className="block text-xs font-semibold tracking-wide text-muted-foreground uppercase">Körperfett (Navy)</span>
            {sex == null || settings.heightCm == null ? (
              <button type="button" onClick={onSettings} className="mt-1 min-h-11 text-left text-sm font-medium text-primary underline-offset-4 hover:underline">
                {sex == null ? "Geschlecht" : "Körpergröße"} in den Einstellungen eintragen
              </button>
            ) : (
              <span className="mt-1 block text-sm text-muted-foreground">Braucht {navyNeeds(sex)} aus einer Messung.</span>
            )}
          </div>
        )}
      </div>

      <section aria-labelledby="umfaenge" className="border-t pt-5">
        <h2 id="umfaenge" className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Umfänge
        </h2>
        <ul className="grid grid-cols-2 overflow-hidden rounded-3xl border bg-card md:grid-cols-3">
          {CIRCUMFERENCES.filter((m) => keys.includes(m.key)).map((m) => {
            const points = seriesOf(measurements, m.key, null);
            const stats = changeStats(points);
            return (
              <li key={m.key} className="border-r border-b [&:nth-child(2n)]:border-r-0 md:[&:nth-child(2n)]:border-r md:[&:nth-child(3n)]:border-r-0">
                <button type="button" onClick={() => onOpenChart(m.key)} className="flex h-full w-full flex-col gap-1 p-3.5 text-left transition hover:bg-muted/40">
                  <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{m.label}</span>
                  {stats ? <CircumferenceBody stats={stats} values={points.map((p) => p.value)} /> : <span className="text-sm text-muted-foreground">–</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function CircumferenceBody({ stats, values }: { stats: ChangeStats; values: number[] }) {
  return (
    <>
      <span>
        <span className="font-heading text-2xl font-semibold tabular-nums">{fixed(stats.last.value)}</span>
        <span className="ml-1 text-sm text-muted-foreground">cm</span>
      </span>
      {values.length > 1 ? (
        <svg viewBox="0 0 100 24" className="h-6 w-full" preserveAspectRatio="none" aria-hidden>
          <path d={sparklinePath(values, 100, 24)} fill="none" stroke="var(--sport)" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        </svg>
      ) : null}
      {stats.count > 1 ? (
        <span className="text-xs leading-relaxed text-muted-foreground tabular-nums">
          {arrow(stats.change)}
          {signed(stats.change)} cm · {signed(stats.changePercent)} %
          <br />
          letzte {signed(stats.sinceLast!)} cm
          {stats.perWeek != null ? (
            <>
              <br />
              {signed(stats.perWeek, 2)} cm/Woche
            </>
          ) : null}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">Erste Messung</span>
      )}
    </>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-sport-soft px-2.5 py-1 text-sport">{children}</span>;
}

// ---------------------------------------------------------------------------
// Diagramme
// ---------------------------------------------------------------------------

function Charts({
  measurements,
  settings,
  keys,
  metric,
  onMetric,
  range,
  onRange,
  today,
  onGuide,
}: {
  measurements: Measurement[];
  settings: BodySettings;
  keys: MeasureKey[];
  metric: MetricKey;
  onMetric: (m: MetricKey) => void;
  range: ChartRange;
  onRange: (r: ChartRange) => void;
  today: string;
  onGuide: (key: MeasureKey) => void;
}) {
  const metrics: MetricKey[] = ["weight", "bmi", "whr", "kfa", ...keys.filter((k) => k !== "weight")];
  const all = useMemo(() => seriesOf(measurements, metric, settings.heightCm, settings.sex), [measurements, metric, settings.heightCm, settings.sex]);
  const points = inChartRange(all, range, today);
  const stats = changeStats(points);
  const unit = unitOf(metric);
  // Körperfett: Veränderungen in Prozentpunkten, sonst verwechselt man sie mit relativen Prozent
  const changeUnit = metric === "kfa" ? "Pkt." : unit;
  const digits = digitsOf(metric);
  const v = (n: number) => withUnit(fixed(n, digits), unit);
  const guideKey: MeasureKey | null = metric === "bmi" ? "weight" : metric === "whr" ? "waist" : metric === "kfa" ? "neck" : metric;

  return (
    <div className="space-y-4">
      <ChipRow label="Größe">
        {metrics.map((k) => (
          <button key={k} type="button" aria-pressed={metric === k} onClick={() => onMetric(k)} className={chipClass(metric === k)}>
            {metricLabel(k)}
          </button>
        ))}
      </ChipRow>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground tabular-nums">
          {all.length ? `Letzte Messung · ${v(all.at(-1)!.value)} · ${longDay(all.at(-1)!.date)}` : "Noch keine Werte"}
        </p>
        <div className="flex rounded-full border bg-card p-0.5" role="group" aria-label="Zeitraum">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              aria-pressed={range === r.value}
              onClick={() => onRange(r.value)}
              className={cn("h-9 rounded-full px-3 text-sm font-medium text-muted-foreground transition hover:text-foreground", range === r.value && "bg-primary/15 text-primary")}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {metric === "bmi" && settings.heightCm == null ? (
        <p className="rounded-3xl border border-dashed p-6 text-center text-muted-foreground">Für den BMI fehlt deine Körpergröße (Einstellungen oben rechts).</p>
      ) : metric === "kfa" && (settings.sex == null || settings.heightCm == null) ? (
        <p className="rounded-3xl border border-dashed p-6 text-center text-muted-foreground">
          Für den Körperfettanteil fehlen {settings.sex == null ? "dein Geschlecht" : "deine Körpergröße"} (Einstellungen oben rechts).
        </p>
      ) : metric === "kfa" && points.length === 0 ? (
        <p className="rounded-3xl border border-dashed p-6 text-center text-muted-foreground">Die Navy-Methode braucht {navyNeeds(settings.sex)} aus derselben Messung.</p>
      ) : points.length === 0 ? (
        <p className="rounded-3xl border border-dashed p-6 text-center text-muted-foreground">Im Zeitraum gibt es dafür keine Messung.</p>
      ) : (
        <>
          {points.length > 1 ? (
            <BodyChart points={points} label={metricLabel(metric)} unit={unit} digits={digits} />
          ) : (
            <p className="rounded-3xl border border-dashed p-6 text-center text-muted-foreground">Ab zwei Messungen siehst du hier den Verlauf.</p>
          )}
          {stats ? (
            <dl className="grid grid-cols-3 gap-x-3 gap-y-4 border-y py-4">
              <Stat label="Start" value={v(stats.first.value)} sub={longDay(stats.first.date)} />
              <Stat label="Aktuell" value={v(stats.last.value)} sub={longDay(stats.last.date)} />
              <Stat
                label="Veränderung"
                value={stats.count > 1 ? `${arrow(stats.change)}${withUnit(signed(stats.change, digits), changeUnit)}` : "–"}
                sub={stats.count > 1 && metric !== "kfa" ? `${signed(stats.changePercent)} %` : undefined}
              />
              <Stat
                label="Seit letzter Messung"
                value={stats.sinceLast != null ? withUnit(signed(stats.sinceLast, digits), changeUnit) : "–"}
                sub={stats.previous ? `vorher ${shortDay(stats.previous.date)}` : undefined}
              />
              <Stat label="Ø pro Woche" value={stats.perWeek != null ? withUnit(signed(stats.perWeek, digits === 2 ? 3 : 2), changeUnit) : "–"} sub="linearer Trend" />
              <Stat
                label="Ø pro Monat"
                value={stats.perMonth != null ? withUnit(signed(stats.perMonth, digits), changeUnit) : "–"}
                sub={stats.count === 1 ? "1 Messung" : `${stats.count} Messungen`}
              />
            </dl>
          ) : null}
        </>
      )}

      {metric === "kfa" ? (
        <p className="text-xs text-muted-foreground">
          Navy-Methode der US-Marine: geschätzt aus Körpergröße und Umfängen (Männer Bauch auf Nabelhöhe und Hals, Frauen Taille, Hüfte und
          Hals). Weicht oft 3–4 Prozentpunkte vom gemessenen Wert ab; für den Verlauf taugt sie gut, wenn du immer gleich misst.
        </p>
      ) : null}
      {guideKey ? (
        <button type="button" onClick={() => onGuide(guideKey)} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline">
          <BookOpen className="size-4" aria-hidden />
          So misst du {measureOf(guideKey).label}
        </button>
      ) : null}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
      {sub ? <dd className="truncate text-xs text-muted-foreground">{sub}</dd> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Verlauf
// ---------------------------------------------------------------------------

function History({ measurements, settings, keys, onEdit }: { measurements: Measurement[]; settings: BodySettings; keys: MeasureKey[]; onEdit: (m: Measurement) => void }) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const list = [...measurements].reverse();

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteMeasurementAction(id);
      if (!result.ok) toast.error(result.message ?? "Löschen ging nicht.");
      else toast.success("Messung gelöscht");
      setConfirm(null);
    });
  }

  return (
    <div>
      <p className="mb-2 text-sm text-muted-foreground">{list.length === 1 ? "1 Messung" : `${list.length} Messungen`}</p>
      <ul className="divide-y">
        {list.map((m) => {
          const b = bmi(m.weight, settings.heightCm);
          const shown = MEASURES.filter((x) => keys.includes(x.key) && m[x.key] != null);
          const w = whr(m.waist, m.hip);
          const kfa = navyBodyFat(settings.sex, settings.heightCm, m);
          return (
            <li key={m.id} className="py-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline justify-between gap-x-3 font-semibold">
                    {weekdayDay(m.date)}
                    <span className="text-sm font-normal text-muted-foreground tabular-nums">
                      {[b != null ? `BMI ${fixed(b)}` : null, w != null ? `WHR ${fixed(w, 2)}` : null, kfa != null ? `KFA ${fixed(kfa)} %` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
                    {shown.map((x) => (
                      <span key={x.key}>
                        {x.label} <span className="font-semibold text-foreground tabular-nums">{fixed(m[x.key]!)}</span>
                      </span>
                    ))}
                  </p>
                  {m.note ? <p className="mt-1 text-sm text-muted-foreground italic">{m.note}</p> : null}
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <Button type="button" variant="outline" size="sm" className="h-9 rounded-full px-3" onClick={() => onEdit(m)}>
                  Bearbeiten
                </Button>
                {confirm === m.id ? (
                  <Button type="button" variant="destructive" size="sm" className="h-9 rounded-full px-3" onClick={() => remove(m.id)} disabled={pending}>
                    Wirklich löschen
                  </Button>
                ) : (
                  <Button type="button" variant="ghost" size="sm" className="h-9 rounded-full px-3 text-destructive" onClick={() => setConfirm(m.id)}>
                    Löschen
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
