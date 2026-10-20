import { z } from "zod";
import { Constants } from "@/lib/supabase/database.types";
import type { DayMacros } from "./plan";

// Phase 12: Rezept-Versionen. Die Datenbank legt beim Speichern einer inhaltlichen Änderung einen Snapshot an
// (save_recipe); hier wird er gelesen, verglichen und für die Wiederherstellung aufbereitet.

const snapshotSchema = z.object({
  title: z.string().catch(""),
  servings: z.number().catch(1),
  ingredients: z
    .array(
      z.object({
        ingredient_id: z.string(),
        name: z.string().catch("Zutat"),
        amount: z.number().nullable().catch(null),
        unit: z.string().nullable().catch(null),
        grams: z.number().nullable().catch(null),
        note: z.string().nullable().catch(null),
        step_position: z.number().nullable().catch(null),
      }),
    )
    .catch([]),
  steps: z.array(z.object({ text: z.string(), timer_seconds: z.number().nullable().catch(null) })).catch([]),
  /** Phase 15: Cocktail-Felder (Gerichte und ältere Versionen: null) */
  cocktail: z
    .object({
      glass: z.enum(Constants.public.Enums.glass).nullable().catch(null),
      method: z.enum(Constants.public.Enums.cocktail_method).nullable().catch(null),
      ice: z.string().nullable().catch(null),
      garnish: z.string().nullable().catch(null),
    })
    .nullable()
    .catch(null)
    .default(null),
});

export type RecipeSnapshot = z.infer<typeof snapshotSchema>;
export type SnapshotIngredient = RecipeSnapshot["ingredients"][number];

/** Snapshot aus der Datenbank lesen (fehlerhafte Felder werden mit Standardwerten aufgefüllt). */
export function parseSnapshot(value: unknown): RecipeSnapshot {
  return snapshotSchema.parse(value ?? {});
}

export type IngredientChange =
  | { kind: "added"; after: SnapshotIngredient }
  | { kind: "removed"; before: SnapshotIngredient }
  | { kind: "changed"; before: SnapshotIngredient; after: SnapshotIngredient }
  | { kind: "same"; after: SnapshotIngredient };

function key(i: SnapshotIngredient, occurrence: number) {
  return `${i.ingredient_id}#${occurrence}`;
}

function withKeys(list: SnapshotIngredient[]) {
  const seen = new Map<string, number>();
  return list.map((i) => {
    const n = seen.get(i.ingredient_id) ?? 0;
    seen.set(i.ingredient_id, n + 1);
    return { key: key(i, n), item: i };
  });
}

/**
 * Zutaten zweier Versionen vergleichen. Gleiche Zutat (bei mehrfachem Vorkommen in Reihenfolge) wird
 * gegenübergestellt; geändert heißt: andere Menge, Einheit oder Notiz.
 */
export function diffIngredients(before: SnapshotIngredient[], after: SnapshotIngredient[]): IngredientChange[] {
  const old = new Map(withKeys(before).map((x) => [x.key, x.item]));
  const result: IngredientChange[] = [];
  const used = new Set<string>();
  for (const { key: k, item } of withKeys(after)) {
    const prev = old.get(k);
    if (!prev) {
      result.push({ kind: "added", after: item });
      continue;
    }
    used.add(k);
    const changed = prev.amount !== item.amount || prev.unit !== item.unit || (prev.note ?? "") !== (item.note ?? "");
    result.push(changed ? { kind: "changed", before: prev, after: item } : { kind: "same", after: item });
  }
  for (const [k, item] of old) if (!used.has(k)) result.push({ kind: "removed", before: item });
  return result;
}

export type StepChange = { position: number; kind: "added" | "removed" | "changed" | "same"; before?: string; after?: string };

/** Schritte nach Position vergleichen. */
export function diffSteps(before: RecipeSnapshot["steps"], after: RecipeSnapshot["steps"]): StepChange[] {
  const length = Math.max(before.length, after.length);
  return Array.from({ length }, (_, i) => {
    const b = before[i]?.text;
    const a = after[i]?.text;
    if (b == null) return { position: i + 1, kind: "added" as const, after: a };
    if (a == null) return { position: i + 1, kind: "removed" as const, before: b };
    return { position: i + 1, kind: b === a && before[i].timer_seconds === after[i].timer_seconds ? ("same" as const) : ("changed" as const), before: b, after: a };
  });
}

export type Per100 = { kcal: number; protein: number; carbs: number; fat: number };

/** Makros pro Portion einer Version (mit den heutigen Nährwerten der Zutaten). */
export function snapshotMacros(snapshot: RecipeSnapshot, nutrition: Map<string, Per100>): DayMacros {
  const total = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const i of snapshot.ingredients) {
    const n = nutrition.get(i.ingredient_id);
    if (!n || i.grams == null) continue;
    total.kcal += (i.grams * n.kcal) / 100;
    total.protein += (i.grams * n.protein) / 100;
    total.carbs += (i.grams * n.carbs) / 100;
    total.fat += (i.grams * n.fat) / 100;
  }
  const s = snapshot.servings || 1;
  return { kcal: total.kcal / s, protein: total.protein / s, carbs: total.carbs / s, fat: total.fat / s };
}

/** Kurzbeschreibung der Änderungen, z. B. „2 Zutaten geändert, 1 neu, Portionen 4 → 6“. */
export function changeSummary(before: RecipeSnapshot, after: RecipeSnapshot): string {
  const ing = diffIngredients(before.ingredients, after.ingredients);
  const steps = diffSteps(before.steps, after.steps).filter((s) => s.kind !== "same").length;
  const parts: string[] = [];
  const count = (kind: IngredientChange["kind"]) => ing.filter((c) => c.kind === kind).length;
  if (count("changed")) parts.push(`${count("changed")} ${count("changed") === 1 ? "Zutat" : "Zutaten"} geändert`);
  if (count("added")) parts.push(`${count("added")} neu`);
  if (count("removed")) parts.push(`${count("removed")} entfernt`);
  if (steps) parts.push(`${steps} ${steps === 1 ? "Schritt" : "Schritte"} geändert`);
  if (before.servings !== after.servings) parts.push(`Portionen ${before.servings} → ${after.servings}`);
  return parts.length ? parts.join(", ") : "keine inhaltlichen Änderungen";
}
