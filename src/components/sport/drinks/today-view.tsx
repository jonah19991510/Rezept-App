"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { Clock3 } from "lucide-react";
import { toast } from "sonner";
import { addDrinkEntryAction, deleteDrinkEntryAction } from "@/app/(app)/sport/getraenke/actions";
import { ChipRow } from "@/components/layout/list-blocks";
import { Button } from "@/components/ui/button";
import {
  entryValues,
  formatLiters,
  formatMg,
  longDate,
  PACE_MARKS,
  paceStatus,
  paceTarget,
  paceText,
  QUICK_AMOUNTS,
  quickLabel,
  sumEntries,
  type Drink,
  type DrinkEntry,
  type PaceTone,
} from "@/lib/domain/drinks";
import { berlinParts, uuid } from "@/lib/domain/workout";
import { todayInBerlin } from "@/lib/domain/week";
import { cn } from "@/lib/utils";
import { DrinkChip, EntryList } from "./drink-parts";
import { EntrySheet, type EntrySheetState } from "./entry-sheet";

const LAST_DRINK_KEY = "getraenke:zuletzt";

const TONE_CLASS: Record<PaceTone, string> = {
  done: "bg-sage",
  good: "bg-sage",
  behind: "bg-macro-carbs",
  far: "bg-destructive",
};

function nowMinutes() {
  const { time } = berlinParts(new Date().toISOString());
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Heute: getrunkene Menge mit Ziel und Prozent, Fortschrittsbalken mit Tempo-Markierungen, Tempo-Hinweis,
 * Eintragen per Getränke-Chip + Schnellmenge, „Andere Menge / Zeit“ und die Einträge von heute.
 */
export function TodayView({ goalMl, drinks, entries, today, initialMinutes }: { goalMl: number; drinks: Drink[]; entries: DrinkEntry[]; today: string; initialMinutes: number }) {
  const router = useRouter();
  const [minutes, setMinutes] = useState(initialMinutes);
  const [drinkId, setDrinkId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<EntrySheetState>(null);
  const [optimistic, addOptimistic] = useOptimistic(entries, (list: DrinkEntry[], entry: DrinkEntry) => [...list, entry]);
  const [, startTransition] = useTransition();
  const selected = drinks.find((d) => d.id === drinkId) ?? drinks[0] ?? null;

  // Zuletzt gewähltes Getränk merken (nur auf diesem Gerät)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LAST_DRINK_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Wert aus dem Gerätespeicher erst nach dem Laden
      if (stored) setDrinkId(stored);
    } catch {}
  }, []);

  // Uhr für das Tempo; nach Mitternacht die Seite neu laden (neuer Tag)
  useEffect(() => {
    const timer = setInterval(() => {
      setMinutes(nowMinutes());
      if (todayInBerlin() !== today) router.refresh();
    }, 30_000);
    return () => clearInterval(timer);
  }, [today, router]);

  function choose(id: string) {
    setDrinkId(id);
    try {
      localStorage.setItem(LAST_DRINK_KEY, id);
    } catch {}
  }

  function quickAdd(ml: number) {
    if (!selected) return;
    const temp: DrinkEntry = {
      id: `neu-${uuid()}`,
      drinkId: selected.id,
      name: selected.name,
      color: selected.color,
      at: new Date().toISOString(),
      date: today,
      minutes: nowMinutes(),
      ml,
      ...entryValues(selected, ml),
    };
    startTransition(async () => {
      addOptimistic(temp);
      const result = await addDrinkEntryAction({ drinkId: selected.id, ml, date: null, time: null });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(`${formatLiters(ml)} ${selected.name} eingetragen`, {
        action: {
          label: "Rückgängig",
          onClick: () => {
            void deleteDrinkEntryAction(result.entry.id).then((r) => (r.ok ? toast.success("Eintrag entfernt") : toast.error(r.message ?? "Rückgängig ging nicht.")));
          },
        },
      });
    });
  }

  const sum = sumEntries(optimistic);
  const percent = goalMl ? Math.round((sum.ml / goalMl) * 100) : 0;
  const status = paceStatus(sum.ml, goalMl, minutes);
  const fill = Math.min(1, sum.ml / goalMl);
  const soll = paceTarget(goalMl, minutes) / goalMl;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border bg-card p-5" aria-label="Heute getrunken">
        <p className="text-sm font-medium text-muted-foreground">{longDate(today)}</p>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <span className="font-heading text-5xl font-semibold tabular-nums">{formatLiters(sum.ml)}</span>
          <span className="text-lg text-muted-foreground tabular-nums">
            von {formatLiters(goalMl, 1)} · {percent} %
          </span>
        </p>

        <div className="relative mt-5 mb-7">
          <div
            className="h-4 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={goalMl}
            aria-valuenow={sum.ml}
            aria-valuetext={`${formatLiters(sum.ml)} von ${formatLiters(goalMl, 1)}`}
          >
            <div className={cn("h-full rounded-full transition-[width] duration-500", status.tone === "done" ? "bg-sage" : "bg-sport")} style={{ width: `${fill * 100}%` }} />
          </div>
          {/* Markierungen: wo man um 10, 13, 16 und 19 Uhr laut Tempo sein sollte */}
          {PACE_MARKS.map((h) => {
            const left = (paceTarget(goalMl, h * 60) / goalMl) * 100;
            return (
              <span key={h} className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: `${left}%` }} aria-hidden>
                <span className="h-4 w-0.5 bg-card/90" />
                <span className="mt-1 text-[0.7rem] text-muted-foreground tabular-nums">{h} Uhr</span>
              </span>
            );
          })}
          {soll > 0 && soll < 1 ? (
            <span className="absolute -top-1.5 h-7 w-1 -translate-x-1/2 rounded-full bg-foreground" style={{ left: `${soll * 100}%` }} title={`Soll jetzt: ${formatLiters(paceTarget(goalMl, minutes))}`} aria-hidden />
          ) : null}
        </div>

        <p className="flex items-start gap-2 text-sm">
          <span className={cn("mt-1 size-2.5 shrink-0 rounded-full", TONE_CLASS[status.tone])} aria-hidden />
          <span>{paceText(sum.ml, goalMl, minutes)}</span>
        </p>
      </section>

      <section aria-labelledby="eintragen" className="space-y-3">
        <h2 id="eintragen" className="text-lg font-semibold">
          Eintragen
        </h2>
        {drinks.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
            Du hast noch keine Getränke.{" "}
            <Link href="/sport/getraenke/liste" className="font-medium text-primary underline-offset-4 hover:underline">
              Getränk hinzufügen
            </Link>
          </p>
        ) : (
          <>
            <ChipRow label="Getränk" className="-mx-4 px-4 md:mx-0 md:px-0">
              {drinks.map((d) => (
                <DrinkChip key={d.id} name={d.name} color={d.color} active={selected?.id === d.id} onClick={() => choose(d.id)} />
              ))}
            </ChipRow>
            <div className="grid grid-cols-5 gap-2">
              {QUICK_AMOUNTS.map((q) => (
                <button
                  key={q.ml}
                  type="button"
                  onClick={() => quickAdd(q.ml)}
                  aria-label={`${quickLabel(q.ml)} Liter ${selected?.name ?? ""} eintragen`}
                  className="flex min-h-16 flex-col items-center justify-center rounded-2xl border bg-card px-1 py-2 transition hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:translate-y-px"
                >
                  <span className="text-lg font-semibold tabular-nums">{quickLabel(q.ml)}</span>
                  <span className="text-xs text-muted-foreground">{q.label}</span>
                </button>
              ))}
            </div>
            <Button type="button" variant="outline" className="h-11 w-full rounded-full" onClick={() => setSheet({ mode: "add", date: today, drinkId: selected?.id ?? null })}>
              <Clock3 aria-hidden />
              Andere Menge / Zeit
            </Button>
          </>
        )}
      </section>

      <section aria-labelledby="heute-getrunken" className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="heute-getrunken" className="text-lg font-semibold">
            Heute getrunken
          </h2>
          <p className="text-sm text-muted-foreground tabular-nums">
            {sum.count === 1 ? "1 Getränk" : `${sum.count} Getränke`} · {formatMg(sum.caffeine)} Koffein
          </p>
        </div>
        <EntryList entries={optimistic} onSelect={(entry) => (entry.id.startsWith("neu-") ? undefined : setSheet({ mode: "edit", entry }))} empty="Noch nichts eingetragen. Tipp auf eine Menge oben." />
      </section>

      <EntrySheet state={sheet} onClose={() => setSheet(null)} drinks={drinks} today={today} />
    </div>
  );
}
