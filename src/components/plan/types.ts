import type { MealSlot } from "@/lib/domain/plan";

/** Rezept zur Auswahl im Wochenplan (aus dem eigenen Buch). */
export type PlanRecipeOption = {
  id: string;
  title: string;
  kcal: number | null;
  protein: number | null;
  isFavorite: boolean;
};

export type SlotTarget = { date: string; slot: MealSlot };
