import { describe, expect, it } from "vitest";
import { canEditExercise, filterLibrary, groupByMuscle, groupLibrary, normalizeSearch, searchExercises, type ExerciseOption } from "./exercises";

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

describe("groupLibrary", () => {
  it("ohne Filter wie nach Hauptmuskel", () => {
    expect(groupLibrary(list, null).map((g) => g.label)).toEqual(["Brust", "Rücken", "Trizeps", "Beinstrecker"]);
  });

  it("mit Filter: gewählter Hauptmuskel zuerst, danach Nebenmuskel-Treffer", () => {
    const groups = groupLibrary(searchExercises(list, "", "triceps"), "triceps");
    expect(groups.map((g) => g.label)).toEqual(["Trizeps", "Als Nebenmuskel"]);
    expect(groups[0].items.map((e) => e.name)).toEqual(["Enges Bankdrücken"]);
    expect(groups[1].items.map((e) => e.name)).toEqual(["Bankdrücken (Langhantel)", "Schrägbankdrücken (Kurzhantel)"]);
  });

  it("lässt leere Gruppen weg", () => {
    expect(groupLibrary(searchExercises(list, "", "back"), "back").map((g) => g.label)).toEqual(["Rücken"]);
  });
});

describe("Übungsdatenbank", () => {
  const lib = [
    { ...ex("Bankdrücken (Langhantel)", "chest"), origin: "seed" as const, planCount: 2, workoutCount: 5 },
    { ...ex("Meine Kabelpresse", "chest", { own: true }), origin: "own" as const, planCount: 0, workoutCount: 0 },
    { ...ex("Klimmzug", "back"), origin: "seed" as const, planCount: 0, workoutCount: 1 },
    { ...ex("Mias Spezialrudern", "back"), origin: "other" as const, planCount: 0, workoutCount: 0 },
  ];

  it("filtert nach Ansicht, Muskelgruppe und Suche", () => {
    expect(filterLibrary(lib, { query: "", view: "eigene", muscle: null }).map((e) => e.name)).toEqual(["Meine Kabelpresse"]);
    expect(filterLibrary(lib, { query: "", view: "trainiert", muscle: "back" }).map((e) => e.name)).toEqual(["Klimmzug"]);
    expect(filterLibrary(lib, { query: "", view: "plaene", muscle: null })).toHaveLength(1);
    expect(filterLibrary(lib, { query: "rudern", view: "alle", muscle: null }).map((e) => e.name)).toEqual(["Mias Spezialrudern"]);
  });

  it("erlaubt Ändern bei eigenen, beim Grundbestand nur Admins, nie bei fremden", () => {
    expect(canEditExercise({ origin: "own" }, false)).toBe(true);
    expect(canEditExercise({ origin: "seed" }, false)).toBe(false);
    expect(canEditExercise({ origin: "seed" }, true)).toBe(true);
    expect(canEditExercise({ origin: "other" }, true)).toBe(false);
  });
});
