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
    dose: optionalText(40),
    notes: optionalText(1000),
    color: z.enum(DRINK_COLOR_KEYS as [DrinkColor, ...DrinkColor[]]),
    paused: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const max = FREQUENCIES.find((f) => f.key === v.frequency)?.max ?? 1;
    if (v.target > max) ctx.addIssue({ code: "custom", path: ["target"], message: `Höchstens ${max}×.` });
    if (new Set(v.weekdays).size !== v.weekdays.length) ctx.addIssue({ code: "custom", path: ["weekdays"], message: "Jeden Tag nur einmal." });
  });
export type HabitInput = z.input<typeof habitInputSchema>;

export const habitCheckSchema = z.object({
  habitId: z.uuid(),
  date: z.iso.date(),
  count: z.number().int().min(0).max(99),
});

export const scheduleInputSchema = z.object({
  /** beim Anlegen mehrere Tage auf einmal, beim Bearbeiten genau einer */
  weekdays: z.array(weekday).min(1, "Mindestens einen Tag wählen.").max(7),
  daytime,
  atTime: time.nullable(),
  title: z.string().trim().min(1, "Bitte einen Titel eingeben.").max(60, "Höchstens 60 Zeichen."),
  category: z.enum(SCHEDULE_CATEGORY_KEYS as [ScheduleCategory, ...ScheduleCategory[]]),
  durationMin: z.number().int().min(5, "Mindestens 5 Minuten.").max(600, "Höchstens 10 Stunden.").nullable(),
  notes: optionalText(500),
});
export type ScheduleInput = z.input<typeof scheduleInputSchema>;
