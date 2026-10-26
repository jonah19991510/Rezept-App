import { z } from "zod";
import type { Equipment, MuscleGroup } from "./exercises";
import { SPORT_BACKUP_FORMAT, SPORT_BACKUP_VERSION, type SportBackupExercise, type SportBackupFileInput } from "./sport-backup";

// Export der früheren Gym-App des Nutzers („Sport & Gesundheit – Gym“, 26.10.2026) in eine Sport-Sicherung umwandeln.
// Dort ist jeder Plan ein einzelner Trainingstag („Tag A: Fokus Brust“), ausgeblendete Pläne sind ältere Fassungen.
// Hier werden daraus zwei Pläne mit Tagen: die aktuellen und (ausgeblendet) die alten. Übungen behalten ihre Namen
// (werden als eigene Übungen angelegt, falls es sie unter diesem Namen nicht gibt).

const gymExerciseSchema = z.object({
  name: z.string().trim().min(1).max(80),
  muscle: z.string().max(40).optional().default(""),
  reps: z.string().max(20).optional().default(""),
  sets: z.number().int().min(1).max(20).optional().default(3),
  warmup: z.boolean().optional().default(false),
  note: z.string().max(200).optional().default(""),
});

const gymSetSchema = z.object({ r: z.number().min(0).max(1000).nullable().optional(), w: z.number().min(0).max(1000).nullable().optional() });

export const gymExportSchema = z.object({
  export: z.object({ source: z.string().max(200) }),
  plans: z
    .array(
      z.object({
        id: z.string().max(60),
        name: z.string().trim().min(1).max(100),
        days: z.array(z.number().int()).optional().default([]),
        hidden: z.boolean().optional().default(false),
        exercises: z.array(gymExerciseSchema).max(40).default([]),
      }),
    )
    .max(100)
    .default([]),
  exercises: z.array(gymExerciseSchema).max(500).optional().default([]),
  workouts: z
    .array(
      z.object({
        date: z.string().max(10).optional(),
        datetime: z.string().max(40).optional(),
        ts: z.number().optional(),
        durationMin: z.number().min(0).max(1440).optional().default(0),
        planId: z.string().max(60).nullable().optional(),
        planName: z.string().max(160).nullable().optional(),
        entries: z.array(z.object({ name: z.string().trim().min(1).max(80), muscle: z.string().max(40).optional().default(""), sets: z.array(gymSetSchema).max(50) })).max(60),
      }),
    )
    .max(2000)
    .default([]),
});

export type GymExport = z.infer<typeof gymExportSchema>;

/** Ist das ein Export der früheren Gym-App? (Kennung: export.source und Pläne/Trainings in diesem Aufbau) */
export function isGymExport(json: unknown): boolean {
  return gymExportSchema.safeParse(json).success;
}

const MUSCLES: Record<string, MuscleGroup> = {
  brust: "chest",
  rucken: "back",
  schultern: "shoulders",
  schulter: "shoulders",
  bizeps: "biceps",
  trizeps: "triceps",
  unterarme: "forearms",
  bauch: "core",
  core: "core",
  waden: "calves",
  gesass: "glutes",
  po: "glutes",
  ganzkorper: "full_body",
  cardio: "cardio",
  ausdauer: "cardio",
};

const plain = (s: string) =>
  s
    .toLocaleLowerCase("de")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Muskelgruppe aus der deutschen Angabe; „Beine“ wird über den Übungsnamen genauer (Beinbeuger, Waden, sonst Beinstrecker). */
export function gymMuscle(muscle: string, name: string): MuscleGroup {
  const m = plain(muscle.trim());
  const n = plain(name);
  if (m === "beine" || m === "bein") {
    if (n.includes("beug") || n.includes("curl")) return "hamstrings";
    if (n.includes("wade")) return "calves";
    if (n.includes("adduk")) return "adductors";
    if (n.includes("abduk") || n.includes("hip") || n.includes("gesass")) return "glutes";
    return "quads";
  }
  return MUSCLES[m] ?? "full_body";
}

/** Gerät aus dem Namen erraten (Kabel, Lang-/Kurzhantel, sonst Maschine). */
export function gymEquipment(name: string): Equipment {
  const n = plain(name);
  if (n.includes("kabel") || n.includes("latzug") || n.includes("cable")) return "cable";
  if (n.includes("kurzhantel")) return "dumbbell";
  if (n.includes("langhantel")) return "barbell";
  if (n.includes("sz")) return "ez_bar";
  if (n.includes("klimmzug") || n.includes("liegestutz") || n.includes("dips")) return "bodyweight";
  if (n.includes("ruckenstreck")) return "other";
  return "machine";
}

/** „6-10“ → 6/10, „8“ → 8/8, sonst leer. */
export function gymReps(reps: string): { min: number | null; max: number | null } {
  const m = /^\s*(\d{1,3})\s*(?:[-–]\s*(\d{1,3}))?\s*$/.exec(reps);
  if (!m) return { min: null, max: null };
  const min = Math.min(100, Number(m[1]));
  const max = Math.min(100, Number(m[2] ?? m[1]));
  return max >= min ? { min, max } : { min: max, max: min };
}

/** „Tag A: Fokus Brust“ / „Tag A - GK - Fokus Brust“ → Tag „Tag A“, Fokus „Brust“; sonst der ganze Name. */
export function gymDayName(name: string): { name: string; focus: string | null } {
  const m = /^(Tag\s+\S+)\s*[-:–]\s*(?:GK\s*[-:–]\s*)?(?:Fokus\s+)?(.+)$/i.exec(name.trim());
  if (!m) return { name: name.trim().slice(0, 60), focus: null };
  return { name: m[1].slice(0, 60), focus: m[2].trim().slice(0, 60) || null };
}

export const GYM_PLAN_TITLE = "Mein Trainingsplan";
export const GYM_OLD_PLAN_TITLE = "Mein Trainingsplan (alt)";

/** Startzeit eines Trainings: datetime, sonst ts, sonst das Datum um 12 Uhr. */
function startOf(w: GymExport["workouts"][number]): Date | null {
  const candidates = [w.datetime, w.ts != null ? new Date(w.ts).toISOString() : undefined, w.date ? `${w.date}T12:00:00+02:00` : undefined];
  for (const c of candidates) {
    if (!c) continue;
    const d = new Date(c);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

/** Export der früheren Gym-App → Sport-Sicherung (danach normaler Import). */
export function convertGymExport(raw: GymExport, now: Date): SportBackupFileInput {
  const exercises = new Map<string, SportBackupExercise>();
  const addExercise = (name: string, muscle: string) => {
    const key = plain(name.trim());
    if (!exercises.has(key)) {
      exercises.set(key, {
        name: name.trim(),
        muscle_group: gymMuscle(muscle, name),
        secondary_muscles: [],
        equipment: gymEquipment(name),
        tracking: "weight_reps",
      });
    }
    return exercises.get(key)!;
  };
  for (const e of raw.exercises) addExercise(e.name, e.muscle);

  // Aktuelle und ausgeblendete Tagespläne je zu einem Plan, Tage nach Wochentag sortiert
  const planFor = new Map<string, { title: string; day: string }>();
  const groups = [
    { title: GYM_PLAN_TITLE, archived: false, plans: raw.plans.filter((p) => !p.hidden) },
    { title: GYM_OLD_PLAN_TITLE, archived: true, plans: raw.plans.filter((p) => p.hidden) },
  ].filter((g) => g.plans.length > 0);

  const plans = groups.map((g) => {
    const sorted = [...g.plans].sort((a, b) => (a.days[0] ?? 99) - (b.days[0] ?? 99) || a.name.localeCompare(b.name, "de"));
    const usedNames = new Set<string>();
    return {
      title: g.title,
      description: "Importiert aus der früheren Gym-App.",
      is_archived: g.archived,
      days: sorted.slice(0, 14).map((p) => {
        const parsed = gymDayName(p.name);
        let dayName = parsed.name;
        for (let i = 2; usedNames.has(dayName.toLocaleLowerCase("de")); i++) dayName = `${parsed.name} (${i})`.slice(0, 60);
        usedNames.add(dayName.toLocaleLowerCase("de"));
        planFor.set(p.id, { title: g.title, day: dayName });
        return {
          name: dayName,
          focus: parsed.focus,
          exercises: p.exercises.map((e) => {
            const reps = gymReps(e.reps);
            return {
              exercise: addExercise(e.name, e.muscle),
              sets: e.sets,
              reps_min: reps.min,
              reps_max: reps.max,
              target_seconds: null,
              rest_seconds: null,
              warmup: e.warmup,
              note: e.note || null,
            };
          }),
        };
      }),
    };
  });

  const workouts = raw.workouts.flatMap((w) => {
    const start = startOf(w);
    if (!start) return [];
    const end = new Date(start.getTime() + Math.max(1, Math.round(w.durationMin)) * 60_000);
    const link = w.planId ? planFor.get(w.planId) : undefined;
    return [
      {
        title: (w.planName?.trim() || "Training").slice(0, 160),
        plan_title: link?.title ?? null,
        day_name: link?.day ?? null,
        started_at: start.toISOString(),
        ended_at: end.toISOString(),
        note: null,
        exercises: w.entries.map((e) => ({
          exercise: addExercise(e.name, e.muscle),
          note: null,
          sets: e.sets
            .filter((s) => s.r != null || s.w != null)
            .map((s) => ({
              kind: "normal" as const,
              weight_kg: s.w ?? null,
              reps: s.r != null ? Math.round(s.r) : null,
              seconds: null,
              distance_m: null,
            })),
        })),
      },
    ];
  });

  return {
    format: SPORT_BACKUP_FORMAT,
    version: SPORT_BACKUP_VERSION,
    exported_at: now.toISOString(),
    own_exercises: [...exercises.values()],
    plans,
    workouts,
  };
}
