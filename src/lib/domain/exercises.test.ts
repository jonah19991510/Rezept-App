import { describe, expect, it } from "vitest";
import { groupByMuscle, normalizeSearch, searchExercises, type ExerciseOption } from "./exercises";

const ex = (name: string, muscleGroup: ExerciseOption["muscleGroup"], extra: Partial<ExerciseOption> = {}): ExerciseOption => ({
  id: name,
  name,
  muscleGroup,
  secondaryMuscles: [],
  equipment: "barbell",
  tracking: "weight_reps",
  own: false,
  ...extra,
});

const list = [
  ex("Schrägbankdrücken (Kurzhantel)", "chest", { equipment: "dumbbell", secondaryMuscles: ["shoulders", "triceps"] }),
  ex("Bankdrücken (Langhantel)", "chest", { secondaryMuscles: ["triceps"] }),
  ex("Enges Bankdrücken", "triceps", { secondaryMuscles: ["chest"] }),
  ex("Klimmzug", "back", { equipment: "bodyweight", tracking: "bodyweight_reps" }),
  ex("Kniebeuge (Langhantel)", "quads"),
];

describe("normalizeSearch", () => {
  it("ignoriert Umlaute, ß, Groß-/Kleinschreibung und Satzzeichen", () => {
    expect(normalizeSearch("Schrägbank-Drücken (KH)")).toBe("schragbank drucken kh");
    expect(normalizeSearch("Fußpresse")).toBe("fusspresse");
  });
});

describe("searchExercises", () => {
  it("findet alle Wörter in Name, Muskel oder Gerät", () => {
    expect(searchExercises(list, "drucken kurzhantel").map((e) => e.name)).toEqual(["Schrägbankdrücken (Kurzhantel)"]);
    expect(searchExercises(list, "brust").map((e) => e.name)).toEqual(["Bankdrücken (Langhantel)", "Schrägbankdrücken (Kurzhantel)"]);
  });

  it("stellt Treffer am Namensanfang nach vorne", () => {
    expect(searchExercises(list, "bank").map((e) => e.name)[0]).toBe("Bankdrücken (Langhantel)");
  });

  it("filtert nach Muskelgruppe inkl. Nebenmuskeln, Hauptmuskel zuerst", () => {
    expect(searchExercises(list, "", "triceps").map((e) => e.name)).toEqual([
      "Enges Bankdrücken",
      "Bankdrücken (Langhantel)",
      "Schrägbankdrücken (Kurzhantel)",
    ]);
  });
});

describe("groupByMuscle", () => {
  it("gruppiert in fester Reihenfolge und sortiert alphabetisch", () => {
    const groups = groupByMuscle(list);
    expect(groups.map((g) => g.muscle)).toEqual(["chest", "back", "triceps", "quads"]);
    expect(groups[0].items.map((e) => e.name)).toEqual(["Bankdrücken (Langhantel)", "Schrägbankdrücken (Kurzhantel)"]);
  });
});
