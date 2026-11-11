import { z } from "zod";
import { MARKERS } from "@/lib/domain/blood";
import { AMOUNT_UNITS, NUTRIENTS, SUPPLEMENT_FORMS } from "@/lib/domain/supplements";

// Supplemente & Blutwerte, Medizin & Vorsorge: Eingaben prüfen.

const text = (max: number, label = "Text") => z.string().trim().max(max, `${label}: höchstens ${max} Zeichen.`);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Höchstens ${max} Zeichen.`)
    .nullable()
    .transform((v) => (v ? v : null));
const required = (max: number, message: string) => z.string().trim().min(1, message).max(max, `Höchstens ${max} Zeichen.`);
const date = z.iso.date("Bitte ein Datum wählen.");
const time = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Ungültige Uhrzeit.")
  .nullable();

// ---------------------------------------------------------------------------
// Supplemente
// ---------------------------------------------------------------------------

export const ingredientSchema = z.object({
  nutrient: z.enum(NUTRIENTS.map((n) => n.key) as [string, ...string[]]).nullable(),
  name: required(60, "Bitte einen Inhaltsstoff angeben."),
  amount: z.number().min(0, "Nicht negativ.").max(1_000_000, "Zu groß."),
  unit: z.enum(AMOUNT_UNITS),
});

export const supplementInputSchema = z.object({
  name: required(80, "Bitte einen Namen eingeben."),
  brand: optionalText(80),
  form: z.enum(SUPPLEMENT_FORMS.map((f) => f.value) as [string, ...string[]]),
  packAmount: z.number().min(0.1, "Mindestens 0,1.").max(100000, "Höchstens 100.000.").nullable(),
  servingAmount: z.number().gt(0, "Mehr als 0.").max(10000, "Höchstens 10.000."),
  priceEur: z.number().min(0, "Nicht negativ.").max(10000, "Höchstens 10.000 €.").nullable(),
  shop: optionalText(80),
  servingsPerDay: z.number().min(0, "Nicht negativ.").max(50, "Höchstens 50."),
  active: z.boolean(),
  ingredients: z.array(ingredientSchema).max(40, "Höchstens 40 Inhaltsstoffe."),
  note: optionalText(500),
});
export type SupplementInput = z.input<typeof supplementInputSchema>;

// ---------------------------------------------------------------------------
// Blutwerte
// ---------------------------------------------------------------------------

export const bloodValueSchema = z
  .object({
    marker: z.enum(MARKERS.map((m) => m.key) as [string, ...string[]]).nullable(),
    name: required(60, "Bitte einen Namen eingeben."),
    value: z.number().min(-100000).max(1_000_000),
    unit: text(20, "Einheit"),
    low: z.number().min(-100000).max(1_000_000).nullable(),
    high: z.number().min(-100000).max(1_000_000).nullable(),
  })
  .refine((v) => v.low == null || v.high == null || v.low <= v.high, { message: "Untere Grenze liegt über der oberen.", path: ["low"] });

export const bloodTestInputSchema = z.object({
  date,
  lab: optionalText(80),
  note: optionalText(500),
  values: z.array(bloodValueSchema).min(1, "Bitte mindestens einen Wert eintragen.").max(80, "Höchstens 80 Werte."),
});
export type BloodTestInput = z.input<typeof bloodTestInputSchema>;

// ---------------------------------------------------------------------------
// Krankheitstage und Medikamente
// ---------------------------------------------------------------------------

export const temperatureSchema = z.object({
  date,
  time,
  celsius: z.number().min(34, "Mindestens 34 °C.").max(43, "Höchstens 43 °C."),
});

export const sickEpisodeInputSchema = z
  .object({
    title: required(60, "Bitte angeben, was du hattest."),
    start: date,
    end: date.nullable(),
    symptoms: z.array(text(40)).max(30),
    sickNote: z.boolean(),
    temperatures: z.array(temperatureSchema).max(100, "Höchstens 100 Messungen."),
    note: optionalText(500),
  })
  .refine((v) => v.end == null || v.end >= v.start, { message: "Das Ende liegt vor dem Beginn.", path: ["end"] });
export type SickEpisodeInput = z.input<typeof sickEpisodeInputSchema>;

export const medicationInputSchema = z.object({
  name: required(80, "Bitte ein Medikament eingeben."),
  dose: optionalText(40),
  date,
  time,
  reason: optionalText(120),
  episodeId: z.uuid().nullable(),
  note: optionalText(300),
});
export type MedicationInput = z.input<typeof medicationInputSchema>;

// ---------------------------------------------------------------------------
// Vorsorge
// ---------------------------------------------------------------------------

export const checkupInputSchema = z.object({
  name: required(60, "Bitte einen Namen eingeben."),
  doctor: optionalText(80),
  intervalMonths: z.number().int("Ganze Monate.").min(1, "Mindestens 1 Monat.").max(240, "Höchstens 240 Monate.").nullable(),
  nextOn: date.nullable(),
  note: optionalText(500),
});
export type CheckupInput = z.input<typeof checkupInputSchema>;

export const checkupVisitInputSchema = z.object({
  date,
  note: optionalText(300),
});
export type CheckupVisitInput = z.input<typeof checkupVisitInputSchema>;
