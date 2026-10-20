import type { Metadata } from "next";
import Link from "next/link";
import { GlassWater, Martini, Plus, SearchX } from "lucide-react";
import { BarMood } from "@/components/bar/bar-mood";
import { KitchenBarSwitch } from "@/components/bar/kitchen-bar-switch";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { RecipeCard } from "@/components/recipes/recipe-card";
import { RecipeFilters } from "@/components/recipes/recipe-filters";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { cookSummary } from "@/lib/domain/cooklog";
import { collectBaseSpirits, collectTags, filterRecipes, hasActiveFilter, parseRecipeFilter } from "@/lib/domain/recipe-filter";
import { getCookLogs, getRecipeCosts } from "@/lib/server/kitchen-log";
import { getOwnRecipeList } from "@/lib/server/recipes";

export const metadata: Metadata = { title: "Bar" };

/** Phase 15: eigene Cocktails (Rezepte mit recipe_type „cocktail“) in der Bar-Stimmung. */
export default async function BarPage({ searchParams }: PageProps<"/rezepte/bar">) {
  const user = await requireUser();
  const [list, params, costs, logs] = await Promise.all([
    getOwnRecipeList(user.id, "cocktail"),
    searchParams,
    getRecipeCosts(),
    getCookLogs(user.id),
  ]);
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
  const cocktails = filterRecipes(all, filter);

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Link href="/einkauf/was-mixen" className={buttonVariants({ variant: "outline" })}>
        <GlassWater aria-hidden />
        Was kann ich mixen?
      </Link>
      <Link href="/rezepte/neu?typ=cocktail" className={buttonVariants()}>
        <Plus aria-hidden />
        Neuer Cocktail
      </Link>
    </div>
  );

  return (
    <>
      <BarMood />
      <KitchenBarSwitch active="bar" kitchenHref="/rezepte" barHref="/rezepte/bar" />
      {all.length === 0 ? (
        <>
          <PageHeader title="Bar" description="Deine Cocktails." />
          <EmptyState icon={Martini} title="Die Bar ist noch leer" action={actions}>
            Leg deinen ersten Cocktail an. Alkoholgehalt, Gramm Alkohol und kcal pro Drink rechnet die App aus den Zutaten
            und der Methode selbst aus.
          </EmptyState>
        </>
      ) : (
        <>
          <PageHeader
            title="Bar"
            description={`${all.length} ${all.length === 1 ? "Cocktail" : "Cocktails"} in deiner Bar`}
            actions={actions}
          />
          <RecipeFilters
            ownTags={collectTags(all)}
            baseSpirits={collectBaseSpirits(all)}
            searchPlaceholder="Cocktails durchsuchen …"
            ownBook
            mode="bar"
          />
          {cocktails.length === 0 ? (
            <EmptyState icon={SearchX} title="Nichts gefunden">
              {hasActiveFilter(filter) ? "Kein Cocktail passt zu diesen Filtern. Probier es mit weniger Filtern." : null}
            </EmptyState>
          ) : (
            <>
              {hasActiveFilter(filter) ? (
                <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
                  {cocktails.length} von {all.length} Cocktails
                </p>
              ) : null}
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cocktails.map((recipe) => (
                  <li key={recipe.id}>
                    <RecipeCard recipe={recipe} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </>
  );
}
