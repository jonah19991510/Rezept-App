import { z } from "zod";
import { DRINK_COLOR_KEYS, type DrinkColor } from "@/lib/domain/drinks";
import { DAYTIME_KEYS, FREQUENCIES, SCHEDULE_CATEGORY_KEYS, type Daytime, type ScheduleCategory } from "@/lib/domain/habits";

// Habit Tracker und Trainings-Wochenplan: Eingaben.

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Uhrzeit wie 07:30.");
const daytime = z.enum(DAYTIME_KEYS as [Daytime, ...Daytime[]]);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Höchstens ${max} Zeichen.`)
    .nullable()
    .transform((v) => (v ? v : null));
const weekday = z.number().int().min(1).max(7);

export const habitInputSchema = z
  .object({
    name: z.string().trim().min(1, "Bitte einen Namen eingeben.").max(60, "Höchstens 60 Zeichen."),
    kind: z.enum(["habit", "supplement"]),
    frequency: z.enum(["daily", "weekly", "monthly"]),
    target: z.number().int().min(1, "Mindestens 1×."),
    /** nur täglich; leer = jeden Tag */
    weekdays: z.array(weekday).max(7),
    daytime: daytime.nullable(),
    atTime: time.nullable(),
    /** Routinen, in denen das Habit steht (nur täglich); fehlt = keine */
    routineIds: z.array(z.uuid()).max(30).default([]),
    dose: optionalText(40),
    notes: optionalText(1000),
    color: z.enum(DRINK_COLOR_KEYS as [DrinkColor, ...DrinkColor[]]),
    paused: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const max = FREQUENCIES.find((f) => f.key === v.frequency)?.max ?? 1;
    if (v.target > max) ctx.addIssue({ code: "custom", path: ["target"], message: `Höchstens ${max}×.` });
    if (v.routineIds.length && v.frequency !== "daily") ctx.addIssue({ code: "custom", path: ["routineIds"], message: "Routinen gibt es nur bei täglichen Habits." });
    if (new Set(v.routineIds).size !== v.routineIds.length) ctx.addIssue({ code: "custom", path: ["routineIds"], message: "Jede Routine nur einmal." });
    if (new Set(v.weekdays).size !== v.weekdays.length) ctx.addIssue({ code: "custom", path: ["weekdays"], message: "Jeden Tag nur einmal." });
  });
export type HabitInput = z.input<typeof habitInputSchema>;

export const habitCheckSchema = z.object({
  habitId: z.uuid(),
  date: z.iso.date(),
  count: z.number().int().min(0).max(99),
});

/** Routine anlegen oder ändern; `habitIds` = Punkte in Reihenfolge. */
export const routineInputSchema = z.object({
  name: z.string().trim().min(1, "Bitte einen Namen eingeben.").max(40, "Höchstens 40 Zeichen."),
  daytime,
  color: z.enum(DRINK_COLOR_KEYS as [DrinkColor, ...DrinkColor[]]),
  habitIds: z
    .array(z.uuid())
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length, "Jeden Punkt nur einmal."),
});
export type RoutineInput = z.input<typeof routineInputSchema>;

/** Neuer Stand eines Punkts an einem Tag (Zahl und Routinen, in denen er abgehakt ist). */
export const routineDaySchema = z.object({
  habitId: z.uuid(),
  date: z.iso.date(),
  count: z.number().int().min(0).max(99),
  routineIds: z.array(z.uuid()).max(30),
});

export const scheduleInputSchema = z.object({
  /** beim Anlegen mehrere Tage auf einmal, beim Bearbeiten genau einer */
  weekdays: z.array(weekday).min(1, "Mindestens einen Tag wählen.").max(7),
  /** optional wie die Uhrzeit */
  daytime: daytime.nullable(),
  atTime: time.nullable(),
  title: z.string().trim().min(1, "Bitte einen Titel eingeben.").max(60, "Höchstens 60 Zeichen."),
  category: z.enum(SCHEDULE_CATEGORY_KEYS as [ScheduleCategory, ...ScheduleCategory[]]),
  durationMin: z.number().int().min(5, "Mindestens 5 Minuten.").max(600, "Höchstens 10 Stunden.").nullable(),
  notes: optionalText(500),
});
export type ScheduleInput = z.input<typeof scheduleInputSchema>;
