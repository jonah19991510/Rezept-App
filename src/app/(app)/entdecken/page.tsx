import type { Metadata } from "next";
import Link from "next/link";
import { Compass, SearchX } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { RecipeCard } from "@/components/recipes/recipe-card";
import { RecipeFilters } from "@/components/recipes/recipe-filters";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { collectTags, filterRecipes, hasActiveFilter, parseRecipeFilter } from "@/lib/domain/recipe-filter";
import { getPublicRecipeList } from "@/lib/server/recipes";

export const metadata: Metadata = { title: "Entdecken" };

export default async function DiscoverPage({ searchParams }: PageProps<"/entdecken">) {
  const user = await requireUser();
  const [all, params] = await Promise.all([getPublicRecipeList(user.id), searchParams]);
  const filter = parseRecipeFilter(params);
  const recipes = filterRecipes(all, filter);
  const authors = new Set(all.map((r) => r.author?.name)).size;

  if (all.length === 0) {
    return (
      <>
        <PageHeader title="Entdecken" description="Rezepte, die andere aus der Runde veröffentlicht haben." />
        <EmptyState
          icon={Compass}
          title="Noch keine öffentlichen Rezepte"
          action={
            <Link href="/rezepte" className={buttonVariants({ variant: "outline" })}>
              Zu deinen Rezepten
            </Link>
          }
        >
          Rezepte sind zuerst privat. Öffne eins deiner Rezepte und schalte „Öffentlich“ ein, dann erscheint es hier für
          alle aus der Runde, mit deinem Anzeigenamen.
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Entdecken"
        description={`${all.length} öffentliche ${all.length === 1 ? "Rezept" : "Rezepte"} von ${authors} ${authors === 1 ? "Person" : "Personen"}`}
      />
      <RecipeFilters
        ownTags={collectTags(all)}
        tagGroupLabel="Tags der Rezepte"
        searchPlaceholder="Rezepte oder Namen suchen …"
      />

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
