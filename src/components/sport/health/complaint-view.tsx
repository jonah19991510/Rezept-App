"use client";

import { useState, useTransition } from "react";
import { Brain, Pill } from "lucide-react";
import { toast } from "sonner";
import { endSickEpisodeAction } from "@/app/(app)/sport/medizin/actions";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { complaintStats, episodeDays, topSymptoms, topTitles, type MedicationIntake, type SickEpisode } from "@/lib/domain/medical";
import { berlinParts } from "@/lib/domain/workout";
import { cn } from "@/lib/utils";
import { Fab, longDate, MedicalNote, SectionTitle, shortDate, StatTile } from "./health-parts";
import { severityClass, SickSheet } from "./sick-sheet";

const daysText = (n: number) => (n === 1 ? "1 Tag" : `${n} Tage`);
const MONTH = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });
const monthLabel = (iso: string) => MONTH.format(new Date(`${iso.slice(0, 7)}-01T00:00:00Z`));

/**
 * Beschwerden (Kopfschmerzen, Migräne, Rückenschmerzen …): zählen nicht als Krankheitstage. Kennzahlen (Tage dieses
 * Jahr, letzte 30 Tage, Ø Stärke), häufigste Beschwerden und Symptome, Liste nach Monat mit Stärke und Medikamenten.
 */
export function ComplaintView({ complaints, intakes, today }: { complaints: SickEpisode[]; intakes: MedicationIntake[]; today: string }) {
  const [sheet, setSheet] = useState<{ episode: SickEpisode | null; now: string } | null>(null);
  const stats = complaintStats(complaints, today);
  const top = topTitles(complaints);
  const symptoms = topSymptoms(complaints);
  const running = complaints.filter((e) => e.end == null);
  const months = [...new Set(complaints.map((e) => e.start.slice(0, 7)))];

  const open = (episode: SickEpisode | null) => setSheet({ episode, now: berlinParts(new Date().toISOString()).time });

  return (
    <>
      {complaints.length === 0 ? (
        <EmptyState icon={Brain} title="Keine Beschwerden">
          Kopfschmerzen, Migräne oder Rückenschmerzen trägst du hier ein – mit Stärke und was geholfen hat. Sie zählen nicht als Krankheitstage.
        </EmptyState>
      ) : (
        <div className="space-y-7">
          {running.length ? (
            <section aria-label="Hält noch an" className="grid gap-3">
              {running.map((e) => (
                <RunningComplaint key={e.id} episode={e} today={today} onEdit={() => open(e)} />
              ))}
            </section>
          ) : null}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatTile label={`Tage ${today.slice(0, 4)}`} value={daysText(stats.daysThisYear)} sub={`${stats.countThisYear}× eingetragen`} />
            <StatTile label="Letzte 30 Tage" value={daysText(stats.daysLast30)} sub="mit Beschwerden" />
            <StatTile
              className="col-span-2 md:col-span-1"
              label="Ø Stärke"
              value={stats.avgSeverity != null ? new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(stats.avgSeverity) : "–"}
              sub={stats.avgSeverity != null ? `von 10 in ${today.slice(0, 4)}` : "Stärke beim Eintragen wählen"}
            />
          </div>

          {top.length > 1 ? (
            <section aria-labelledby="haeufig">
              <SectionTitle id="haeufig">Am häufigsten</SectionTitle>
              <ul className="flex flex-wrap gap-2">
                {top.map((t) => (
                  <li key={t.title} className="rounded-full border bg-card px-3 py-1.5 text-sm">
                    {t.title} <span className="text-muted-foreground tabular-nums">· {t.count}×</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {symptoms.length ? (
            <section aria-labelledby="symptome">
              <SectionTitle id="symptome">Häufigste Symptome</SectionTitle>
              <ul className="flex flex-wrap gap-2">
                {symptoms.map((s) => (
                  <li key={s.symptom} className="rounded-full border bg-card px-3 py-1.5 text-sm">
                    {s.symptom} <span className="text-muted-foreground tabular-nums">· {s.count}×</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {months.map((month) => {
            const list = complaints.filter((e) => e.start.startsWith(month));
            return (
              <section key={month} aria-labelledby={`monat-${month}`}>
                <SectionTitle id={`monat-${month}`} aside={`${list.length}×`}>
                  {monthLabel(month)}
                </SectionTitle>
                <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
                  {list.map((e) => (
                    <ComplaintRow key={e.id} episode={e} meds={intakes.filter((i) => i.episodeId === e.id || (i.date === e.start && !i.episodeId && sameReason(i, e)))} today={today} onOpen={() => open(e)} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <MedicalNote>
        Beschwerden zählen nicht als Krankheitstage. Bei ungewohnt starken, neuen oder häufigen Kopfschmerzen ärztlich abklären lassen; Schmerzmittel höchstens an 10 Tagen im Monat.
      </MedicalNote>

      <Fab onClick={() => open(null)}>Beschwerde</Fab>
      {sheet ? <SickSheet key={sheet.episode?.id ?? "neu"} episode={sheet.episode} kind="beschwerde" today={today} now={sheet.now} onClose={() => setSheet(null)} /> : null}
    </>
  );
}

/** Einnahme ohne Verknüpfung, deren Grund zur Beschwerde passt („Kopfschmerzen“ am selben Tag). */
const sameReason = (i: MedicationIntake, e: SickEpisode) => i.reason != null && i.reason.trim().toLowerCase() === e.title.trim().toLowerCase();

function SeverityBadge({ value }: { value: number }) {
  return (
    <span className={cn("inline-grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-semibold tabular-nums", severityClass(value))} title={`Stärke ${value} von 10`}>
      <span className="sr-only">Stärke </span>
      {value}
    </span>
  );
}

function RunningComplaint({ episode: e, today, onEdit }: { episode: SickEpisode; today: string; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();
  function done() {
    startTransition(async () => {
      const result = await endSickEpisodeAction(e.id, today);
      if (!result.ok) toast.error(result.message ?? "Das ging gerade nicht.");
      else toast.success(`${e.title} vorbei`);
    });
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-amber-500/30 bg-amber-500/10 p-4">
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
        <span className="block text-xs font-semibold tracking-wide text-amber-700 uppercase dark:text-amber-300">Hält noch an · Tag {episodeDays(e, today)}</span>
        <span className="flex items-center gap-2 text-lg font-semibold">
          {e.title}
          {e.severity ? <SeverityBadge value={e.severity} /> : null}
        </span>
        <span className="block text-sm text-muted-foreground">seit {longDate(e.start)}</span>
      </button>
      <Button type="button" className="h-11 rounded-full" onClick={done} disabled={pending}>
        Vorbei
      </Button>
    </div>
  );
}

function ComplaintRow({ episode: e, meds, today, onOpen }: { episode: SickEpisode; meds: MedicationIntake[]; today: string; onOpen: () => void }) {
  const days = episodeDays(e, today);
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium wrap-anywhere">{e.title}</span>
            {e.severity ? <SeverityBadge value={e.severity} /> : null}
          </span>
          <span className="block text-sm text-muted-foreground tabular-nums">
            {e.end == null ? `seit ${shortDate(e.start)}` : e.start === e.end ? longDate(e.start) : `${shortDate(e.start)} – ${shortDate(e.end)}`}
          </span>
          {e.symptoms.length ? <span className="block text-sm text-muted-foreground">{e.symptoms.join(", ")}</span> : null}
          {meds.length ? (
            <span className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Pill className="size-3.5 shrink-0" aria-hidden />
              {[...new Set(meds.map((m) => (m.dose ? `${m.name} ${m.dose}` : m.name)))].join(", ")}
            </span>
          ) : null}
          {e.note ? <span className="block text-sm text-muted-foreground italic">{e.note}</span> : null}
        </span>
        {days > 1 ? <span className="shrink-0 font-semibold tabular-nums">{daysText(days)}</span> : null}
      </button>
    </li>
  );
}
