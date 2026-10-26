import { describe, expect, it } from "vitest";
import { planDaysForSave, resolveSportExercises, sportBackupFileSchema, toSportBackupFile, type PlanRowForBackup } from "./sport-backup";

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
    const file = toSportBackupFile([row], [{ ...own, secondary_muscles: [] }], new Date("2026-10-26T10:00:00Z"));
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
  const file = sportBackupFileSchema.parse(JSON.parse(JSON.stringify(toSportBackupFile([row], [], new Date()))));

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
