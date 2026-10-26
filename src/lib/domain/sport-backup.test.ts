import { describe, expect, it } from "vitest";
import {
  planDaysForSave,
  resolveSportExercises,
  sportBackupFileSchema,
  toSportBackupFile,
  workoutPayloadFromBackup,
  type PlanRowForBackup,
  type WorkoutRowForBackup,
} from "./sport-backup";

const bench = { name: "Bankdrücken (Langhantel)", muscle_group: "chest", secondary_muscles: ["triceps"], equipment: "barbell", tracking: "weight_reps" } as const;
const own = { name: "Meine Kabelpresse", muscle_group: "chest", secondary_muscles: [], equipment: "cable", tracking: "weight_reps" } as const;

const row: PlanRowForBackup = {
  title: "Push",
  description: null,
  is_archived: true,
  training_plan_days: [
    {
      position: 1,
      name: "Tag B",
      focus: null,
      training_plan_exercises: [
        { position: 0, sets: 3, reps_min: 8, reps_max: 12, target_seconds: null, rest_seconds: 90, warmup: false, note: null, exercises: { ...own, secondary_muscles: [] } },
      ],
    },
    {
      position: 0,
      name: "Tag A",
      focus: "Brust",
      training_plan_exercises: [
        { position: 1, sets: 2, reps_min: null, reps_max: null, target_seconds: null, rest_seconds: null, warmup: false, note: "zum Schluss", exercises: { ...own, secondary_muscles: [] } },
        { position: 0, sets: 5, reps_min: 5, reps_max: 5, target_seconds: null, rest_seconds: 180, warmup: true, note: null, exercises: { ...bench, secondary_muscles: ["triceps"] } },
      ],
    },
  ],
};

describe("toSportBackupFile", () => {
  it("sortiert Tage und Übungen und passt zum Schema", () => {
    const file = toSportBackupFile([row], [{ ...own, secondary_muscles: [] }], [], new Date("2026-10-26T10:00:00Z"));
    expect(file.plans[0].days.map((d) => d.name)).toEqual(["Tag A", "Tag B"]);
    expect(file.plans[0].days[0].exercises.map((e) => e.exercise.name)).toEqual(["Bankdrücken (Langhantel)", "Meine Kabelpresse"]);
    expect(file.plans[0].days[0].exercises[0]).not.toHaveProperty("position");
    expect(sportBackupFileSchema.safeParse(JSON.parse(JSON.stringify(file))).success).toBe(true);
  });

  it("lehnt fremde Dateien ab", () => {
    const result = sportBackupFileSchema.safeParse({ format: "rezeptbuch-rezepte", version: 2, exported_at: "", plans: [] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Das ist keine Sport-Sicherung aus dieser App.");
  });
});

describe("resolveSportExercises", () => {
  const file = sportBackupFileSchema.parse(JSON.parse(JSON.stringify(toSportBackupFile([row], [], [], new Date()))));

  it("findet vorhandene Übungen über den Namen und legt fehlende einmal an", () => {
    const { mapping, toCreate } = resolveSportExercises(file, [{ id: "b1", name: "bankdrücken (langhantel)", own: false }]);
    expect(toCreate.map((e) => e.name)).toEqual(["Meine Kabelpresse"]);
    const days = planDaysForSave(file.plans[0], new Map([...mapping, ["meine kabelpresse", "k1"]]));
    expect(days[0].exercises.map((e) => e.exercise_id)).toEqual(["b1", "k1"]);
    expect(days[0]).toMatchObject({ id: null, name: "Tag A", focus: "Brust" });
  });

  it("nimmt bei gleichem Namen die eigene Übung", () => {
    const { mapping } = resolveSportExercises(file, [
      { id: "eigen", name: "Bankdrücken (Langhantel)", own: true },
      { id: "seed", name: "Bankdrücken (Langhantel)", own: false },
    ]);
    expect(mapping.get("bankdrucken langhantel")).toBe("eigen");
  });
});

describe("Trainings (Version 2)", () => {
  const workout: WorkoutRowForBackup = {
    title: "Push · Tag A",
    started_at: "2026-10-26T10:00:00.000Z",
    ended_at: "2026-10-26T11:00:00.000Z",
    note: null,
    training_plans: { title: "Push" },
    training_plan_days: { name: "Tag A" },
    workout_exercises: [
      {
        position: 0,
        note: null,
        exercises: { ...bench, secondary_muscles: ["triceps"] },
        workout_sets: [
          { position: 1, kind: "normal", done: true, weight_kg: 60, reps: 8, seconds: null, distance_m: null },
          { position: 0, kind: "warmup", done: true, weight_kg: 20, reps: 10, seconds: null, distance_m: null },
          { position: 2, kind: "normal", done: false, weight_kg: null, reps: null, seconds: null, distance_m: null },
        ],
      },
    ],
  };
  const running = { ...workout, ended_at: null };

  it("sichert nur beendete Trainings und erledigte Sätze", () => {
    const file = toSportBackupFile([], [], [workout, running], new Date());
    expect(file.workouts).toHaveLength(1);
    expect(file.workouts[0].exercises[0].sets.map((s) => [s.kind, s.weight_kg])).toEqual([
      ["warmup", 20],
      ["normal", 60],
    ]);
    expect(sportBackupFileSchema.safeParse(JSON.parse(JSON.stringify(file))).success).toBe(true);
  });

  it("liest Version 1 ohne Trainings weiter", () => {
    const v1 = sportBackupFileSchema.parse({ format: "rezeptbuch-sport", version: 1, exported_at: "", plans: [] });
    expect(v1.workouts).toEqual([]);
  });

  it("baut den Stand für sync_workout mit Plan und Tag über den Namen", () => {
    const file = sportBackupFileSchema.parse(JSON.parse(JSON.stringify(toSportBackupFile([], [], [workout], new Date()))));
    let n = 0;
    const payload = workoutPayloadFromBackup(
      file.workouts[0],
      new Map([["bankdrucken langhantel", "b1"]]),
      [{ id: "p1", title: "push", days: [{ id: "d1", name: "Tag A" }] }],
      () => `id${++n}`,
    );
    expect(payload).toMatchObject({ plan_id: "p1", plan_day_id: "d1", version: 1 });
    expect(payload.exercises[0]).toMatchObject({ exercise_id: "b1" });
    expect(payload.exercises[0].sets.every((s) => s.done)).toBe(true);
  });
});
