import type { Unit } from "./units";

// Zentrale Umrechnung amerikanischer Einheiten in metrische (SPEC Abschnitt 8).
// Genutzt vom Import (Zutatenzeilen, Schritttexte) und vom Umrechner-Werkzeug.

export type UsUnit = "cup" | "tbsp" | "tsp" | "fl_oz" | "pint" | "quart" | "oz" | "lb" | "stick";

type UsUnitInfo = { label: string; kind: "volume" | "weight"; ml?: number; g?: number };

export const US_UNITS: Record<UsUnit, UsUnitInfo> = {
  cup: { label: "cup", kind: "volume", ml: 240 },
  tbsp: { label: "tbsp", kind: "volume", ml: 15 },
  tsp: { label: "tsp", kind: "volume", ml: 5 },
  fl_oz: { label: "fl oz", kind: "volume", ml: 29.57 },
  pint: { label: "pint", kind: "volume", ml: 473 },
  quart: { label: "quart", kind: "volume", ml: 946 },
  oz: { label: "oz", kind: "weight", g: 28.35 },
  lb: { label: "lb", kind: "weight", g: 453.6 },
  stick: { label: "stick", kind: "weight", g: 113 }, // 1 stick Butter
};

/** Zutaten mit dieser Dichte gelten als Flüssigkeit und bleiben in ml (Milch, Wasser, Brühe, Saft). */
export function isLiquidDensity(density: number | null | undefined): boolean {
  return density == null || (density >= 0.95 && density <= 1.1);
}

/** Gramm/Milliliter sinnvoll runden: unter 10 auf eine Nachkommastelle, sonst ganze Zahlen. */
export function roundMetric(value: number): number {
  return value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
}

export type MetricAmount = { amount: number; unit: Extract<Unit, "g" | "ml" | "tbsp" | "tsp"> };

/**
 * Rechnet eine US-Menge in eine metrische um.
 * - tbsp/tsp bleiben EL/TL (gleiches Maß).
 * - Gewicht (oz, lb, stick) → g.
 * - Volumen (cup, fl oz, pint, quart) → g über die Dichte der Zutat, wenn sie fest ist (Mehl, Zucker, Reis),
 *   sonst ml (ohne Dichte gilt 1 cup = 240 ml).
 */
export function convertUsAmount(amount: number, unit: UsUnit, density?: number | null): MetricAmount {
  if (unit === "tbsp") return { amount, unit: "tbsp" };
  if (unit === "tsp") return { amount, unit: "tsp" };
  const info = US_UNITS[unit];
  if (info.kind === "weight") return { amount: roundMetric(amount * info.g!), unit: "g" };
  const ml = amount * info.ml!;
  if (density != null && density > 0 && !isLiquidDensity(density)) return { amount: roundMetric(ml * density), unit: "g" };
  return { amount: roundMetric(ml), unit: "ml" };
}

/** °F → °C, für Backofentemperaturen auf 5 °C gerundet. */
export function fahrenheitToCelsius(f: number): number {
  const c = ((f - 32) * 5) / 9;
  return Math.abs(c) >= 50 ? Math.round(c / 5) * 5 : Math.round(c);
}

const FAHRENHEIT = /(\d{2,3})(?:\s*(?:-|–|to|bis)\s*(\d{2,3}))?\s*(?:°|º)?\s*(?:degrees?\s+)?(?:F\b|Fahrenheit\b|Grad\s+Fahrenheit\b)/gi;

/** Ersetzt Fahrenheit-Angaben im Text („Bake at 350°F“, „375-400 degrees F“) durch °C. */
export function convertFahrenheitInText(text: string): string {
  return text.replace(FAHRENHEIT, (match, a: string, b: string | undefined) => {
    const lo = Number(a);
    const hi = b != null ? Number(b) : null;
    // Nur plausible Temperaturen (sonst z. B. „100 F“ als Abkürzung)
    if (lo < 90 || lo > 600 || (hi != null && (hi < 90 || hi > 600))) return match;
    return hi != null ? `${fahrenheitToCelsius(lo)}–${fahrenheitToCelsius(hi)} °C` : `${fahrenheitToCelsius(lo)} °C`;
  });
}
