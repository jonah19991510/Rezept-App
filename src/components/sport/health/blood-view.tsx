"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronDown, Droplet, Pencil } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { buildSeries, changes, formatValue, previousValue, rangeOf, rangeText, STATUS_LABEL, statusOf, type BloodTest, type Change, type Series } from "@/lib/domain/blood";
import { sparklinePath } from "@/lib/domain/body";
import type { Sex } from "@/lib/domain/supplements";
import { cn } from "@/lib/utils";
import { Fab, longDate, MedicalNote, SectionTitle, shortDate, statusTone, ToneBadge, toneText } from "./health-parts";
import { BloodSheet } from "./blood-sheet";

const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${formatValue(Math.abs(v))}`;

/**
 * Blutwerte-Archiv: Veränderungen seit dem vorigen Test (Status gewechselt, besser/schlechter), alle Werte im Verlauf
 * mit kleinem Graphen und die einzelnen Tests mit Vergleich zum Test davor.
 */
export function BloodView({ tests, sex, today }: { tests: BloodTest[]; sex: Sex | null; today: string }) {
  const [sheet, setSheet] = useState<{ test: BloodTest | null } | null>(null);
  const [openSeries, setOpenSeries] = useState<string | null>(null);
  const [openTest, setOpenTest] = useState<string | null>(tests[0]?.id ?? null);
  const series = buildSeries(tests, sex);
  const changeList = changes(series);
  const latest = tests[0] ?? null;
  const flagged = latest ? latest.values.filter((v) => ["niedrig", "hoch"].includes(statusOf(v, sex))).length : 0;

  return (
    <>
      {tests.length === 0 ? (
        <EmptyState icon={Droplet} title="Noch kein Bluttest">
          Trag die Werte deines Befunds ein. Ab dem zweiten Test zeigt die App, was sich verändert hat – besser, schlechter oder jetzt im Normbereich.
        </EmptyState>
      ) : (
        <div className="space-y-7">
          <p className="text-muted-foreground">
            {tests.length === 1 ? "1 Test" : `${tests.length} Tests`} · zuletzt {longDate(latest!.date)}
            {latest!.lab ? ` (${latest!.lab})` : ""} ·{" "}
            <span className={flagged ? "font-medium text-amber-700 dark:text-amber-300" : "text-sport"}>
              {flagged ? `${flagged} außerhalb des Bereichs` : "alle Werte im Bereich"}
            </span>
          </p>

          {changeList.length ? (
            <section aria-labelledby="veraenderungen">
              <SectionTitle id="veraenderungen" aside="letzter Test zum Test davor">
                Veränderungen
              </SectionTitle>
              <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
                {changeList.map((c) => (
                  <ChangeRow key={c.series.key} change={c} />
                ))}
              </ul>
            </section>
          ) : tests.length === 1 ? (
            <p className="rounded-3xl border border-dashed p-5 text-center text-sm text-muted-foreground">Ab dem zweiten Bluttest siehst du hier, was sich verändert hat.</p>
          ) : null}

          <section aria-labelledby="werte">
            <SectionTitle id="werte" aside={`${series.length} Werte`}>
              Alle Werte im Verlauf
            </SectionTitle>
            <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
              {series.map((s) => (
                <SeriesRow key={s.key} series={s} open={openSeries === s.key} onToggle={() => setOpenSeries(openSeries === s.key ? null : s.key)} />
              ))}
            </ul>
          </section>

          <section aria-labelledby="tests">
            <SectionTitle id="tests">Bluttests</SectionTitle>
            <ul className="grid gap-3">
              {tests.map((t) => (
                <TestCard
                  key={t.id}
                  test={t}
                  series={series}
                  sex={sex}
                  open={openTest === t.id}
                  onToggle={() => setOpenTest(openTest === t.id ? null : t.id)}
                  onEdit={() => setSheet({ test: t })}
                />
              ))}
            </ul>
          </section>
        </div>
      )}

      <MedicalNote>
        Übliche Bereiche für Erwachsene; jedes Labor hat eigene (stehen auf dem Befund und gehen hier vor). Einzelne Werte schwanken – Veränderungen am besten ärztlich
        einordnen lassen.
      </MedicalNote>

      <Fab onClick={() => setSheet({ test: null })}>Bluttest</Fab>
      {sheet ? <BloodSheet key={sheet.test?.id ?? "neu"} test={sheet.test} last={latest} sex={sex} today={today} onClose={() => setSheet(null)} /> : null}
    </>
  );
}

const DIRECTION = {
  besser: { label: "Besser", tone: "good" as const },
  schlechter: { label: "Schlechter", tone: "warn" as const },
  gleich: { label: "Gleich", tone: "neutral" as const },
  neutral: { label: "Verändert", tone: "neutral" as const },
};

function ChangeRow({ change: c }: { change: Change }) {
  const Icon = c.direction === "gleich" ? ArrowRight : c.delta > 0 ? ArrowUpRight : ArrowDownRight;
  const dir = DIRECTION[c.direction];
  return (
    <li className="grid gap-1 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-medium">{c.series.name}</span>
        <ToneBadge tone={dir.tone}>{dir.label}</ToneBadge>
      </div>
      <p className="flex flex-wrap items-center gap-x-2 tabular-nums">
        <span className="text-muted-foreground">{formatValue(c.previous.value)}</span>
        <Icon className={cn("size-4", toneText(dir.tone))} aria-hidden />
        <span className="font-semibold">
          {formatValue(c.latest.value)} {c.series.unit}
        </span>
        <span className="text-sm text-muted-foreground">
          ({signed(c.delta)}
          {c.percent != null ? ` · ${signed(Math.round(c.percent))} %` : ""})
        </span>
      </p>
      <p className="text-sm text-muted-foreground">
        {shortDate(c.previous.date)} → {shortDate(c.latest.date)}
        {c.statusChanged ? (
          <>
            {" · "}
            <span className={toneText(statusTone(c.latest.status))}>
              {STATUS_LABEL[c.previous.status]} → {c.latest.status === "normal" ? "jetzt im Bereich" : STATUS_LABEL[c.latest.status]}
            </span>
          </>
        ) : (
          ` · ${STATUS_LABEL[c.latest.status]}`
        )}
      </p>
    </li>
  );
}

function SeriesRow({ series: s, open, onToggle }: { series: Series; open: boolean; onToggle: () => void }) {
  const last = s.points.at(-1)!;
  const range = rangeText(s.range);
  return (
    <li>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset">
        <span className="min-w-0 flex-1">
          <span className="block font-medium wrap-anywhere">{s.name}</span>
          <span className="block text-sm text-muted-foreground">
            {s.points.length === 1 ? "1 Messung" : `${s.points.length} Messungen`}
            {range ? ` · Bereich ${range}` : ""}
          </span>
        </span>
        {s.points.length > 1 ? (
          <svg viewBox="0 0 60 24" className="h-6 w-14 shrink-0" preserveAspectRatio="none" aria-hidden>
            <path d={sparklinePath(s.points.map((p) => p.value), 60, 24)} fill="none" stroke="var(--sport)" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
          </svg>
        ) : null}
        <span className="shrink-0 text-right">
          <span className={cn("block font-semibold tabular-nums", (last.status === "hoch" || last.status === "niedrig") && toneText("warn"))}>
            {formatValue(last.value)} <span className="text-sm font-normal text-muted-foreground">{s.unit}</span>
          </span>
          <span className="block text-xs text-muted-foreground">{STATUS_LABEL[last.status]}</span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div className="px-4 pb-4">
          {s.marker?.hint ? <p className="mb-2 text-sm text-muted-foreground">{s.marker.hint}</p> : null}
          <ul className="divide-y rounded-2xl border">
            {[...s.points].reverse().map((p, i, arr) => {
              const before = arr[i + 1];
              return (
                <li key={p.testId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm tabular-nums">
                  <span className="text-muted-foreground">{longDate(p.date)}</span>
                  <span className="flex items-center gap-2">
                    {before ? <span className="text-xs text-muted-foreground">{signed(p.value - before.value)}</span> : null}
                    <span className={cn("font-medium", p.status !== "normal" && p.status !== "unbekannt" && toneText("warn"))}>
                      {formatValue(p.value)} {s.unit}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

function TestCard({
  test,
  series,
  sex,
  open,
  onToggle,
  onEdit,
}: {
  test: BloodTest;
  series: Series[];
  sex: Sex | null;
  open: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const flagged = test.values.filter((v) => ["niedrig", "hoch"].includes(statusOf(v, sex))).length;
  return (
    <li className="overflow-hidden rounded-3xl border bg-card">
      <div className="flex items-center gap-2 p-2 pl-4">
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{longDate(test.date)}</span>
            <span className="block text-sm text-muted-foreground">
              {[test.lab, `${test.values.length} ${test.values.length === 1 ? "Wert" : "Werte"}`].filter(Boolean).join(" · ")}
              {flagged ? <span className="text-amber-700 dark:text-amber-300"> · {flagged} auffällig</span> : null}
            </span>
          </span>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition", open && "rotate-180")} aria-hidden />
        </button>
        <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={onEdit} aria-label={`Bluttest vom ${longDate(test.date)} bearbeiten`}>
          <Pencil aria-hidden />
        </Button>
      </div>
      {open ? (
        <div className="border-t px-4 pt-2 pb-4">
          <ul className="divide-y">
            {test.values.map((v, i) => {
              const status = statusOf(v, sex);
              const prev = previousValue(series, test.id, v);
              const range = rangeText(rangeOf(v, sex));
              return (
                <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium wrap-anywhere">{v.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {range ? `Bereich ${range}` : "ohne Bereich"}
                      {prev ? ` · vorher ${formatValue(prev.value)} (${signed(v.value - prev.value)})` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 tabular-nums">
                    <span className="font-semibold">
                      {formatValue(v.value)} <span className="text-xs font-normal text-muted-foreground">{v.unit}</span>
                    </span>
                    {status !== "unbekannt" ? <ToneBadge tone={statusTone(status)}>{STATUS_LABEL[status]}</ToneBadge> : null}
                  </span>
                </li>
              );
            })}
          </ul>
          {test.note ? <p className="mt-2 text-sm text-muted-foreground">{test.note}</p> : null}
        </div>
      ) : null}
    </li>
  );
}
