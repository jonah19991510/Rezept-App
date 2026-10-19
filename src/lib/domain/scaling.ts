import type { Unit } from "./units";

// Portionen skalieren (Rezeptseite und Kochmodus). Mengen werden sinnvoll gerundet:
// keine „0,37 Eier“, sondern „ca. ½ Ei“; Gramm und Milliliter ganzzahlig.

export type ScaledAmount = { amount: number | null; approx: boolean };

/** Faktor zwischen gewünschten und im Rezept angegebenen Portionen. */
export function scaleFactor(targetServings: number, recipeServings: number): number {
  if (!(recipeServings > 0) || !(targetServings > 0)) return 1;
  return targetServings / recipeServings;
}

const roundTo = (value: number, step: number) => Math.round(value / step) * step;

function roundForUnit(value: number, unit: Unit | null): number {
  switch (unit) {
    case "g":
    case "ml":
      if (value < 10) return Math.max(0.5, Math.round(value * 2) / 2); // kleine Mengen (Hefe, Gewürze) auf 0,5
      if (value < 250) return Math.round(value);
      return roundTo(value, 5);
    case "cl":
      return Math.max(0.5, roundTo(value, 0.5));
    case "tbsp":
    case "tsp":
    case "barspoon":
      return value < 1 ? Math.max(0.25, roundTo(value, 0.25)) : roundTo(value, 0.5);
    case "piece":
    case null:
      return value < 0.5 ? Math.max(0.25, roundTo(value, 0.25)) : roundTo(value, 0.5);
    case "pinch":
    case "dash":
      return Math.max(1, Math.round(value));
    default:
      return Math.round(value * 100) / 100;
  }
}

/**
 * Skalierte Menge. `approx` ist true, wenn die Rundung den Wert spürbar verändert hat
 * (mehr als 5 %); dann zeigt die Oberfläche „ca.“ an. Gramm/ml gelten nie als „ca.“.
 */
export function scaleAmount(amount: number | null, unit: Unit | null, factor: number): ScaledAmount {
  if (amount == null) return { amount: null, approx: false };
  if (factor === 1) return { amount, approx: false };
  const exact = amount * factor;
  const rounded = roundForUnit(exact, unit);
  const approx = unit !== "g" && unit !== "ml" && Math.abs(rounded - exact) / exact > 0.05;
  return { amount: rounded, approx };
}

/** Portionen in sinnvollen Schritten ändern: ab 1 ganze Portionen, darunter halbe. */
export function stepServings(current: number, direction: 1 | -1): number {
  if (direction === 1) return current < 1 ? 1 : Math.min(100, Math.floor(current) + 1);
  if (current <= 1) return 0.5;
  return Math.max(1, Math.ceil(current) - 1);
}
