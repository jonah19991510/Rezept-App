import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, SearchX } from "lucide-react";
import { KitchenBarSwitch } from "@/components/bar/kitchen-bar-switch";
import { EmptyState } from "@/components/layout/empty-state";
import { NewRecipeFab } from "@/components/recipes/new-recipe-fab";
import { ReadyBanner } from "@/components/recipes/ready-banner";
import { RecipeFilters } from "@/components/recipes/recipe-filters";
import { RecipeList } from "@/components/recipes/recipe-list";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { cookSummary } from "@/lib/domain/cooklog";
import { collectTags, filterRecipes, hasActiveFilter, parseRecipeFilter } from "@/lib/domain/recipe-filter";
import { todayInBerlin } from "@/lib/domain/week";
import { getCookLogs, getLongNotCookedWeeks, getRecipeCosts } from "@/lib/server/kitchen-log";
import { countReadyRecipes } from "@/lib/server/pantry";
import { getOwnRecipeList, getRecipeListSettings } from "@/lib/server/recipes";

export const metadata: Metadata = { title: "Rezepte" };

export default async function RecipesPage({ searchParams }: PageProps<"/rezepte">) {
  const user = await requireUser();
  const [list, params, costs, logs, longWeeks, settings, ready] = await Promise.all([
    getOwnRecipeList(user.id),
    searchParams,
    getRecipeCosts(),
    getCookLogs(user.id),
    getLongNotCookedWeeks(user.id),
    getRecipeListSettings(user.id, "dish"),
    countReadyRecipes(user.id, "dish"),
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
  // Ohne ?sortierung= gilt die gespeicherte Sortierung
  const filter = parseRecipeFilter({ ...params, sortierung: params.sortierung ?? settings.sort });
  const recipes = filterRecipes(all, filter, { today: todayInBerlin(), longNotCookedWeeks: longWeeks });
  const noun = (n: number) => (n === 1 ? "Rezept" : "Rezepte");

  return (
    <>
      <h1 className="sr-only">Rezepte</h1>
      <KitchenBarSwitch active="kitchen" kitchenHref="/rezepte" barHref="/rezepte/bar" />
      {all.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Dein Rezeptbuch ist noch leer"
          action={
            <Link href="/rezepte/neu" className={buttonVariants()}>
              Erstes Rezept anlegen
            </Link>
          }
        >
          Leg dein erstes Rezept an. Die Makros rechnet die App aus den Zutaten selbst aus. Rezepte aus dem Netz oder aus
          Notion holst du unter Einstellungen → Deine Daten → Rezepte importieren.
        </EmptyState>
      ) : (
        <>
          <ReadyBanner kind="kitchen" count={ready} />
          <RecipeFilters ownTags={collectTags(all)} ownBook />
          <RecipeList
            recipes={recipes}
            initialView={settings.view}
            initialSort={filter.sortierung ?? "neu"}
            countLabel={
              hasActiveFilter(filter) ? `${recipes.length} von ${all.length} ${noun(all.length)}` : `${all.length} ${noun(all.length)}`
            }
            empty={
              <EmptyState icon={SearchX} title="Nichts gefunden">
                Kein Rezept passt zu diesen Filtern. Probier es mit weniger Filtern.
              </EmptyState>
            }
          />
        </>
      )}
      <NewRecipeFab href="/rezepte/neu" label="Neues Rezept" />
    </>
  );
}
