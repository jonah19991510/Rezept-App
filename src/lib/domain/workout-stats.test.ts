import { describe, expect, it } from "vitest";
import {
  estimate1RM,
  exerciseOptions,
  exerciseProgress,
  exerciseRecords,
  inRange,
  mondaysBetween,
  rangeStart,
  recentRecords,
  setsPerMuscle,
  statsTotals,
  streakWeeks,
  trainingCalendar,
  weeklyStats,
  type StatsWorkout,
} from "./workout-stats";

const set = (weightKg: number | null, reps: number | null, kind: "warmup" | "normal" = "normal") => ({ kind, weightKg, reps, seconds: null, distanceM: null });

const bench = (sets: ReturnType<typeof set>[]) => ({
  exerciseId: "bench",
  name: "Bankdrücken",
  muscleGroup: "chest" as const,
  secondaryMuscles: ["triceps" as const, "shoulders" as const],
  tracking: "weight_reps" as const,
  sets,
});

const workouts: StatsWorkout[] = [
  { id: "w1", title: "A", date: "2026-10-05", durationSeconds: 3600, exercises: [bench([set(20, 10, "warmup"), set(60, 8), set(60, 8)])] },
  { id: "w2", title: "A", date: "2026-10-12", durationSeconds: 2700, exercises: [bench([set(62.5, 8), set(62.5, 6)])] },
  {
    id: "w3",
    title: "B",
    date: "2026-10-21",
    durationSeconds: 3000,
    exercises: [
      bench([set(65, 5)]),
      { exerciseId: "plank", name: "Plank", muscleGroup: "core", secondaryMuscles: [], tracking: "time", sets: [{ kind: "normal", weightKg: null, reps: null, seconds: 60, distanceM: null }] },
    ],
  },
];

describe("estimate1RM", () => {
  it("rechnet nach Epley bis 12 Wiederholungen", () => {
    expect(estimate1RM(100, 1)).toBe(100);
    expect(estimate1RM(60, 8)).toBe(76);
    expect(estimate1RM(60, 15)).toBeNull();
    expect(estimate1RM(null, 5)).toBeNull();
  });
});

describe("Zeitraum und Wochen", () => {
  it("bestimmt den Start und filtert", () => {
    expect(rangeStart("4w", "2026-10-26")).toBe("2026-09-29");
    expect(rangeStart("alle", "2026-10-26")).toBeNull();
    expect(inRange(workouts, "2026-10-10").map((w) => w.id)).toEqual(["w2", "w3"]);
  });

  it("zählt je Woche Trainings, Minuten, Volumen und Arbeitssätze", () => {
    const weeks = weeklyStats(workouts, mondaysBetween("2026-10-05", "2026-10-26"));
    expect(weeks.map((w) => w.monday)).toEqual(["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
    expect(weeks[0]).toEqual({ monday: "2026-10-05", workouts: 1, minutes: 60, volumeKg: 960, sets: 2 });
    expect(weeks[3].workouts).toBe(0);
  });
});

describe("Übungen", () => {
  it("sortiert die Auswahl nach Häufigkeit", () => {
    expect(exerciseOptions(workouts).map((e) => [e.id, e.sessions])).toEqual([
      ["bench", 3],
      ["plank", 1],
    ]);
  });

  it("liefert den Verlauf und die Bestwerte", () => {
    const sessions = exerciseProgress(workouts, "bench");
    expect(sessions.map((s) => [s.date, s.bestWeightKg, s.best1RM])).toEqual([
      ["2026-10-05", 60, 76],
      ["2026-10-12", 62.5, 79.2],
      ["2026-10-21", 65, 75.8],
    ]);
    const records = exerciseRecords(sessions);
    expect(records.weight).toMatchObject({ value: 65, date: "2026-10-21", detail: "× 5" });
    expect(records.oneRM).toMatchObject({ value: 79.2, workoutId: "w2" });
    expect(records.volume?.value).toBe(960);
  });

  it("findet neue Bestwerte, das erste Training zählt nicht", () => {
    expect(recentRecords(workouts).map((r) => [r.workoutId, r.kind, r.value, r.previous])).toEqual([["w2", "1rm", 79.2, 76]]);
  });
});

describe("Muskelgruppen, Serie, Kalender, Kennzahlen", () => {
  it("zählt Sätze pro Muskel (Nebenmuskeln halb)", () => {
    const muscles = setsPerMuscle(workouts, 4);
    expect(muscles[0]).toEqual({ muscle: "chest", total: 5, perWeek: 1.3 });
    expect(muscles.find((m) => m.muscle === "triceps")?.total).toBe(2.5);
  });

  it("zählt Wochen am Stück, auch wenn die aktuelle noch leer ist", () => {
    expect(streakWeeks(workouts, "2026-10-26")).toBe(3);
    expect(streakWeeks(workouts, "2026-11-09")).toBe(0);
  });

  it("baut den Kalender ohne Tage in der Zukunft", () => {
    const calendar = trainingCalendar(workouts, "2026-10-21", 3);
    expect(calendar.map((w) => w.monday)).toEqual(["2026-10-05", "2026-10-12", "2026-10-19"]);
    expect(calendar[0].days[0]).toEqual({ date: "2026-10-05", count: 1 });
    expect(calendar[2].days[3]).toEqual({ date: "2026-10-22", count: null });
  });

  it("fasst den Zeitraum zusammen", () => {
    expect(statsTotals(workouts, 4)).toEqual({ workouts: 3, sets: 6, volumeKg: 2160, minutes: 155, avgMinutes: 52, perWeek: 0.8 });
  });
});
