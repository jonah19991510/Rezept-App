import type { Metadata } from "next";
import { PantryManager } from "@/components/shopping/pantry-manager";
import { requireUser } from "@/lib/auth";
import { ingredientLabel, type IngredientLabel } from "@/lib/domain/ingredient-name";
import { todayInBerlin } from "@/lib/domain/week";
import { getMyIngredients } from "@/lib/server/my-ingredients";
import { getIngredientDisplayNames, getPantry } from "@/lib/server/pantry";
import { getOpenShoppingIngredientIds } from "@/lib/server/shopping";

export const metadata: Metadata = { title: "Vorrat" };

export default async function PantryPage({ searchParams }: PageProps<"/einkauf/vorrat">) {
  const user = await requireUser();
  const [entries, params, mine, displayNames, onList] = await Promise.all([
    getPantry(user.id),
    searchParams,
    getMyIngredients(user.id),
    getIngredientDisplayNames(),
    getOpenShoppingIngredientIds(user.id),
  ]);
  // Zum Abhaken: alle Zutaten aus eigenen Rezepten und selbst angelegte
  const candidates = mine.map(({ ingredient: i }) => ({
    ingredientId: i.id,
    name: i.name,
    foodGroup: i.food_group,
    isStaple: i.is_staple,
  }));
  // Kurzname und Zusatzzeile je Zutat (Korrektur von Hand vor automatischer Kürzung)
  const labels: Record<string, IngredientLabel> = {};
  for (const { ingredient: i } of mine) labels[i.id] = ingredientLabel({ name: i.name, source: i.source, displayName: displayNames[i.id] });
  for (const e of entries) labels[e.ingredientId] ??= ingredientLabel({ name: e.name, source: e.source, displayName: displayNames[e.ingredientId] });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="sr-only">Vorrat</h1>
      <PantryManager
        entries={entries}
        candidates={candidates}
        labels={labels}
        onList={onList}
        today={todayInBerlin()}
        initialArea={params.bereich === "bar" ? "bar" : "kitchen"}
      />
    </div>
  );
}
