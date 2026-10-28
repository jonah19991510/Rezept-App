import { describe, expect, it } from "vitest";
import {
  estimate1RM,
  exerciseOptions,
  exerciseProgress,
  exerciseRecords,
  inRange,
  mondaysBetween,
  rangeEnd,
  rangeStart,
  recentRecords,
  setsPerMuscle,
  statsTotals,
  streakWeeks,
  trainingCalendar,
  weeklyStats,
  workoutKind,
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

  it("Ausdauer: Strecke und Zeit je Training zusammen, Ø Tempo aus Strecke ÷ Zeit", () => {
    const run = (distanceM: number | null, seconds: number | null, speedKmh: number | null = null) => ({ kind: "normal" as const, weightKg: null, reps: null, seconds, distanceM, speedKmh });
    const treadmill = (id: string, date: string, sets: ReturnType<typeof run>[]): StatsWorkout => ({
      id,
      title: "Laufband",
      date,
      durationSeconds: 1800,
      exercises: [{ exerciseId: "band", name: "Laufband", muscleGroup: "cardio", secondaryMuscles: [], tracking: "distance_time", sets }],
    });
    const sessions = exerciseProgress(
      [treadmill("a", "2026-10-20", [run(2000, 720), run(3000, 1080)]), treadmill("b", "2026-10-27", [run(null, 1800, 4.8)])],
      "band",
    );
    expect(sessions[0]).toMatchObject({ totalDistanceM: 5000, totalSeconds: 1800, speedKmh: 10 });
    // ohne Strecke: die eingetragene Geschwindigkeit
    expect(sessions[1]).toMatchObject({ totalDistanceM: null, totalSeconds: 1800, speedKmh: 4.8 });
    const records = exerciseRecords(sessions);
    expect(records.totalDistance?.value).toBe(5000);
    expect(records.speed).toMatchObject({ value: 10, workoutId: "a" });
    expect(records.totalSeconds?.value).toBe(1800);
  });

  it("Woche: Montag bis Sonntag der gewählten Kalenderwoche", () => {
    expect(rangeStart("woche", "2026-10-28")).toBe("2026-10-26");
    expect(rangeStart("woche", "2026-10-28", "2026-10-12")).toBe("2026-10-12");
    expect(rangeEnd("woche", "2026-10-12")).toBe("2026-10-18");
    expect(rangeEnd("3m", "2026-10-12")).toBeNull();
    expect(inRange(workouts, "2026-10-12", "2026-10-18").map((w) => w.id)).toEqual(["w2"]);
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
    expect(calendar[0].days[0]).toEqual({ date: "2026-10-05", count: 1, kind: "strength" });
    expect(calendar[0].days[1]).toEqual({ date: "2026-10-06", count: 0, kind: null });
    expect(calendar[2].days[3]).toEqual({ date: "2026-10-22", count: null, kind: null });
  });

  it("unterscheidet im Kalender Kraft, Ausdauer und beides", () => {
    const run = { kind: "normal" as const, weightKg: null, reps: null, seconds: 1200, distanceM: 3000 };
    const treadmill = { exerciseId: "band", name: "Laufband", muscleGroup: "cardio" as const, secondaryMuscles: [], tracking: "distance_time" as const, sets: [run] };
    const cardioOnly: StatsWorkout = { id: "c1", title: "Laufen", date: "2026-10-06", durationSeconds: 1200, exercises: [treadmill] };
    const mixed: StatsWorkout = { id: "c2", title: "A + Laufen", date: "2026-10-13", durationSeconds: 4000, exercises: [bench([set(60, 8)]), treadmill] };
    // Kraft und Ausdauer als zwei Trainings am selben Tag
    const sameDay: StatsWorkout = { ...cardioOnly, id: "c3", date: "2026-10-05" };
    expect(workoutKind(cardioOnly)).toBe("cardio");
    expect(workoutKind(mixed)).toBe("both");
    expect(workoutKind(workouts[0])).toBe("strength");
    // Ausdauer-Übung ohne erledigten Satz zählt nicht
    expect(workoutKind({ ...mixed, exercises: [bench([set(60, 8)]), { ...treadmill, sets: [] }] })).toBe("strength");
    const calendar = trainingCalendar([...workouts, cardioOnly, mixed, sameDay], "2026-10-21", 3);
    expect(calendar[0].days[0]).toMatchObject({ count: 2, kind: "both" });
    expect(calendar[0].days[1]).toMatchObject({ count: 1, kind: "cardio" });
    expect(calendar[1].days[1]).toMatchObject({ count: 1, kind: "both" });
  });

  it("fasst den Zeitraum zusammen", () => {
    expect(statsTotals(workouts, 4)).toEqual({ workouts: 3, sets: 6, volumeKg: 2160, minutes: 155, avgMinutes: 52, perWeek: 0.8 });
  });
});
