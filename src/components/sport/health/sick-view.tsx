"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Pencil, Pill, Thermometer, ThermometerSun } from "lucide-react";
import { toast } from "sonner";
import { addTemperatureAction, endSickEpisodeAction } from "@/app/(app)/sport/medizin/actions";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseDecimal } from "@/lib/domain/decimal";
import { episodeDays, feverLevel, maxTemperature, sickStats, topSymptoms, type MedicationIntake, type SickEpisode } from "@/lib/domain/medical";
import { berlinParts } from "@/lib/domain/workout";
import { cn } from "@/lib/utils";
import { Fab, longDate, MedicalNote, SectionTitle, shortDate, StatTile, ToneBadge } from "./health-parts";
import { SickSheet } from "./sick-sheet";

const celsius = (v: number) => `${new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v)} °C`;
const daysText = (n: number) => (n === 1 ? "1 Tag" : `${n} Tage`);

/**
 * Krankheitstage: laufende Krankheit oben (Fieber messen, „Wieder gesund“), Kennzahlen (Krankheitstage dieses Jahr,
 * letzte 12 Monate, Krankschreibungen), häufige Symptome und alle Krankheiten nach Jahr.
 */
export function SickView({ episodes, intakes, today }: { episodes: SickEpisode[]; intakes: MedicationIntake[]; today: string }) {
  const [sheet, setSheet] = useState<{ episode: SickEpisode | null } | null>(null);
  const [now, setNow] = useState("12:00");
  const running = episodes.filter((e) => e.end == null);
  const past = episodes.filter((e) => e.end != null);
  const stats = sickStats(episodes, today);
  const symptoms = topSymptoms(episodes);
  const years = [...new Set(past.map((e) => e.start.slice(0, 4)))];

  function open(episode: SickEpisode | null) {
    setNow(berlinParts(new Date().toISOString()).time);
    setSheet({ episode });
  }

  return (
    <>
      {running.length ? (
        <section aria-label="Gerade krank" className="mb-7 grid gap-3">
          {running.map((e) => (
            <RunningCard key={e.id} episode={e} intakes={intakes.filter((i) => i.episodeId === e.id)} today={today} onEdit={() => open(e)} />
          ))}
        </section>
      ) : null}

      {episodes.length === 0 ? (
        <EmptyState icon={Thermometer} title="Keine Krankheitstage">
          Wenn du krank bist, trag es hier ein – mit Symptomen und Fieber. So siehst du später, wie oft und wie lange du krank warst.
        </EmptyState>
      ) : (
        <div className="space-y-7">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatTile label={`Krank ${today.slice(0, 4)}`} value={daysText(stats.thisYear)} sub={`${stats.episodesThisYear}× krank gewesen`} />
            <StatTile label="Letzte 12 Monate" value={daysText(stats.last12Months)} sub="Krankheitstage" />
            <StatTile className="col-span-2 md:col-span-1" label="Krankgeschrieben" value={stats.withSickNote} sub={`von ${stats.episodesThisYear} in ${today.slice(0, 4)}`} />
          </div>

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

          {years.map((year) => (
            <section key={year} aria-labelledby={`jahr-${year}`}>
              <SectionTitle id={`jahr-${year}`} aside={daysText(past.filter((e) => e.start.startsWith(year)).reduce((sum, e) => sum + episodeDays(e, today), 0))}>
                {year}
              </SectionTitle>
              <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
                {past
                  .filter((e) => e.start.startsWith(year))
                  .map((e) => (
                    <EpisodeRow key={e.id} episode={e} meds={intakes.filter((i) => i.episodeId === e.id)} today={today} onOpen={() => open(e)} />
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <MedicalNote>Bei hohem oder anhaltendem Fieber, Atemnot oder starken Beschwerden ärztliche Hilfe holen (Bereitschaftsdienst 116 117, Notruf 112).</MedicalNote>

      <Fab onClick={() => open(null)}>Krank eintragen</Fab>
      {sheet ? <SickSheet key={sheet.episode?.id ?? "neu"} episode={sheet.episode} kind="krank" today={today} now={now} onClose={() => setSheet(null)} /> : null}
    </>
  );
}

function RunningCard({ episode: e, intakes, today, onEdit }: { episode: SickEpisode; intakes: MedicationIntake[]; today: string; onEdit: () => void }) {
  const [temp, setTemp] = useState("");
  const [pending, startTransition] = useTransition();
  const max = maxTemperature(e);
  const lastTemp = e.temperatures.at(-1) ?? null;
  const days = episodeDays(e, today);

  function measure() {
    const c = parseDecimal(temp);
    if (c == null || c < 34 || c > 43) {
      toast.error("Bitte eine Temperatur zwischen 34 und 43 °C eintragen.");
      return;
    }
    const now = berlinParts(new Date().toISOString());
    startTransition(async () => {
      const result = await addTemperatureAction(e.id, { date: now.date, time: now.time, celsius: c });
      if (!result.ok) toast.error(result.message ?? "Das ging gerade nicht.");
      else {
        toast.success(`${celsius(c)} eingetragen`);
        setTemp("");
      }
    });
  }

  function healthy() {
    startTransition(async () => {
      const result = await endSickEpisodeAction(e.id, today);
      if (!result.ok) toast.error(result.message ?? "Das ging gerade nicht.");
      else toast.success("Schön, dass du wieder gesund bist!");
    });
  }

  return (
    <div className="rounded-3xl border border-sport/30 bg-sport-soft/50 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sport text-sport-foreground">
          <ThermometerSun className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-sport uppercase">Gerade krank · Tag {days}</p>
          <p className="text-lg font-semibold wrap-anywhere">{e.title}</p>
          <p className="text-sm text-muted-foreground">
            seit {longDate(e.start)}
            {e.sickNote ? " · krankgeschrieben" : ""}
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={onEdit} aria-label="Krankheit bearbeiten">
          <Pencil aria-hidden />
        </Button>
      </div>

      {e.symptoms.length ? <p className="mt-3 text-sm">{e.symptoms.join(" · ")}</p> : null}

      {lastTemp ? (
        <p className="mt-2 text-sm text-muted-foreground tabular-nums">
          Zuletzt <TempValue c={lastTemp.celsius} /> ({shortDate(lastTemp.date)}
          {lastTemp.time ? `, ${lastTemp.time}` : ""}){max != null && max > lastTemp.celsius ? <> · höchstens <TempValue c={max} /></> : null}
        </p>
      ) : null}
      {intakes.length ? (
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Pill className="size-3.5" aria-hidden />
          {[...new Set(intakes.map((i) => i.name))].join(", ")}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1 basis-40">
          <Input
            inputMode="decimal"
            value={temp}
            onChange={(ev) => setTemp(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") measure();
            }}
            placeholder="z. B. 38,4"
            className="h-11 rounded-full bg-card pr-10 text-base tabular-nums"
            aria-label="Gemessene Temperatur in Grad Celsius"
          />
          <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm text-muted-foreground">°C</span>
        </div>
        <Button type="button" variant="outline" className="h-11 rounded-full bg-card" onClick={measure} disabled={pending || !temp.trim()}>
          <Thermometer aria-hidden />
          Messen
        </Button>
        <Button type="button" className="h-11 rounded-full" onClick={healthy} disabled={pending}>
          Wieder gesund
        </Button>
      </div>
      <Link href="/sport/medizin/medikamente" className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline">
        Medikament eintragen
      </Link>
    </div>
  );
}

function TempValue({ c }: { c: number }) {
  const level = feverLevel(c);
  return <span className={cn("font-medium", level === "fieber" && "text-destructive", level === "erhoeht" && "text-amber-700 dark:text-amber-300")}>{celsius(c)}</span>;
}

function EpisodeRow({ episode: e, meds, today, onOpen }: { episode: SickEpisode; meds: MedicationIntake[]; today: string; onOpen: () => void }) {
  const max = maxTemperature(e);
  const days = episodeDays(e, today);
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium wrap-anywhere">{e.title}</span>
            {e.sickNote ? <ToneBadge tone="neutral">AU</ToneBadge> : null}
            {max != null && feverLevel(max) === "fieber" ? <ToneBadge tone="bad">Fieber {celsius(max)}</ToneBadge> : null}
          </span>
          <span className="block text-sm text-muted-foreground tabular-nums">
            {e.start === e.end ? longDate(e.start) : `${shortDate(e.start)} – ${shortDate(e.end!)}`}
          </span>
          {e.symptoms.length ? <span className="block text-sm text-muted-foreground">{e.symptoms.join(", ")}</span> : null}
          {meds.length ? (
            <span className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Pill className="size-3.5 shrink-0" aria-hidden />
              {[...new Set(meds.map((m) => m.name))].join(", ")}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 font-semibold tabular-nums">{daysText(days)}</span>
      </button>
    </li>
  );
}
