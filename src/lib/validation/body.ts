import { z } from "zod";
import { MEASURES, type MeasureKey } from "@/lib/domain/body";

// Körpermaße: eine Messung (alle Werte optional, mindestens einer) und die Einstellungen.

const value = (min: number, max: number, label: string) =>
  z.number().min(min, `${label}: mindestens ${min}.`).max(max, `${label}: höchstens ${max}.`).nullable();

export const measurementInputSchema = z
  .object({
    date: z.iso.date("Bitte ein Datum wählen."),
    note: z.string().trim().max(300, "Höchstens 300 Zeichen.").nullable(),
    ...(Object.fromEntries(MEASURES.map((m) => [m.key, value(m.min, m.max, m.label)])) as Record<MeasureKey, ReturnType<typeof value>>),
  })
  .refine((v) => MEASURES.some((m) => v[m.key] != null), { message: "Bitte mindestens einen Wert eintragen.", path: ["_form"] });
export type MeasurementInput = z.infer<typeof measurementInputSchema>;

export const bodySettingsSchema = z.object({
  heightCm: z.number().min(100, "Mindestens 100 cm.").max(250, "Höchstens 250 cm.").nullable(),
  sex: z.enum(["m", "w"]).nullable(),
  hidden: z.array(z.enum(MEASURES.filter((m) => m.key !== "weight").map((m) => m.key) as [MeasureKey, ...MeasureKey[]])).max(9),
});
