import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleCheck, Clock, ExternalLink, GitFork, Users } from "lucide-react";
import { FavoriteButton } from "@/components/recipes/favorite-button";
import { PublishToggle } from "@/components/recipes/publish-toggle";
import { RecipePhoto } from "@/components/recipes/recipe-photo";
import { RecipeActions } from "@/components/recipes/recipe-actions";
import { RecipeTags } from "@/components/recipes/recipe-tags";
import { ScaledRecipeContent } from "@/components/recipes/scaled-recipe-content";
import { requireUser } from "@/lib/auth";
import { authorName } from "@/lib/domain/community";
import { autoTagsFor } from "@/lib/domain/recipe-filter";
import { formatMinutes } from "@/lib/format-quantity";
import { CATEGORY_LABELS } from "@/lib/labels";
import { getRecipeDetail } from "@/lib/server/recipes";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: PageProps<"/rezepte/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Rezept" };
  const user = await requireUser();
  const detail = await getRecipeDetail(id, user.id);
  return { title: detail?.recipe.title ?? "Rezept" };
}

export default async function RecipePage({ params, searchParams }: PageProps<"/rezepte/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const user = await requireUser();
  const detail = await getRecipeDetail(id, user.id);
  if (!detail) notFound();

  const { recipe, nutrition, ingredients, steps } = detail;
  const prep = formatMinutes(recipe.prep_minutes);
  const cook = formatMinutes(recipe.cook_minutes);
  const total = formatMinutes((recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0));
  const missingGrams = ingredients.filter((l) => l.amount != null && l.grams == null);
  // Direkt nach „In mein Rezeptbuch übernehmen“ (Weiterleitung mit ?uebernommen=1)
  const justForked = detail.isOwner && query.uebernommen === "1" && recipe.forked_from_id != null;
  const back = detail.isOwner ? { href: "/rezepte", label: "Alle Rezepte" } : { href: "/entdecken", label: "Entdecken" };

  return (
    <article className="space-y-8">
      <div className="space-y-4">
        <Link
          href={back.href}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {back.label}
        </Link>

        {justForked ? (
          <p
            role="status"
            className="flex items-start gap-2 rounded-2xl border border-sage/40 bg-sage/10 px-4 py-3 text-sm"
          >
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-sage" aria-hidden />
            In dein Rezeptbuch übernommen. Das ist jetzt deine eigene, private Kopie: Du kannst sie frei bearbeiten.
          </p>
        ) : null}

        <RecipePhoto recipeId={recipe.id} imagePath={recipe.image_url} title={recipe.title} isOwner={detail.isOwner} />

        <header className="space-y-3">
          {recipe.category ? (
            <p className="text-sm font-medium tracking-wide text-primary uppercase">{CATEGORY_LABELS[recipe.category]}</p>
          ) : null}
          <h1 className="text-3xl font-semibold text-balance md:text-4xl">{recipe.title}</h1>
          {!detail.isOwner ? <p className="text-sm text-muted-foreground">von {authorName(detail.authorName)}</p> : null}
          {detail.isOwner && detail.forkedFrom ? (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <GitFork className="size-4" aria-hidden />
              <span>
                Übernommen von {detail.forkedFrom.authorName}:{" "}
                <Link href={`/rezepte/${detail.forkedFrom.id}`} className="text-primary underline-offset-4 hover:underline">
                  {detail.forkedFrom.title}
                </Link>
              </span>
            </p>
          ) : null}
          {recipe.description ? <p className="max-w-prose text-muted-foreground">{recipe.description}</p> : null}

          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <Users className="size-4" aria-hidden />
              {recipe.servings} {recipe.servings === 1 ? "Portion" : "Portionen"}
            </li>
            {total ? (
              <li className="flex items-center gap-1.5">
                <Clock className="size-4" aria-hidden />
                {total}
                {prep && cook ? ` (${prep} Vorbereitung, ${cook} Kochen)` : ""}
              </li>
            ) : null}
          </ul>

          <RecipeTags
            autoTags={autoTagsFor({ is_meal_prep: recipe.is_meal_prep, nutrition })}
            tags={recipe.tags}
          />
        </header>

        <div className="flex flex-wrap gap-2">
          <RecipeActions
            recipeId={recipe.id}
            title={recipe.title}
            isOwner={detail.isOwner}
            ownCopyId={detail.ownCopyId}
          />
          <FavoriteButton recipeId={recipe.id} isFavorite={detail.isFavorite} />
        </div>
      </div>

      <ScaledRecipeContent
        recipeId={recipe.id}
        servings={recipe.servings}
        perServing={
          nutrition && nutrition.kcal_per_serving != null
            ? {
                kcal: nutrition.kcal_per_serving,
                protein: nutrition.protein_per_serving ?? 0,
                carbs: nutrition.carbs_per_serving ?? 0,
                fat: nutrition.fat_per_serving ?? 0,
                fiber: nutrition.fiber_per_serving ?? 0,
              }
            : null
        }
        lines={ingredients.map((l) => ({
          id: l.id,
          amount: l.amount,
          unit: l.unit,
          grams: l.grams,
          name: l.ingredient.name,
          note: l.note,
        }))}
        missingGramsNames={missingGrams.map((l) => l.ingredient.name)}
        steps={
          <section aria-labelledby="zubereitung" className="space-y-3">
            <h2 id="zubereitung" className="text-xl font-semibold">
              Zubereitung
            </h2>
            {steps.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Schritte eingetragen.</p>
            ) : (
              <ol className="space-y-4">
                {steps.map((step) => (
                  <li key={step.id} className="flex gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                      {step.position}
                    </span>
                    <p className="pt-1 leading-relaxed">{step.text}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        }
      />

      {detail.isOwner ? (
        <PublishToggle recipeId={recipe.id} isPublic={recipe.is_public} displayName={user.displayName} />
      ) : null}

      {recipe.source_url ? (
        <p className="text-sm text-muted-foreground">
          Quelle:{" "}
          <a
            href={recipe.source_url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1 break-all text-primary underline-offset-4 hover:underline"
          >
            {new URL(recipe.source_url).hostname}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </p>
      ) : null}
    </article>
  );
}
