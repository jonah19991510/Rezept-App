import type { IngredientOption } from "@/lib/domain/ingredient-option";
import type { TimerMode } from "@/lib/domain/recipe-editor";
import type { Unit } from "@/lib/domain/units";

/** Eine Zutat im Formular (Texte so, wie sie in den Feldern stehen). */
export type Line = {
  /** Stabiler Schlüssel (nur für React und Drag & Drop, nicht gespeichert) */
  key: number;
  ingredient: IngredientOption;
  amount: string;
  unit: Unit | "";
  manualGrams: string;
  note: string;
  /** Schritt, in dem die Zutat gebraucht wird (über den stabilen Schlüssel, damit Umsortieren nichts verschiebt) */
  stepKey: number | null;
  optional: boolean;
};

/** Ein Zubereitungsschritt im Formular. */
export type Step = { key: number; text: string; timerMode: TimerMode; timerMinutes: string };

/** Umgerechnete Werte je Zutat (gleiche Reihenfolge wie die Zeilen). */
export type ResolvedLine = { grams: number | null; needsManual: boolean };

export type FieldErrors = Record<string, string[]>;

/** IDs für Drag & Drop (Zutaten, Schritte und Gruppen teilen sich keinen Namensraum). */
export const lineId = (key: number) => `l-${key}`;
export const stepId = (key: number) => `s-${key}`;
export const groupId = (stepKey: number | null) => `g-${stepKey ?? "none"}`;

export function parseDndId(id: string | number): { kind: "line" | "step"; key: number } | { kind: "group"; stepKey: number | null } | null {
  const s = String(id);
  if (s === "g-none") return { kind: "group", stepKey: null };
  const m = /^([lsg])-(\d+)$/.exec(s);
  if (!m) return null;
  const key = Number(m[2]);
  return m[1] === "g" ? { kind: "group", stepKey: key } : { kind: m[1] === "l" ? "line" : "step", key };
}
