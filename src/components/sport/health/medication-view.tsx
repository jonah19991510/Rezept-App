"use client";

import { useState } from "react";
import { Pill, RotateCcw } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { intakesByDay, medicationSummaries, relativeDays, type MedicationIntake, type SickEpisode } from "@/lib/domain/medical";
import { daysBetween } from "@/lib/domain/week";
import { berlinParts } from "@/lib/domain/workout";
import { Fab, longDate, MedicalNote, SectionTitle } from "./health-parts";
import { MedicationSheet, type MedicationDraft } from "./medication-sheet";

const PAGE_DAYS = 20;

/**
 * Medikamente: „Meine Medikamente“ (zusammengefasst je Name, mit Gründen und „Nochmal genommen“) und alle Einnahmen
 * nach Tag, mit Uhrzeit, Dosis, Grund und Krankheit.
 */
export function MedicationView({ intakes, episodes, today }: { intakes: MedicationIntake[]; episodes: SickEpisode[]; today: string }) {
  const [sheet, setSheet] = useState<{ intake: MedicationIntake | null; draft: MedicationDraft | null; now: string } | null>(null);
  const [shownDays, setShownDays] = useState(PAGE_DAYS);
  const summaries = medicationSummaries(intakes);
  const days = intakesByDay(intakes);
  const episodeTitle = new Map(episodes.map((e) => [e.id, e.title]));

  const open = (intake: MedicationIntake | null, draft: MedicationDraft | null = null) => setSheet({ intake, draft, now: berlinParts(new Date().toISOString()).time });

  return (
    <>
      {intakes.length === 0 ? (
        <EmptyState icon={Pill} title="Noch keine Medikamente">
          Trag ein, wann du welches Medikament nimmst und warum – bei Bedarf auch zu einer Krankheit. Häufige Medikamente trägst du danach mit einem Tipp nochmal ein.
        </EmptyState>
      ) : (
        <div className="space-y-7">
          <section aria-labelledby="meine">
            <SectionTitle id="meine" aside={`${summaries.length} ${summaries.length === 1 ? "Medikament" : "Medikamente"}`}>
              Meine Medikamente
            </SectionTitle>
            <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
              {summaries.map((s) => (
                <li key={s.name} className="flex items-center gap-3 p-4">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium wrap-anywhere">
                      {s.name}
                      {s.lastDose ? <span className="font-normal text-muted-foreground"> · {s.lastDose}</span> : null}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {s.count}× · zuletzt {relativeDays(daysBetween(today, s.lastDate))}
                    </span>
                    {s.reasons.length ? <span className="block text-sm text-muted-foreground">gegen {s.reasons.slice(0, 4).join(", ")}</span> : null}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 shrink-0 rounded-full"
                    onClick={() => open(null, { name: s.name, dose: s.lastDose, reason: s.lastReason })}
                    aria-label={`${s.name} nochmal genommen`}
                  >
                    <RotateCcw aria-hidden />
                    Nochmal
                  </Button>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="einnahmen">
            <SectionTitle id="einnahmen" aside={`${intakes.length} insgesamt`}>
              Einnahmen
            </SectionTitle>
            <div className="grid gap-4">
              {days.slice(0, shownDays).map((d) => (
                <div key={d.date}>
                  <p className="mb-1.5 px-1 text-sm font-semibold">{d.date === today ? "Heute" : longDate(d.date)}</p>
                  <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
                    {d.items.map((i) => (
                      <li key={i.id}>
                        <button
                          type="button"
                          onClick={() => open(i)}
                          className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
                        >
                          <span className="w-12 shrink-0 pt-0.5 text-sm text-muted-foreground tabular-nums">{i.time ?? "–"}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium wrap-anywhere">
                              {i.name}
                              {i.dose ? <span className="font-normal text-muted-foreground"> · {i.dose}</span> : null}
                            </span>
                            {i.reason || i.episodeId ? (
                              <span className="block text-sm text-muted-foreground">
                                {[i.reason, i.episodeId && episodeTitle.get(i.episodeId) ? `bei ${episodeTitle.get(i.episodeId)}` : null].filter(Boolean).join(" · ")}
                              </span>
                            ) : null}
                            {i.note ? <span className="block text-sm text-muted-foreground italic">{i.note}</span> : null}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            {days.length > shownDays ? (
              <Button type="button" variant="outline" className="mt-4 h-11 w-full rounded-full" onClick={() => setShownDays((n) => n + PAGE_DAYS)}>
                Ältere anzeigen
              </Button>
            ) : null}
          </section>
        </div>
      )}

      <MedicalNote>Dosierung und Wechselwirkungen laut Beipackzettel oder ärztlich/in der Apotheke abklären. Die App prüft keine Wechselwirkungen.</MedicalNote>

      <Fab onClick={() => open(null)}>Medikament</Fab>
      {sheet ? (
        <MedicationSheet
          key={sheet.intake?.id ?? `neu-${sheet.draft?.name ?? ""}`}
          intake={sheet.intake}
          draft={sheet.draft}
          summaries={summaries}
          episodes={episodes}
          today={today}
          now={sheet.now}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </>
  );
}
