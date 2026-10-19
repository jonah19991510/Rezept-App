import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Link2, Plus, SearchX } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { RecipeCard } from "@/components/recipes/recipe-card";
import { RecipeFilters } from "@/components/recipes/recipe-filters";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { cookSummary } from "@/lib/domain/cooklog";
import { collectTags, filterRecipes, hasActiveFilter, parseRecipeFilter } from "@/lib/domain/recipe-filter";
import { todayInBerlin } from "@/lib/domain/week";
import { getCookLogs, getLongNotCookedWeeks, getRecipeCosts } from "@/lib/server/kitchen-log";
import { getOwnRecipeList } from "@/lib/server/recipes";

export const metadata: Metadata = { title: "Rezepte" };

export default async function RecipesPage({ searchParams }: PageProps<"/rezepte">) {
  const user = await requireUser();
  const [list, params, costs, logs, longWeeks] = await Promise.all([
    getOwnRecipeList(user.id),
    searchParams,
    getRecipeCosts(),
    getCookLogs(user.id),
    getLongNotCookedWeeks(user.id),
  ]);
  // Phase 12: Kosten pro Portion und Koch-Log für Filter und Karten
  const all = list.map((r) => {
    const s = cookSummary(logs.filter((l) => l.recipeId === r.id));
    const cost = costs.get(r.id);
    return {
      ...r,
      costPerServing: cost?.perServing ?? null,
      costComplete: cost ? cost.priced === cost.count : undefined,
      avgRating: s.avgRating,
      lastCooked: s.lastDate,
    };
  });
  const filter = parseRecipeFilter(params);
  const recipes = filterRecipes(all, filter, { today: todayInBerlin(), longNotCookedWeeks: longWeeks });

  const newButton = (
    <div className="flex flex-wrap gap-2">
      <Link href="/rezepte/import" className={buttonVariants({ variant: "outline" })}>
        <Link2 aria-hidden />
        Aus Link
      </Link>
      <Link href="/rezepte/neu" className={buttonVariants()}>
        <Plus aria-hidden />
        Neues Rezept
      </Link>
    </div>
  );

  if (all.length === 0) {
    return (
      <>
        <PageHeader title="Rezepte" description="Dein persönliches Rezeptbuch." />
        <EmptyState icon={BookOpen} title="Dein Rezeptbuch ist noch leer" action={newButton}>
          Leg dein erstes Rezept an. Die Makros rechnet die App aus den Zutaten selbst aus.
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Rezepte"
        description={`${all.length} ${all.length === 1 ? "Rezept" : "Rezepte"} in deinem Buch`}
        actions={newButton}
      />
      <RecipeFilters ownTags={collectTags(all)} ownBook />

      {recipes.length === 0 ? (
        <EmptyState icon={SearchX} title="Nichts gefunden">
          {hasActiveFilter(filter) ? "Kein Rezept passt zu diesen Filtern. Probier es mit weniger Filtern." : null}
        </EmptyState>
      ) : (
        <>
          {hasActiveFilter(filter) ? (
            <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
              {recipes.length} von {all.length} Rezepten
            </p>
          ) : null}
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.map((recipe) => (
              <li key={recipe.id}>
                <RecipeCard recipe={recipe} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
