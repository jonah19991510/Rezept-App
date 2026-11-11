"use client";

import { useState } from "react";
import { CalendarCheck, CalendarClock, Stethoscope } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { relativeDays, sortCheckups, type Checkup, type DueInfo } from "@/lib/domain/medical";
import { daysBetween } from "@/lib/domain/week";
import { cn } from "@/lib/utils";
import { CheckupSheet, VisitSheet } from "./checkup-sheet";
import { Fab, longDate, MedicalNote, SectionTitle, ToneBadge, type Tone } from "./health-parts";

const STATE: Record<DueInfo["state"], { label: string; tone: Tone }> = {
  ueberfaellig: { label: "Fällig", tone: "bad" },
  bald: { label: "Bald", tone: "warn" },
  geplant: { label: "Geplant", tone: "good" },
  offen: { label: "Offen", tone: "neutral" },
};

/**
 * Vorsorge: Untersuchungen nach Fälligkeit (überfällig, bald, geplant, offen) mit letztem Besuch, nächstem Termin
 * (ausgemacht oder aus dem Rhythmus) und „War beim Termin“.
 */
export function CheckupView({ checkups, today }: { checkups: Checkup[]; today: string }) {
  const [sheet, setSheet] = useState<{ checkup: Checkup | null } | null>(null);
  const [visit, setVisit] = useState<Checkup | null>(null);
  const sorted = sortCheckups(checkups, today);
  const attention = sorted.filter((c) => c.info.state === "ueberfaellig" || c.info.state === "bald");
  const rest = sorted.filter((c) => c.info.state !== "ueberfaellig" && c.info.state !== "bald");

  return (
    <>
      {checkups.length === 0 ? (
        <EmptyState icon={Stethoscope} title="Noch keine Vorsorge">
          Leg Untersuchungen wie Zahnarzt, Check-up oder Hautkrebs-Screening an. Trag ein, wann du dort warst und wann du wieder hin musst – die App zeigt, was fällig ist.
        </EmptyState>
      ) : (
        <div className="space-y-7">
          {attention.length ? (
            <section aria-labelledby="faellig">
              <SectionTitle id="faellig">Jetzt dran</SectionTitle>
              <ul className="grid gap-3 md:grid-cols-2">
                {attention.map((c) => (
                  <CheckupCard key={c.id} checkup={c} info={c.info} today={today} onOpen={() => setSheet({ checkup: c })} onVisit={() => setVisit(c)} />
                ))}
              </ul>
            </section>
          ) : (
            <p className="flex items-center gap-2 rounded-3xl border bg-sport-soft/50 p-4 text-sm">
              <CalendarCheck className="size-5 shrink-0 text-sport" aria-hidden />
              In den nächsten 30 Tagen ist nichts fällig.
            </p>
          )}
          {rest.length ? (
            <section aria-labelledby="alle">
              <SectionTitle id="alle">Weitere Vorsorge</SectionTitle>
              <ul className="grid gap-3 md:grid-cols-2">
                {rest.map((c) => (
                  <CheckupCard key={c.id} checkup={c} info={c.info} today={today} onOpen={() => setSheet({ checkup: c })} onVisit={() => setVisit(c)} />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}

      <MedicalNote>Gesetzliche Vorsorge und Rhythmen ändern sich mit dem Alter; im Zweifel bei der Krankenkasse oder in der Praxis nachfragen.</MedicalNote>

      <Fab onClick={() => setSheet({ checkup: null })}>Vorsorge</Fab>
      {sheet ? <CheckupSheet key={sheet.checkup?.id ?? "neu"} checkup={sheet.checkup} onClose={() => setSheet(null)} /> : null}
      {visit ? <VisitSheet key={visit.id} checkup={visit} today={today} onClose={() => setVisit(null)} /> : null}
    </>
  );
}

function CheckupCard({ checkup: c, info, today, onOpen, onVisit }: { checkup: Checkup; info: DueInfo; today: string; onOpen: () => void; onVisit: () => void }) {
  const state = STATE[info.state];
  return (
    <li className={cn("flex flex-col gap-3 rounded-3xl border bg-card p-4", info.state === "ueberfaellig" && "border-destructive/40")}>
      <button type="button" onClick={onOpen} className="text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
        <span className="flex items-start justify-between gap-2">
          <span className="font-semibold wrap-anywhere">{c.name}</span>
          <ToneBadge tone={state.tone}>{state.label}</ToneBadge>
        </span>
        {c.doctor ? <span className="block text-sm text-muted-foreground">{c.doctor}</span> : null}
      </button>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Zuletzt</dt>
          <dd className="tabular-nums">
            {info.lastVisit ? (
              <>
                {longDate(info.lastVisit)}
                <span className="block text-xs text-muted-foreground">{relativeDays(daysBetween(today, info.lastVisit))}</span>
              </>
            ) : (
              <span className="text-muted-foreground">noch nicht eingetragen</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{info.source === "termin" ? "Termin" : "Wieder fällig"}</dt>
          <dd className="tabular-nums">
            {info.due ? (
              <>
                {longDate(info.due)}
                <span className={cn("block text-xs", info.state === "ueberfaellig" ? "text-destructive" : "text-muted-foreground")}>
                  {info.daysLeft! < 0 ? `seit ${relativeDays(info.daysLeft!).replace("vor ", "")}` : relativeDays(info.daysLeft!)}
                  {info.source === "rhythmus" ? ` · alle ${c.intervalMonths} Mon.` : ""}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">{c.intervalMonths ? `alle ${c.intervalMonths} Mon.` : "kein Termin"}</span>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-auto flex gap-2">
        <Button type="button" variant="outline" className="h-11 flex-1 rounded-full" onClick={onVisit}>
          <CalendarCheck aria-hidden />
          War beim Termin
        </Button>
        <Button type="button" variant="ghost" className="h-11 rounded-full" onClick={onOpen} aria-label={`${c.name}: Termin planen oder bearbeiten`}>
          <CalendarClock aria-hidden />
          Planen
        </Button>
      </div>
    </li>
  );
}
