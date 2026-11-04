import { describe, expect, it } from "vitest";
import { buildPostSummary, kudosLabel, parsePostSummary, planDayFromPost, recordLabel, summaryStats, whenLabel } from "./posts";
import type { StatsWorkout } from "./workout-stats";

const bench = (id: string, date: string, sets: [number, number][], warmup = false): StatsWorkout => ({
  id,
  title: "Push",
  date,
  durationSeconds: 3900,
  exercises: [
    {
      exerciseId: "bank",
      name: "Bankdrücken",
      muscleGroup: "chest",
      secondaryMuscles: [],
      tracking: "weight_reps",
      category: "training",
      sets: [
        ...(warmup ? [{ kind: "warmup" as const, weightKg: 40, reps: 10, seconds: null, distanceM: null }] : []),
        ...sets.map(([weightKg, reps]) => ({ kind: "normal" as const, weightKg, reps, seconds: null, distanceM: null })),
      ],
    },
    {
      exerciseId: "lauf",
      name: "Laufband",
      muscleGroup: "cardio",
      secondaryMuscles: [],
      tracking: "distance_time",
      category: "training",
      sets: [{ kind: "normal", weightKg: null, reps: null, seconds: 1200, distanceM: 3000 }],
    },
  ],
});

describe("buildPostSummary", () => {
  const earlier = bench("w1", "2026-10-30", [[70, 8], [70, 8]]);
  const now = bench("w2", "2026-11-02", [[80, 5], [75, 6], [75, 8]], true);
  const s = buildPostSummary(now, [earlier, now]);

  it("fasst Übungen, Sätze, Volumen und Strecke zusammen", () => {
    expect(s.kind).toBe("both");
    expect(s.sets).toBe(4);
    expect(s.volumeKg).toBe(400 + 450 + 600);
    expect(s.distanceM).toBe(3000);
    expect(s.exercises[0]).toMatchObject({ name: "Bankdrücken", sets: 3, warmup: true, repsMin: 5, repsMax: 8, best: "75 kg × 8" });
    expect(s.exercises[1].best).toBe("3 km · 20:00");
  });

  it("findet neue Bestwerte gegenüber früheren Trainings", () => {
    expect(s.records).toHaveLength(1);
    expect(recordLabel(s.records[0])).toBe("Bankdrücken: geschätztes 1RM 95 kg (vorher 88,7 kg)");
    // Erstes Training einer Übung ist kein Bestwert
    expect(buildPostSummary(earlier, [earlier]).records).toEqual([]);
  });

  it("Kennzahlen und Nachmachen", () => {
    expect(summaryStats(s).map((x) => x.label)).toEqual(["Dauer", "Volumen", "Strecke", "Sätze"]);
    expect(planDayFromPost(s)[0]).toEqual({ exercise_id: "bank", sets: 3, reps_min: 5, reps_max: 8, target_seconds: null, rest_seconds: null, warmup: true, note: "" });
  });

  it("liest Unbekanntes tolerant", () => {
    expect(parsePostSummary(null)).toMatchObject({ title: "Training", exercises: [], records: [] });
  });
});

describe("Texte", () => {
  it("Zeitpunkt", () => {
    expect(whenLabel("2026-11-03T17:30:00Z", "2026-11-03", "2026-11-03")).toBe("Heute, 18:30");
    expect(whenLabel("2026-11-02T06:15:00Z", "2026-11-02", "2026-11-03")).toBe("Gestern, 07:15");
    expect(whenLabel("2026-10-30T17:30:00Z", "2026-10-30", "2026-11-03")).toBe("Fr., 30.10., 18:30");
  });

  it("Kudos", () => {
    expect(kudosLabel(["Anna"])).toBe("Anna");
    expect(kudosLabel(["Anna", "Ben"])).toBe("Anna und Ben");
    expect(kudosLabel(["Anna", "Ben", "Clara"])).toBe("Anna, Ben und 1 weitere Person");
    expect(kudosLabel(["Anna", "Ben", "Clara", "Dora"])).toBe("Anna, Ben und 2 weitere");
  });
});
