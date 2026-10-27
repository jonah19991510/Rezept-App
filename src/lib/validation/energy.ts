import { z } from "zod";
import { FORMULA_OPTIONS, GOAL_OPTIONS, LIMITS, SPORT_OPTIONS } from "@/lib/domain/energy";

// Energiebedarfsrechner: gespeicherte Eingaben (gleiche Grenzen wie im Rechner).

const range = (key: keyof typeof LIMITS) => z.number().min(LIMITS[key][0]).max(LIMITS[key][1]);

export const energyProfileSchema = z.object({
  sex: z.enum(["m", "w"]),
  age: range("age"),
  heightCm: range("heightCm"),
  weightKg: range("weightKg"),
  bodyFat: range("bodyFat").nullable(),
  pal: range("pal"),
  sport: z.number().refine((v) => SPORT_OPTIONS.some((s) => s.value === v)),
  goal: z.enum(GOAL_OPTIONS.map((g) => g.value) as [string, ...string[]]),
  customKcal: range("customKcal").nullable(),
  targetWeightKg: range("targetWeightKg").nullable(),
  proteinPerKg: range("proteinPerKg"),
  fatPercent: range("fatPercent"),
  formula: z.enum(FORMULA_OPTIONS.map((f) => f.value) as [string, ...string[]]),
});
