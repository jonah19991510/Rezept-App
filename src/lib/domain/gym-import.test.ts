import { describe, expect, it } from "vitest";
import { convertGymExport, gymDayName, gymEquipment, gymExportSchema, gymMuscle, gymReps, isGymExport, GYM_OLD_PLAN_TITLE, GYM_PLAN_TITLE } from "./gym-import";
import { sportBackupFileSchema } from "./sport-backup";

// Aufbau wie der Export der früheren Gym-App (gekürzt, Beispielwerte)
const sample = {
  export: { source: "Sport & Gesundheit – Gym", exportedAt: "2026-10-26T13:00:43+01:00", workouts: 2 },
  plans: [
    { id: "alt-a", name: "Tag A - GK - Fokus Brust", days: [0], hidden: true, exercises: [{ id: "1", muscle: "Brust", name: "Butterfly", reps: "6-10", sets: 2, warmup: true }] },
    {
      id: "neu-b",
      name: "Tag B: Fokus Rücken",
      days: [2],
      exercises: [
        { id: "2", muscle: "Rücken", name: "Latzug", reps: "6-10", sets: 2, warmup: false },
        { id: "3", muscle: "Beine", name: "Beinbeugen", reps: "10-15", sets: 3, warmup: true },
      ],
    },
    { id: "neu-a", name: "Tag A: Fokus Brust", days: [0], exercises: [{ id: "4", muscle: "Brust", name: "Butterfly", reps: "10-15", sets: 2, warmup: true }] },
  ],
  exercises: [{ id: "x", muscle: "Waden", name: "Wadenheben", note: "", reps: "6-10", sets: 2 }],
  workouts: [
    {
      id: "w1",
      date: "2026-10-19",
      durationMin: 70,
      planId: "neu-a",
      planName: "Tag A: Fokus Brust",
      ts: 1792408003175,
      datetime: "2026-10-19T13:06+02:00",
      entries: [{ muscle: "Brust", name: "Butterfly", sets: [{ r: 9, w: 59 }, { r: 8, w: 66 }] }],
    },
    { id: "w2", date: "2026-10-12", durationMin: 68, planId: "alt-a", planName: "Tag A - GK - Fokus Brust", entries: [{ muscle: "Beine", name: "Beinpresse", sets: [{ r: 10, w: 131 }] }] },
  ],
  runningWorkout: null,
};

describe("Erkennung und Einzelteile", () => {
  it("erkennt den Export, aber keine Sport-Sicherung", () => {
    expect(isGymExport(sample)).toBe(true);
    expect(isGymExport({ format: "rezeptbuch-sport", version: 2, plans: [] })).toBe(false);
  });

  it("ordnet Muskelgruppen und Geräte zu", () => {
    expect(gymMuscle("Rücken", "Latzug")).toBe("back");
    expect(gymMuscle("Beine", "Beinbeugen")).toBe("hamstrings");
    expect(gymMuscle("Beine", "Beinpresse")).toBe("quads");
    expect(gymMuscle("Waden", "Wadenheben")).toBe("calves");
    expect(gymMuscle("Unbekannt", "X")).toBe("full_body");
    expect(gymEquipment("Seitheben Kabelzug")).toBe("cable");
    expect(gymEquipment("Latzug")).toBe("cable");
    expect(gymEquipment("Bankdrücken Maschine")).toBe("machine");
    expect(gymEquipment("Rückenstrecken")).toBe("other");
  });

  it("liest Wiederholungen und Tagesnamen", () => {
    expect(gymReps("6-10")).toEqual({ min: 6, max: 10 });
    expect(gymReps("8")).toEqual({ min: 8, max: 8 });
    expect(gymReps("viele")).toEqual({ min: null, max: null });
    expect(gymDayName("Tag A: Fokus Brust")).toEqual({ name: "Tag A", focus: "Brust" });
    expect(gymDayName("Tag C - GK - Fokus Beine")).toEqual({ name: "Tag C", focus: "Beine" });
    expect(gymDayName("Oberkörper")).toEqual({ name: "Oberkörper", focus: null });
  });
});

describe("convertGymExport", () => {
  const file = convertGymExport(gymExportSchema.parse(sample), new Date("2026-10-26T12:00:00Z"));

  it("ergibt eine gültige Sport-Sicherung", () => {
    expect(sportBackupFileSchema.safeParse(file).success).toBe(true);
  });

  it("fasst aktuelle und alte Tagespläne zu je einem Plan zusammen", () => {
    expect(file.plans.map((p) => [p.title, p.is_archived, p.days.map((d) => d.name)])).toEqual([
      [GYM_PLAN_TITLE, false, ["Tag A", "Tag B"]],
      [GYM_OLD_PLAN_TITLE, true, ["Tag A"]],
    ]);
    expect(file.plans[0].days[1].exercises[1]).toMatchObject({ sets: 3, reps_min: 10, reps_max: 15, warmup: true });
  });

  it("übernimmt Trainings mit Zeit, Dauer und Plan-Tag", () => {
    const w = file.workouts![0];
    expect(w).toMatchObject({ plan_title: GYM_PLAN_TITLE, day_name: "Tag A", started_at: "2026-10-19T11:06:00.000Z", ended_at: "2026-10-19T12:16:00.000Z" });
    expect(w.exercises[0].sets).toEqual([
      { kind: "normal", weight_kg: 59, reps: 9, seconds: null, distance_m: null },
      { kind: "normal", weight_kg: 66, reps: 8, seconds: null, distance_m: null },
    ]);
    // ohne Uhrzeit: 12 Uhr deutscher Zeit
    expect(file.workouts![1]).toMatchObject({ plan_title: GYM_OLD_PLAN_TITLE, started_at: "2026-10-12T10:00:00.000Z" });
  });

  it("sammelt jede Übung einmal (auch nur aus Trainings)", () => {
    expect(file.own_exercises!.map((e) => e.name).sort()).toEqual(["Beinbeugen", "Beinpresse", "Butterfly", "Latzug", "Wadenheben"]);
  });
});
