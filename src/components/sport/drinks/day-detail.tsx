"use client";

import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { byDrink, formatLiters, formatMg, longDate, sumEntries, type Drink, type DrinkEntry } from "@/lib/domain/drinks";
import { formatNumber } from "@/lib/format";
import { EntryList, StackedBar } from "./drink-parts";
import { EntrySheet, type EntrySheetState } from "./entry-sheet";

/**
 * Ein Tag im Detail: Menge, % vom Ziel, Balken nach Getränk, Anzahl · Koffein · Zucker, die Einträge (antippen zum
 * Bearbeiten) und „Für diesen Tag nachtragen“. `prev`/`next` sind die Pfeile (Knopf oder Link).
 */
export function DayDetail({
  date,
  entries,
  goalMl,
  drinks,
  today,
  prev,
  next,
}: {
  date: string;
  entries: DrinkEntry[];
  goalMl: number;
  drinks: Drink[];
  today: string;
  prev: ReactNode;
  next: ReactNode;
}) {
  const [sheet, setSheet] = useState<EntrySheetState>(null);
  const sum = sumEntries(entries);
  return (
    <section className="rounded-3xl border bg-card p-4 md:p-5" aria-labelledby={`tag-${date}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        {prev}
        <h2 id={`tag-${date}`} className="text-center text-lg font-semibold">
          {date === today ? `Heute, ${longDate(date).split(", ")[1]}` : longDate(date)}
        </h2>
        {next}
      </div>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-heading text-3xl font-semibold tabular-nums">{formatLiters(sum.ml)}</span>
        <span className="text-muted-foreground tabular-nums">{Math.round((sum.ml / goalMl) * 100)} % vom Ziel</span>
      </p>
      <StackedBar parts={byDrink(entries)} max={goalMl} className="mt-3" />
      <p className="mt-2 text-sm text-muted-foreground tabular-nums">
        {sum.count === 1 ? "1 Getränk" : `${sum.count} Getränke`} · {formatMg(sum.caffeine)} Koffein · {formatNumber(sum.sugar, 1)} g Zucker
      </p>
      <div className="mt-4">
        <EntryList entries={entries} onSelect={(entry) => setSheet({ mode: "edit", entry })} empty="An diesem Tag ist nichts eingetragen." />
      </div>
      <Button type="button" variant="outline" className="mt-3 h-11 w-full rounded-full" onClick={() => setSheet({ mode: "add", date, drinkId: drinks[0]?.id ?? null })}>
        <Plus aria-hidden />
        Für diesen Tag nachtragen
      </Button>
      <EntrySheet state={sheet} onClose={() => setSheet(null)} drinks={drinks} today={today} />
    </section>
  );
}
