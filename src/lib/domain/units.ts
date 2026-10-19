import type { Enums } from "@/lib/supabase/database.types";

export type Unit = Enums<"unit">;

/** Volumen der Löffel- und Bar-Einheiten in ml. Zentral, damit Editor, Server und Tests dieselben Werte nutzen. */
export const UNIT_ML: Partial<Record<Unit, number>> = {
  ml: 1,
  cl: 10,
  tbsp: 15, // EL
  tsp: 5, // TL
  dash: 0.6, // ca. 1/8 TL
  barspoon: 5,
};

/** Eine Prise in Gramm (unabhängig von der Zutat). */
export const PINCH_GRAMS = 0.5;

export type ConversionInfo = {
  density_g_per_ml?: number | null;
  piece_weight_g?: number | null;
};

/**
 * Rechnet eine Mengenangabe in Gramm um.
 * - g: direkt
 * - ml/cl/EL/TL/Dash/Barlöffel: über density_g_per_ml der Zutat, sonst ≈ 1 g/ml
 * - Stück: über piece_weight_g; ohne Stückgewicht nicht berechenbar (null)
 * - Prise: 0,5 g
 * Ohne Menge („Salz nach Geschmack“) ist das Ergebnis null.
 */
export function toGrams(amount: number | null | undefined, unit: Unit | null | undefined, info: ConversionInfo): number | null {
  if (amount == null || !Number.isFinite(amount) || amount <= 0 || !unit) return null;

  if (unit === "g") return amount;
  if (unit === "pinch") return amount * PINCH_GRAMS;
  if (unit === "piece") return info.piece_weight_g && info.piece_weight_g > 0 ? amount * info.piece_weight_g : null;

  const ml = UNIT_ML[unit];
  if (ml == null) return null;
  const density = info.density_g_per_ml && info.density_g_per_ml > 0 ? info.density_g_per_ml : 1;
  return amount * ml * density;
}

/** Gramm-Wert auf eine sinnvolle Genauigkeit runden (für die Speicherung). */
export function roundGrams(grams: number): number {
  return grams >= 10 ? Math.round(grams * 10) / 10 : Math.round(grams * 100) / 100;
}

/**
 * Gramm für eine Rezeptzeile: berechnet, wenn möglich, sonst die manuelle
 * Angabe des Nutzers (z. B. „1 Stück ≈ 120 g“, wenn kein Stückgewicht bekannt ist).
 */
export function resolveLineGrams(
  amount: number | null | undefined,
  unit: Unit | null | undefined,
  info: ConversionInfo,
  manualGrams?: number | null,
): number | null {
  const computed = toGrams(amount, unit, info);
  if (computed != null) return roundGrams(computed);
  if (manualGrams != null && Number.isFinite(manualGrams) && manualGrams >= 0) return roundGrams(manualGrams);
  return null;
}

/** Braucht diese Zeile eine manuelle Gramm-Angabe? */
export function needsManualGrams(amount: number | null | undefined, unit: Unit | null | undefined, info: ConversionInfo) {
  return amount != null && amount > 0 && unit === "piece" && !(info.piece_weight_g && info.piece_weight_g > 0);
}
