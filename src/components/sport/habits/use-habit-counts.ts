"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { setHabitCountAction, setRoutineDaysAction } from "@/app/(app)/sport/habits/actions";
import { checkIndex, routineCheckIndex, type HabitCheck, type RoutineCheck, type RoutineDayUpdate } from "@/lib/domain/habits";

const NO_ROUTINE_CHECKS: RoutineCheck[] = [];

/**
 * Abhak-Zahlen und Häkchen je Routine mit sofortiger Anzeige: Änderungen gelten lokal sofort und gehen je Gewohnheit
 * und Tag der Reihe nach an den Server (schnelles Mehrfach-Tippen kommt in der richtigen Reihenfolge an). Schlägt
 * etwas fehl, springt der Wert zurück. Neue Daten vom Server ersetzen die lokalen Änderungen, sobald sie sie enthalten.
 */
export function useHabitCounts(checks: HabitCheck[], routineChecks: RoutineCheck[] = NO_ROUTINE_CHECKS) {
  const [overrides, setOverrides] = useState<Map<string, number>>(() => new Map());
  const [routineOverrides, setRoutineOverrides] = useState<Map<string, string[]>>(() => new Map());
  const [source, setSource] = useState({ checks, routineChecks });
  if (checks !== source.checks || routineChecks !== source.routineChecks) {
    setSource({ checks, routineChecks });
    // Bestätigte Änderungen fallen weg; noch laufende (Server kennt sie noch nicht) bleiben stehen
    const server = checkIndex(checks);
    setOverrides((m) => new Map([...m].filter(([key, count]) => {
      const [habitId, date] = key.split("|");
      return (server.get(habitId)?.get(date) ?? 0) !== count;
    })));
    const serverRoutines = routineCheckIndex(routineChecks);
    setRoutineOverrides((m) => new Map([...m].filter(([key, ids]) => {
      const have = serverRoutines.get(key) ?? new Set<string>();
      return have.size !== ids.length || ids.some((id) => !have.has(id));
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

  const routineIndex = useMemo(() => {
    const base = routineCheckIndex(routineChecks);
    for (const [key, ids] of routineOverrides) base.set(key, new Set(ids));
    return base;
  }, [routineChecks, routineOverrides]);

  /** Nach allen laufenden Änderungen dieser Schlüssel ausführen. */
  function enqueue(keys: string[], run: () => Promise<void>) {
    const before = Promise.all(keys.map((k) => queue.current.get(k) ?? Promise.resolve()));
    const next = before.then(run);
    for (const k of keys) queue.current.set(k, next);
  }

  function setCount(habitId: string, date: string, count: number, previous: number) {
    const key = `${habitId}|${date}`;
    const previousRoutines = routineIndex.get(key);
    setOverrides((m) => new Map(m).set(key, count));
    // Weniger als in Routinen abgehakt: Häkchen je Routine fallen weg (wie auf dem Server)
    if (previousRoutines && previousRoutines.size > count) setRoutineOverrides((m) => new Map(m).set(key, []));
    enqueue([key], async () => {
      const result = await setHabitCountAction(habitId, date, count);
      if (!result.ok) {
        setOverrides((m) => new Map(m).set(key, previous));
        if (previousRoutines) setRoutineOverrides((m) => new Map(m).set(key, [...previousRoutines]));
        toast.error(result.message);
      }
    });
  }

  /** Punkte von Routinen abhaken (ein oder mehrere auf einmal, ein Aufruf an den Server). */
  function setRoutineDays(updates: RoutineDayUpdate[]) {
    if (updates.length === 0) return;
    const keys = updates.map((u) => `${u.habitId}|${u.date}`);
    const previous = updates.map((u, i) => ({ count: index.get(u.habitId)?.get(u.date) ?? 0, routineIds: [...(routineIndex.get(keys[i]) ?? [])] }));
    setOverrides((m) => {
      const next = new Map(m);
      updates.forEach((u, i) => next.set(keys[i], u.count));
      return next;
    });
    setRoutineOverrides((m) => {
      const next = new Map(m);
      updates.forEach((u, i) => next.set(keys[i], u.routineIds));
      return next;
    });
    enqueue(keys, async () => {
      const result = await setRoutineDaysAction(updates);
      if (!result.ok) {
        setOverrides((m) => {
          const next = new Map(m);
          previous.forEach((p, i) => next.set(keys[i], p.count));
          return next;
        });
        setRoutineOverrides((m) => {
          const next = new Map(m);
          previous.forEach((p, i) => next.set(keys[i], p.routineIds));
          return next;
        });
        toast.error(result.message);
      }
    });
  }

  return { index, routineIndex, setCount, setRoutineDays };
}
