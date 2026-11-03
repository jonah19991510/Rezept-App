import { z } from "zod";
import { CHALLENGE_ICONS, type ChallengeIcon, type ChallengeRules } from "@/lib/domain/challenges";
import { DRINK_COLOR_KEYS, type DrinkColor } from "@/lib/domain/drinks";

// Challenges: Eingaben beim Anlegen/Bearbeiten und beim Eintragen.

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Höchstens ${max} Zeichen.`)
    .nullable()
    .transform((v) => (v ? v : null));

const amount = (max: number) => z.number().positive("Muss größer als 0 sein.").max(max, "Das ist zu viel.").nullable();

export const challengeInputSchema = z
  .object({
    title: z.string().trim().min(1, "Bitte einen Namen eingeben.").max(60, "Höchstens 60 Zeichen."),
    description: optionalText(2000),
    icon: z.enum(CHALLENGE_ICONS as unknown as [ChallengeIcon, ...ChallengeIcon[]]),
    color: z.enum(DRINK_COLOR_KEYS as [DrinkColor, ...DrinkColor[]]),
    metric: z.enum(["check", "daily", "total", "most"]),
    source: z.enum(["manual", "workouts"]),
    unit: optionalText(24),
    dailyTarget: amount(100000),
    totalTarget: amount(10000000),
    frequency: z.enum(["daily", "weekly"]),
    daysPerWeek: z.number().int().min(1).max(7).nullable(),
    durationDays: z.number().int().min(1, "Mindestens 1 Tag.").max(366, "Höchstens ein Jahr."),
    startMode: z.enum(["fixed", "join"]),
    startsOn: z.iso.date("Bitte ein Datum wählen.").nullable(),
    lateJoinDays: z.number().int().min(0).max(366),
    missedRule: z.enum(["strict", "streak", "relaxed"]),
    jokers: z.number().int().min(0).max(30, "Höchstens 30 Joker."),
    minPeriods: z.number().int().min(1).nullable(),
    backfillDays: z.number().int().min(0).max(7),
    /** beim Anlegen: selbst mitmachen */
    join: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (v.metric === "daily" && v.source === "workouts") issue("metric", "Trainings zählen als „abhaken“ oder als Gesamtzahl.");
    if (v.metric === "daily" && v.dailyTarget == null) issue("dailyTarget", "Bitte ein Tagesziel eingeben.");
    if (v.metric === "total" && v.totalTarget == null) issue("totalTarget", "Bitte ein Gesamtziel eingeben.");
    if (v.metric !== "check" && v.source === "manual" && !v.unit) issue("unit", "Bitte eine Einheit eingeben, z. B. Liegestütze.");
    if (v.frequency === "weekly" && (v.metric === "check" || v.metric === "daily")) {
      if (v.daysPerWeek == null) issue("daysPerWeek", "Wie viele Tage pro Woche?");
      if (v.durationDays % 7 !== 0) issue("durationDays", "Bei „pro Woche“ in ganzen Wochen.");
    }
    if (v.startMode === "fixed" && !v.startsOn) issue("startsOn", "Bitte einen Starttermin wählen.");
    if (v.minPeriods != null && (v.metric === "check" || v.metric === "daily") && v.missedRule !== "strict") {
      const periods = v.frequency === "weekly" ? Math.floor(v.durationDays / 7) : v.durationDays;
      if (v.minPeriods > periods) issue("minPeriods", `Höchstens ${periods}.`);
    }
  })
  .transform((v) => {
    // Nur die Felder behalten, die zur gewählten Art passen (wie es die Datenbank verlangt)
    const total = v.metric === "total";
    // Gesamtmenge und Wettkampf: ohne Rhythmus, verpasste Tage und „mindestens X von Y“
    const open = total || v.metric === "most";
    const weekly = !open && v.frequency === "weekly";
    const missedRule = open ? "relaxed" : v.missedRule;
    const periods = weekly ? Math.floor(v.durationDays / 7) : v.durationDays;
    const rules: ChallengeRules = {
      metric: v.metric,
      source: v.source,
      unit: v.metric !== "check" && v.source === "manual" ? v.unit : null,
      dailyTarget: v.metric === "daily" ? v.dailyTarget : null,
      totalTarget: total ? v.totalTarget : null,
      frequency: weekly ? "weekly" : "daily",
      daysPerWeek: weekly ? v.daysPerWeek : null,
      durationDays: v.durationDays,
      startMode: v.startMode,
      startsOn: v.startMode === "fixed" ? v.startsOn : null,
      lateJoinDays: v.startMode === "fixed" ? Math.min(v.lateJoinDays, v.durationDays - 1) : 0,
      missedRule,
      jokers: missedRule === "relaxed" ? 0 : Math.min(v.jokers, periods),
      // „Mindestens alle“ ist dasselbe wie „alle“
      minPeriods: open || missedRule === "strict" || v.minPeriods == null || v.minPeriods >= periods ? null : v.minPeriods,
      backfillDays: v.backfillDays,
    };
    return { title: v.title, description: v.description, icon: v.icon, color: v.color, join: v.join, rules };
  });
export type ChallengeInput = z.input<typeof challengeInputSchema>;

export const challengeEntrySchema = z.object({
  challengeId: z.uuid(),
  date: z.iso.date(),
  /** 0 = Eintrag löschen */
  value: z.number().min(0).max(10000000),
});
