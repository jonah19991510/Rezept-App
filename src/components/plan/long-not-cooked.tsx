"use client";

import { Clock, Plus } from "lucide-react";
import { StarValue } from "@/components/recipes/star-rating";
import { Button } from "@/components/ui/button";

export type LongNotCookedItem = { id: string; title: string; weeksAgo: number; avgRating: number };

/** Vorschlag im Wochenplan: gut bewertete Rezepte, die lange nicht gekocht wurden. */
export function LongNotCooked({ items, weeks, onPlan }: { items: LongNotCookedItem[]; weeks: number; onPlan: (recipeId: string) => void }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-6 rounded-3xl border bg-card p-4 md:p-5" aria-labelledby="lange-nicht">
      <h2 id="lange-nicht" className="mb-1 flex items-center gap-2 text-xl font-semibold">
        <Clock className="size-5 text-primary" aria-hidden />
        Lange nicht gekocht
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">Gut bewertet und seit mindestens {weeks} Wochen nicht mehr auf dem Tisch.</p>
      <ul className="divide-y rounded-2xl border">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{item.title}</span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <StarValue value={item.avgRating} />
                vor {item.weeksAgo} Wochen
              </span>
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => onPlan(item.id)} aria-label={`${item.title} einplanen`}>
              <Plus aria-hidden />
              Einplanen
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
