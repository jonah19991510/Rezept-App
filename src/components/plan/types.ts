import type { MealSlot } from "@/lib/domain/plan";

import type { PlanRecipeOption } from "@/lib/domain/community";

export type { PlanRecipeOption };

/** Auswahl im Einplanen-Dialog: eigenes Buch und öffentliche Rezepte anderer. */
export type PlanRecipeChoices = { own: PlanRecipeOption[]; community: PlanRecipeOption[] };

export type SlotTarget = { date: string; slot: MealSlot };
