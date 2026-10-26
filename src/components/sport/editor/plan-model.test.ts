import { describe, expect, it } from "vitest";
import type { ExerciseOption } from "@/lib/domain/exercises";
import { trainingPlanInputSchema } from "@/lib/validation/training-plan";
import { dayErrors, draftToInput, emptyPlan, exerciseErrors, keyGenerator, newDraftExercise, replaceDraftExercise } from "./plan-model";

const ID = "0b6c2f2e-1d6f-4a51-9a51-2b7b3c3f2a10";
const bench: ExerciseOption = {
  id: ID,
  name: "Bankdrücken",
  muscleGroup: "chest",
  secondaryMuscles: [],
  equipment: "barbell",
  tracking: "weight_reps",
  own: false,
};
const plank: ExerciseOption = { ...bench, id: "1b6c2f2e-1d6f-4a51-9a51-2b7b3c3f2a10", name: "Plank", tracking: "time", equipment: "bodyweight" };

describe("newDraftExercise", () => {
  it("setzt übliche Vorgaben je nach Erfassung", () => {
    expect(newDraftExercise("k1", bench)).toMatchObject({ sets: 3, repsMin: "8", repsMax: "12", restSeconds: 90 });
    expect(newDraftExercise("k1", plank)).toMatchObject({ sets: 3, targetSeconds: "45", restSeconds: 60 });
  });
});

describe("replaceDraftExercise", () => {
  it("behält Sätze und Notiz bei gleicher Erfassung", () => {
    const draft = { ...newDraftExercise("k1", bench), sets: 5, note: "eng greifen", warmup: true };
    const replaced = replaceDraftExercise(draft, { ...bench, id: "x", name: "Schrägbank" });
    expect(replaced).toMatchObject({ key: "k1", sets: 5, note: "eng greifen", warmup: true });
    expect(replaced.exercise.name).toBe("Schrägbank");
  });

  it("nimmt bei Wechsel zu Zeit die Vorgaben der neuen Übung", () => {
    const replaced = replaceDraftExercise({ ...newDraftExercise("k1", bench), note: "n" }, plank);
    expect(replaced).toMatchObject({ targetSeconds: "45", repsMin: "", note: "n" });
  });
});

describe("draftToInput", () => {
  it("wandelt Textfelder in Zahlen und passt zur Prüfung", () => {
    const next = keyGenerator();
    const plan = emptyPlan(next);
    plan.title = "Push / Pull";
    plan.days[0].exercises = [newDraftExercise(next(), bench), newDraftExercise(next(), plank)];
    const input = draftToInput(plan);
    expect(input.days[0].exercises[0]).toMatchObject({ reps_min: 8, reps_max: 12, target_seconds: null, rest_seconds: 90 });
    expect(input.days[0].exercises[1]).toMatchObject({ reps_min: null, target_seconds: 45, warmup: false });
    expect(trainingPlanInputSchema.safeParse(input).success).toBe(true);
  });

  it("meldet Unsinn und vertauschte Bereiche", () => {
    const next = keyGenerator();
    const plan = emptyPlan(next);
    plan.title = "Plan";
    plan.days[0].exercises = [{ ...newDraftExercise(next(), bench), repsMin: "12", repsMax: "8" }, { ...newDraftExercise(next(), bench), repsMin: "zehn" }];
    const parsed = trainingPlanInputSchema.safeParse(draftToInput(plan));
    expect(parsed.success).toBe(false);
    const paths = parsed.error!.issues.map((i) => i.path.join("."));
    expect(paths).toContain("days.0.exercises.0.reps_max");
    expect(paths).toContain("days.0.exercises.1.reps_min");
  });
});

describe("Fehler zuordnen", () => {
  const errors = { "days.1.name": ["Name fehlt"], "days.1.exercises.0.reps_max": ["zu klein"], title: ["fehlt"] };
  it("trennt Tag und Übungen", () => {
    expect(dayErrors(errors, 1)).toEqual({ name: ["Name fehlt"] });
    expect(exerciseErrors(errors, 1, 0)).toEqual({ reps_max: ["zu klein"] });
    expect(exerciseErrors(errors, 0, 0)).toEqual({});
  });
});
