import type { Enums } from "@/lib/supabase/database.types";
import { formatNumber } from "@/lib/format";
import { FOOD_GROUP_LABELS } from "@/lib/labels";
import { PINCH_GRAMS, UNIT_ML, type Unit } from "./units";

// Einkaufsliste aus dem Wochenplan: Zutaten aller geplanten Mahlzeiten zusammenfassen.

export type FoodGroup = Enums<"food_group">;

/** Eine Rezeptzeile, schon mit dem Faktor „geplante Portionen / Rezeptportionen“. */
export type ShoppingSourceLine = {
  ingredientId: string;
  name: string;
  foodGroup: FoodGroup;
  isStaple: boolean;
  amount: number | null;
  unit: Unit | null;
  grams: number | null;
  factor: number;
};

export type ShoppingUnit = "g" | "ml" | "Stück";

export type ShoppingDraft = {
  ingredientId: string;
  name: string;
  foodGroup: FoodGroup;
  isStaple: boolean;
  amount: number | null;
  unit: ShoppingUnit | null;
};

type Family = "mass" | "volume" | "piece";

function family(unit: Unit): Family {
  if (unit === "g" || unit === "pinch") return "mass";
  if (unit === "piece") return "piece";
  return "volume";
}

/** Menge in der Basiseinheit der Familie: g, ml oder Stück. */
function inBaseUnit(amount: number, unit: Unit): number {
  if (unit === "pinch") return amount * PINCH_GRAMS;
  if (unit === "g" || unit === "piece") return amount;
  return amount * (UNIT_ML[unit] ?? 1);
}

const BASE_UNIT: Record<Family, ShoppingUnit> = { mass: "g", volume: "ml", piece: "Stück" };

/** Sinnvoll runden: Stück auf halbe nach oben, g/ml ganzzahlig (große Mengen auf 5). */
export function roundShoppingAmount(amount: number, unit: ShoppingUnit): number {
  if (unit === "Stück") return Math.ceil(amount * 2 - 1e-9) / 2;
  if (amount >= 100) return Math.ceil(amount / 5 - 1e-9) * 5;
  return Math.max(1, Math.ceil(amount - 1e-9));
}

/**
 * Fasst gleiche Zutaten zusammen.
 * - Alle Zeilen in derselben Einheitenfamilie (Gewicht, Volumen, Stück): Summe in g, ml bzw. Stück.
 * - Gemischte Familien (z. B. „1 Stück“ und „100 g“ Zwiebel): Summe der Grammwerte.
 * - Zeilen ohne Menge („Salz nach Geschmack“): Zutat erscheint ohne Mengenangabe, falls sonst nichts da ist.
 */
export function aggregateShopping(lines: ShoppingSourceLine[]): ShoppingDraft[] {
  const groups = new Map<string, ShoppingSourceLine[]>();
  for (const line of lines) {
    const list = groups.get(line.ingredientId) ?? [];
    list.push(line);
    groups.set(line.ingredientId, list);
  }

  const result: ShoppingDraft[] = [];
  for (const [ingredientId, group] of groups) {
    const first = group[0];
    const measured = group.filter((l) => l.amount != null && l.amount > 0 && l.unit != null);
    let amount: number | null = null;
    let unit: ShoppingUnit | null = null;

    if (measured.length > 0) {
      const families = new Set(measured.map((l) => family(l.unit as Unit)));
      if (families.size === 1) {
        const fam = [...families][0];
        unit = BASE_UNIT[fam];
        amount = measured.reduce((sum, l) => sum + inBaseUnit(l.amount as number, l.unit as Unit) * l.factor, 0);
      } else {
        const withGrams = measured.filter((l) => l.grams != null);
        if (withGrams.length > 0) {
          unit = "g";
          amount = withGrams.reduce((sum, l) => sum + (l.grams as number) * l.factor, 0);
        }
      }
      if (amount != null && unit != null) amount = roundShoppingAmount(amount, unit);
    }

    result.push({ ingredientId, name: first.name, foodGroup: first.foodGroup, isStaple: first.isStaple, amount, unit });
  }
  return result;
}

/** Reihenfolge wie beim Gang durch den Supermarkt. */
export const DEPARTMENT_ORDER: FoodGroup[] = [
  "fruit",
  "vegetables",
  "grains",
  "dairy",
  "egg",
  "meat",
  "fish",
  "legumes",
  "nuts_seeds",
  "oils_fats",
  "spices_sauces",
  "syrups_juices",
  "spirits",
  "liqueurs_wine",
  "other",
];

/** Abteilung im Laden; Obst und Gemüse liegen meist zusammen. Ohne Gruppe: eigene Einträge. */
export function departmentLabel(group: FoodGroup | null): string {
  if (group == null) return "Eigene Einträge";
  if (group === "fruit" || group === "vegetables") return "Obst & Gemüse";
  return FOOD_GROUP_LABELS[group];
}

/** Sortierschlüssel der Abteilung (Gemüse wie Obst). */
export function departmentOrder(group: FoodGroup | null): number {
  return group === "vegetables" ? departmentIndex("fruit") : departmentIndex(group);
}

export function departmentIndex(group: FoodGroup | null): number {
  if (group == null) return DEPARTMENT_ORDER.length; // manuelle Einträge ganz am Ende
  return DEPARTMENT_ORDER.indexOf(group);
}

/** „1,25 kg“, „500 g“, „1,5 l“, „2 ½ Stück“ */
export function formatShoppingAmount(amount: number | null, unit: string | null): string {
  if (amount == null) return unit ?? "";
  if (unit === "g" && amount >= 1000) return `${formatNumber(amount / 1000, 2)} kg`;
  if (unit === "ml" && amount >= 1000) return `${formatNumber(amount / 1000, 2)} l`;
  if (unit === "Stück") {
    const whole = Math.floor(amount);
    const half = amount - whole >= 0.5;
    const text = half ? (whole > 0 ? `${whole} ½` : "½") : String(whole);
    return `${text} Stück`;
  }
  return unit ? `${formatNumber(amount, 1)} ${unit}` : formatNumber(amount, 1);
}
