import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Plus, SearchX } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { RecipeCard } from "@/components/recipes/recipe-card";
import { RecipeFilters } from "@/components/recipes/recipe-filters";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { collectTags, filterRecipes, hasActiveFilter, parseRecipeFilter } from "@/lib/domain/recipe-filter";
import { getOwnRecipeList } from "@/lib/server/recipes";

export const metadata: Metadata = { title: "Rezepte" };

export default async function RecipesPage({ searchParams }: PageProps<"/rezepte">) {
  const user = await requireUser();
  const [all, params] = await Promise.all([getOwnRecipeList(user.id), searchParams]);
  const filter = parseRecipeFilter(params);
  const recipes = filterRecipes(all, filter);

  const newButton = (
    <Link href="/rezepte/neu" className={buttonVariants()}>
      <Plus aria-hidden />
      Neues Rezept
    </Link>
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
      <RecipeFilters ownTags={collectTags(all)} />

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
