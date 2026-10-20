import Link from "next/link";
import { Compass, Martini, SearchX } from "lucide-react";
import { KitchenBarSwitch } from "@/components/bar/kitchen-bar-switch";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { RecipeCard } from "@/components/recipes/recipe-card";
import { RecipeFilters } from "@/components/recipes/recipe-filters";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { collectBaseSpirits, collectTags, filterRecipes, hasActiveFilter, parseRecipeFilter } from "@/lib/domain/recipe-filter";
import { getPublicRecipeList } from "@/lib/server/recipes";

/** Entdecken (Phase 6) mit Küche | Bar (Phase 15): öffentliche Rezepte bzw. Cocktails aus der Runde. */
export async function DiscoverView({
  type,
  searchParams,
}: {
  type: "dish" | "cocktail";
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const [all, params] = await Promise.all([getPublicRecipeList(user.id, type), searchParams]);
  const filter = parseRecipeFilter(params);
  const recipes = filterRecipes(all, filter);
  const authors = new Set(all.map((r) => r.author?.name)).size;
  const bar = type === "cocktail";
  const noun = bar ? { one: "Cocktail", many: "Cocktails" } : { one: "Rezept", many: "Rezepte" };

  return (
    <>
      <KitchenBarSwitch active={bar ? "bar" : "kitchen"} kitchenHref="/entdecken" barHref="/entdecken/bar" />
      {all.length === 0 ? (
        <>
          <PageHeader title="Entdecken" description={`${noun.many}, die andere aus der Runde veröffentlicht haben.`} />
          <EmptyState
            icon={bar ? Martini : Compass}
            title={`Noch keine öffentlichen ${noun.many}`}
            action={
              <Link href={bar ? "/rezepte/bar" : "/rezepte"} className={buttonVariants({ variant: "outline" })}>
                Zu deinen {noun.many}
              </Link>
            }
          >
            {noun.many} sind zuerst privat. Öffne {bar ? "einen deiner Cocktails" : "eins deiner Rezepte"} und schalte
            „Öffentlich“ ein, dann erscheint er hier für alle aus der Runde, mit deinem Anzeigenamen.
          </EmptyState>
        </>
      ) : (
        <>
          <PageHeader
            title="Entdecken"
            description={`${all.length} öffentliche ${all.length === 1 ? noun.one : noun.many} von ${authors} ${authors === 1 ? "Person" : "Personen"}`}
          />
          <RecipeFilters
            ownTags={collectTags(all)}
            tagGroupLabel={`Tags der ${noun.many}`}
            searchPlaceholder={`${noun.many} oder Namen suchen …`}
            mode={bar ? "bar" : "kitchen"}
            baseSpirits={bar ? collectBaseSpirits(all) : []}
          />

          {recipes.length === 0 ? (
            <EmptyState icon={SearchX} title="Nichts gefunden">
              {hasActiveFilter(filter) ? `Kein ${noun.one} passt zu diesen Filtern. Probier es mit weniger Filtern.` : null}
            </EmptyState>
          ) : (
            <>
              {hasActiveFilter(filter) ? (
                <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
                  {recipes.length} von {all.length} {noun.many}
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
      )}
    </>
  );
}
