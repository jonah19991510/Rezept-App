import { describe, expect, it } from "vitest";
import type { ExerciseOption } from "./exercises";
import {
  berlinParts,
  berlinToIso,
  differsFromPlan,
  finalizeEditedSession,
  emptySet,
  finalizeSession,
  formatSet,
  nextPlanDay,
  parseClock,
  planDayFromWorkout,
  resolveSet,
  summarizeSession,
  toSyncPayload,
  uuid,
  warmupSets,
  workoutDuration,
  type Session,
} from "./workout";

const bench: ExerciseOption = { id: "bench", name: "Bankdrücken", muscleGroup: "chest", secondaryMuscles: [], equipment: "barbell", tracking: "weight_reps", own: false };
const plank: ExerciseOption = { ...bench, id: "plank", name: "Plank", tracking: "time", equipment: "bodyweight" };

describe("warmupSets", () => {
  it("Langhantel: leere Stange, dann 50/70/85 %, auf 2,5 kg gerundet", () => {
    expect(warmupSets(100, "barbell")).toEqual([
      { weightKg: 20, reps: 10 },
      { weightKg: 50, reps: 8 },
      { weightKg: 70, reps: 5 },
      { weightKg: 85, reps: 3 },
    ]);
  });

  it("lässt bei leichten Gewichten doppelte und zu schwere Sätze weg", () => {
    expect(warmupSets(30, "barbell")).toEqual([
      { weightKg: 20, reps: 8 },
      { weightKg: 25, reps: 3 },
    ]);
    expect(warmupSets(20, "barbell")).toEqual([]);
    expect(warmupSets(0, "barbell")).toEqual([]);
  });

  it("Kurzhantel ohne Stange in 2-kg-Schritten", () => {
    expect(warmupSets(30, "dumbbell")).toEqual([
      { weightKg: 16, reps: 8 },
      { weightKg: 22, reps: 5 },
      { weightKg: 26, reps: 3 },
    ]);
  });
});

describe("Anzeige und Eingabe", () => {
  it("formatiert Sätze je nach Erfassung", () => {
    expect(formatSet({ weightKg: 62.5, reps: 8, seconds: null, distanceM: null }, "weight_reps")).toBe("62,5 kg × 8");
    expect(formatSet({ weightKg: null, reps: 12, seconds: null, distanceM: null }, "bodyweight_reps")).toBe("× 12");
    expect(formatSet({ weightKg: 10, reps: 8, seconds: null, distanceM: null }, "bodyweight_reps")).toBe("+10 kg × 8");
    expect(formatSet({ weightKg: null, reps: null, seconds: 45, distanceM: null }, "time")).toBe("0:45");
    expect(formatSet({ weightKg: null, reps: null, seconds: 1800, distanceM: 5000 }, "distance_time")).toBe("5 km · 30:00");
    expect(formatSet({ weightKg: null, reps: null, seconds: 1800, distanceM: 5000, speedKmh: 10 }, "distance_time")).toBe("10 km/h · 5 km · 30:00");
  });

  it("Laufband: aus zwei von km/h, km und Zeit ergibt sich der dritte", () => {
    const run = (speed: string, distance: string, seconds: string) => resolveSet({ ...emptySet(), speed, distance, seconds }, null, "distance_time");
    expect(run("10", "", "30:00")).toMatchObject({ speedKmh: 10, distanceM: 5000, seconds: 1800 });
    expect(run("", "5", "30:00")).toMatchObject({ speedKmh: 10 });
    expect(run("12", "3", "")).toMatchObject({ seconds: 900 });
    // alle drei eingetragen: nichts wird überschrieben
    expect(run("11", "5", "30:00")).toMatchObject({ speedKmh: 11, distanceM: 5000, seconds: 1800 });
    // zwei eingetragen: der dritte kommt aus der Rechnung, nicht vom letzten Mal
    const last = { weightKg: null, reps: null, seconds: 1800, distanceM: 5000, speedKmh: 10 };
    expect(resolveSet({ ...emptySet(), speed: "11", seconds: "20:00" }, last, "distance_time")).toMatchObject({ distanceM: 3667 });
    // nur einer eingetragen: der Rest vom letzten Mal
    expect(resolveSet({ ...emptySet(), speed: "11" }, last, "distance_time")).toMatchObject({ speedKmh: 11, distanceM: 5000, seconds: 1800 });
    // ohne Erfassung „Strecke und Zeit“ wird nichts ergänzt
    expect(resolveSet({ ...emptySet(), speed: "10", seconds: "30:00" }, null)).toMatchObject({ distanceM: null });
  });

  it("Stände vom Handy ohne Geschwindigkeit (vor dem 27.10.2026) gehen weiter", () => {
    const old = { ...emptySet(), distance: "5", seconds: "30:00" };
    delete old.speed;
    expect(resolveSet(old, null, "distance_time")).toMatchObject({ speedKmh: 10, distanceM: 5000 });
  });

  it("speichert die Geschwindigkeit mit", () => {
    const session: Session = {
      id: "w",
      planId: null,
      planDayId: null,
      title: "Laufband",
      startedAt: "2026-10-27T10:00:00Z",
      endedAt: null,
      note: "",
      version: 1,
      exercises: [
        { id: "e", exercise: { ...plank, tracking: "distance_time" }, repsMin: null, repsMax: null, targetSeconds: null, restSeconds: null, warmup: false, note: "", sets: [{ ...emptySet(), speed: "10,5", distance: "3,5", seconds: "20:00" }] },
      ],
    };
    expect(toSyncPayload(session).exercises[0].sets[0]).toMatchObject({ speed_kmh: 10.5, distance_m: 3500, seconds: 1200 });
  });

  it("liest Zeiten als Sekunden oder Min:Sek", () => {
    expect(parseClock("45")).toBe(45);
    expect(parseClock("1:30")).toBe(90);
    expect(parseClock("1:02:00")).toBe(3720);
    expect(parseClock("abc")).toBeNull();
  });

  it("nimmt für leere Felder die Werte vom letzten Mal", () => {
    const last = { weightKg: 60, reps: 8, seconds: null, distanceM: null };
    expect(resolveSet({ ...emptySet(), reps: "10" }, last)).toMatchObject({ weightKg: 60, reps: 10 });
    expect(resolveSet({ ...emptySet(), weight: "62,5" }, null)).toMatchObject({ weightKg: 62.5, reps: null });
  });

  it("erzeugt gültige UUIDs", () => {
    expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("nextPlanDay", () => {
  const days = [{ id: "a" }, { id: "b" }, { id: "c" }];
  it("nimmt den Tag nach dem letzten, am Ende wieder den ersten", () => {
    expect(nextPlanDay(days, null)?.id).toBe("a");
    expect(nextPlanDay(days, "a")?.id).toBe("b");
    expect(nextPlanDay(days, "c")?.id).toBe("a");
    expect(nextPlanDay(days, "gelöscht")?.id).toBe("a");
    expect(nextPlanDay([], "a")).toBeNull();
  });
});

const session: Session = {
  id: "w1",
  planId: "p1",
  planDayId: "d1",
  title: "Push · Tag A",
  startedAt: "2026-10-26T10:00:00.000Z",
  endedAt: null,
  note: "",
  version: 3,
  exercises: [
    {
      id: "e1",
      exercise: bench,
      repsMin: 8,
      repsMax: 12,
      targetSeconds: null,
      restSeconds: 90,
      warmup: true,
      note: "",
      sets: [
        { ...emptySet("warmup", "s0"), weight: "20", reps: "10", done: true, doneAt: "x" },
        { ...emptySet("normal", "s1"), done: true, doneAt: "x" },
        { ...emptySet("normal", "s2"), weight: "62,5", reps: "8", done: true, doneAt: "x" },
        { ...emptySet("normal", "s3") },
      ],
    },
    { id: "e2", exercise: plank, repsMin: null, repsMax: null, targetSeconds: 45, restSeconds: 60, warmup: false, note: "", sets: [emptySet("normal", "s4")] },
  ],
};

describe("finalizeSession", () => {
  it("lässt Unerledigtes weg und füllt leere Felder mit dem letzten Mal", () => {
    const done = finalizeSession(session, "2026-10-26T11:05:00.000Z", { bench: [{ weightKg: 60, reps: 9, seconds: null, distanceM: null }] });
    expect(done.version).toBe(4);
    expect(done.exercises).toHaveLength(1);
    expect(done.exercises[0].sets.map((s) => [s.id, s.weight, s.reps])).toEqual([
      ["s0", "20", "10"],
      ["s1", "60", "9"],
      ["s2", "62,5", "8"],
    ]);
  });
});

describe("summarizeSession", () => {
  it("zählt Arbeitssätze, Volumen und Dauer", () => {
    const summary = summarizeSession({ ...session, endedAt: "2026-10-26T11:05:00.000Z" }, new Date());
    expect(summary).toEqual({ exercises: 1, sets: 2, volumeKg: 500, durationSeconds: 3900 });
  });
});

describe("toSyncPayload", () => {
  it("wandelt Eingaben in Zahlen", () => {
    const payload = toSyncPayload(session);
    expect(payload.exercises[0].sets[2]).toMatchObject({ weight_kg: 62.5, reps: 8, kind: "normal", done: true });
    expect(payload.exercises[0].sets[1]).toMatchObject({ weight_kg: null, reps: null });
  });
});

describe("planDayFromWorkout", () => {
  const plan = [
    { exerciseId: "bench", sets: 3, repsMin: 8, repsMax: 12, targetSeconds: null, restSeconds: 90, warmup: true, note: "eng" },
    { exerciseId: "fly", sets: 3, repsMin: 12, repsMax: 15, targetSeconds: null, restSeconds: 60, warmup: false, note: null },
  ];
  it("übernimmt Reihenfolge und Satzzahl, behält Vorgaben", () => {
    const next = planDayFromWorkout(plan, [
      { exerciseId: "dips", normalSets: 2, repsMin: 8, repsMax: 12, targetSeconds: null, restSeconds: 90, warmup: false, note: null },
      { exerciseId: "bench", normalSets: 4, repsMin: 5, repsMax: 5, targetSeconds: null, restSeconds: 120, warmup: false, note: null },
    ]);
    expect(next.map((e) => [e.exerciseId, e.sets])).toEqual([
      ["dips", 2],
      ["bench", 4],
    ]);
    expect(next[1]).toMatchObject({ repsMin: 8, repsMax: 12, note: "eng", warmup: true });
    expect(differsFromPlan(plan, next)).toBe(true);
    expect(differsFromPlan(plan, plan)).toBe(false);
  });
});

describe("workoutDuration", () => {
  it("rundet auf ganze Minuten", () => {
    expect(workoutDuration(20)).toBe("unter 1 Min.");
    expect(workoutDuration(23 * 60 + 38)).toBe("24 Min.");
    expect(workoutDuration(65 * 60)).toBe("1 Std. 5 Min.");
    expect(workoutDuration(120 * 60)).toBe("2 Std.");
  });
});

describe("Nachtragen", () => {
  it("rechnet deutsche Zeit in UTC um (Winter- und Sommerzeit)", () => {
    expect(berlinToIso("2026-10-26", "18:30")).toBe("2026-10-26T17:30:00.000Z");
    expect(berlinToIso("2026-07-01", "08:00")).toBe("2026-07-01T06:00:00.000Z");
    expect(berlinToIso("2026-13-01", "08:00")).toBeNull();
    expect(berlinParts("2026-07-01T06:00:00.000Z")).toEqual({ date: "2026-07-01", time: "08:00" });
  });

  it("zählt eingetragene Sätze auch ohne Haken und lässt leere weg", () => {
    const edited: Session = {
      ...session,
      endedAt: "2026-10-26T11:00:00.000Z",
      exercises: [
        {
          ...session.exercises[0],
          sets: [
            { ...emptySet("normal", "a"), weight: "60", reps: "8" },
            { ...emptySet("normal", "b"), done: true, doneAt: null },
            { ...emptySet("normal", "c") },
          ],
        },
        { ...session.exercises[1], sets: [emptySet("normal", "d")] },
      ],
    };
    const result = finalizeEditedSession(edited, { bench: [{ weightKg: 55, reps: 10, seconds: null, distanceM: null }] });
    expect(result.exercises).toHaveLength(1);
    expect(result.exercises[0].sets.map((s) => [s.id, s.weight, s.reps, s.done, s.doneAt])).toEqual([
      ["a", "60", "8", true, "2026-10-26T11:00:00.000Z"],
      ["b", "55", "10", true, "2026-10-26T11:00:00.000Z"],
    ]);
  });
});
