"use client";

import { useState, useTransition, type ReactNode } from "react";
import { ArrowDownUp, LayoutGrid, Rows3 } from "lucide-react";
import { toast } from "sonner";
import { setRecipeViewAction } from "@/app/(app)/rezepte/actions";
import type { RecipeListItem, RecipeView } from "@/lib/domain/recipe-filter";
import { cn } from "@/lib/utils";
import { RecipeCard } from "./recipe-card";
import { useUrlParams } from "./recipe-filters";

const SORT_LABELS = {
  neu: "Zuletzt geändert",
  name: "Name A–Z",
  protein: "Meiste Protein",
  kcal: "Wenigste kcal",
  zeit: "Schnellste zuerst",
} as const;

/** Phase 15: Sortierung in der Bar */
const BAR_SORT_LABELS = {
  neu: "Zuletzt geändert",
  name: "Name A–Z",
  stark: "Stärkste zuerst",
  leicht: "Leichteste zuerst",
  kcal: "Wenigste kcal",
} as const;

const VIEWS = [
  { value: "grid", label: "Nebeneinander", icon: LayoutGrid },
  { value: "list", label: "Untereinander", icon: Rows3 },
] as const;

/**
 * Anzahl, Sortierung und Ansicht über der Liste, darunter die Karten. Die Ansicht (nebeneinander oder untereinander)
 * wechselt sofort und wird für den Nutzer gespeichert.
 */
export function RecipeList({
  recipes,
  initialView,
  countLabel,
  mode = "kitchen",
  empty,
}: {
  recipes: RecipeListItem[];
  initialView: RecipeView;
  /** z. B. „12 Rezepte“ oder „3 von 12 Cocktails“ */
  countLabel: string;
  mode?: "kitchen" | "bar";
  /** wird statt der Liste gezeigt, wenn nichts zu den Filtern passt */
  empty?: ReactNode;
}) {
  const { params, update } = useUrlParams();
  const [view, setView] = useState<RecipeView>(initialView);
  const [, startTransition] = useTransition();
  const labels: Record<string, string> = mode === "bar" ? BAR_SORT_LABELS : SORT_LABELS;
  const sort = params.get("sortierung") ?? "neu";

  function changeView(next: RecipeView) {
    if (next === view) return;
    setView(next);
    startTransition(async () => {
      const result = await setRecipeViewAction(next);
      if (!result.ok) toast.error("Die Ansicht konnte nicht gespeichert werden.");
    });
  }

  return (
    <div className="pb-16 md:pb-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm text-muted-foreground" aria-live="polite">
          {countLabel}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <label className="relative inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-medium hover:bg-muted has-[select:focus-visible]:ring-3 has-[select:focus-visible]:ring-ring/50">
            <span>{labels[sort] ?? labels.neu}</span>
            <ArrowDownUp className="size-4 text-muted-foreground" aria-hidden />
            <select
              aria-label="Sortierung"
              value={sort}
              onChange={(e) => update({ sortierung: e.target.value === "neu" ? null : e.target.value })}
              className="absolute inset-0 cursor-pointer appearance-none opacity-0"
            >
              {Object.entries(labels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex rounded-full border bg-card p-0.5" role="group" aria-label="Ansicht">
            {VIEWS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                aria-label={label}
                title={label}
                onClick={() => changeView(value)}
                className={cn(
                  "grid size-10 place-items-center rounded-full text-muted-foreground transition hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  view === value && "bg-primary/15 text-primary hover:text-primary",
                )}
              >
                <Icon className="size-5" aria-hidden />
              </button>
            ))}
          </div>
        </div>
      </div>

      {recipes.length === 0 ? (
        empty
      ) : (
        <ul className={cn("grid", view === "grid" ? "grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4" : "gap-3 lg:grid-cols-2")}>
          {recipes.map((recipe) => (
            <li key={recipe.id} className="min-w-0">
              <RecipeCard recipe={recipe} view={view} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
