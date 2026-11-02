"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { setHabitCountAction } from "@/app/(app)/sport/habits/actions";
import { checkIndex, type HabitCheck } from "@/lib/domain/habits";

/**
 * Abhak-Zahlen mit sofortiger Anzeige: Änderungen gelten lokal sofort und gehen je Gewohnheit und Tag der Reihe nach
 * an den Server (schnelles Mehrfach-Tippen kommt in der richtigen Reihenfolge an). Schlägt etwas fehl, springt der
 * Wert zurück. Neue Daten vom Server ersetzen die lokalen Änderungen, sobald sie sie enthalten.
 */
export function useHabitCounts(checks: HabitCheck[]) {
  const [overrides, setOverrides] = useState<Map<string, number>>(() => new Map());
  const [source, setSource] = useState(checks);
  if (checks !== source) {
    setSource(checks);
    // Bestätigte Änderungen fallen weg; noch laufende (Server kennt sie noch nicht) bleiben stehen
    const server = checkIndex(checks);
    setOverrides((m) => new Map([...m].filter(([key, count]) => {
      const [habitId, date] = key.split("|");
      return (server.get(habitId)?.get(date) ?? 0) !== count;
    })));
  }
  const queue = useRef(new Map<string, Promise<unknown>>());

  const index = useMemo(() => {
    const base = checkIndex(checks);
    for (const [key, count] of overrides) {
      const [habitId, date] = key.split("|");
      let days = base.get(habitId);
      if (!days) base.set(habitId, (days = new Map()));
      days.set(date, count);
    }
    return base;
  }, [checks, overrides]);

  function setCount(habitId: string, date: string, count: number, previous: number) {
    const key = `${habitId}|${date}`;
    setOverrides((m) => new Map(m).set(key, count));
    const run = (queue.current.get(key) ?? Promise.resolve()).then(async () => {
      const result = await setHabitCountAction(habitId, date, count);
      if (!result.ok) {
        setOverrides((m) => new Map(m).set(key, previous));
        toast.error(result.message);
      }
    });
    queue.current.set(key, run);
  }

  return { index, setCount };
}
