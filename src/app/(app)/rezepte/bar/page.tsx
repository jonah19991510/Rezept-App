import type { Metadata } from "next";
import Link from "next/link";
import { Martini, SearchX } from "lucide-react";
import { KitchenBarSwitch } from "@/components/bar/kitchen-bar-switch";
import { EmptyState } from "@/components/layout/empty-state";
import { NewRecipeFab } from "@/components/recipes/new-recipe-fab";
import { ReadyBanner } from "@/components/recipes/ready-banner";
import { RecipeFilters } from "@/components/recipes/recipe-filters";
import { RecipeList } from "@/components/recipes/recipe-list";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { cookSummary } from "@/lib/domain/cooklog";
import { collectBaseSpirits, collectTags, filterRecipes, hasActiveFilter, parseRecipeFilter } from "@/lib/domain/recipe-filter";
import { getCookLogs, getRecipeCosts } from "@/lib/server/kitchen-log";
import { countReadyRecipes } from "@/lib/server/pantry";
import { getOwnRecipeList, getRecipeView } from "@/lib/server/recipes";

export const metadata: Metadata = { title: "Bar" };

/** Phase 15: eigene Cocktails (Rezepte mit recipe_type „cocktail“) im selben Design wie die Küche. */
export default async function BarPage({ searchParams }: PageProps<"/rezepte/bar">) {
  const user = await requireUser();
  const [list, params, costs, logs, view, ready] = await Promise.all([
    getOwnRecipeList(user.id, "cocktail"),
    searchParams,
    getRecipeCosts(),
    getCookLogs(user.id),
    getRecipeView(user.id),
    countReadyRecipes(user.id, "cocktail"),
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
  const noun = (n: number) => (n === 1 ? "Cocktail" : "Cocktails");

  return (
    <>
      <h1 className="sr-only">Bar</h1>
      <KitchenBarSwitch active="bar" kitchenHref="/rezepte" barHref="/rezepte/bar" />
      {all.length === 0 ? (
        <EmptyState
          icon={Martini}
          title="Die Bar ist noch leer"
          action={
            <Link href="/rezepte/neu?typ=cocktail" className={buttonVariants()}>
              Ersten Cocktail anlegen
            </Link>
          }
        >
          Leg deinen ersten Cocktail an. Alkoholgehalt, Gramm Alkohol und kcal pro Drink rechnet die App aus den Zutaten
          und der Methode selbst aus.
        </EmptyState>
      ) : (
        <>
          <ReadyBanner kind="bar" count={ready} />
          <RecipeFilters
            ownTags={collectTags(all)}
            baseSpirits={collectBaseSpirits(all)}
            searchPlaceholder="Cocktails durchsuchen …"
            ownBook
            mode="bar"
          />
          <RecipeList
            recipes={cocktails}
            initialView={view}
            mode="bar"
            countLabel={
              hasActiveFilter(filter)
                ? `${cocktails.length} von ${all.length} ${noun(all.length)}`
                : `${all.length} ${noun(all.length)}`
            }
            empty={
              <EmptyState icon={SearchX} title="Nichts gefunden">
                Kein Cocktail passt zu diesen Filtern. Probier es mit weniger Filtern.
              </EmptyState>
            }
          />
        </>
      )}
      <NewRecipeFab href="/rezepte/neu?typ=cocktail" label="Neuer Cocktail" />
    </>
  );
}
