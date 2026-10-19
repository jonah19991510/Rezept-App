import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, ExternalLink, TriangleAlert, Users } from "lucide-react";
import { FavoriteButton } from "@/components/recipes/favorite-button";
import { MacroSummary } from "@/components/recipes/macro-summary";
import { RecipeActions } from "@/components/recipes/recipe-actions";
import { RecipeTags } from "@/components/recipes/recipe-tags";
import { requireUser } from "@/lib/auth";
import { autoTagsFor } from "@/lib/domain/recipe-filter";
import { formatGrams } from "@/lib/format";
import { formatMinutes, formatQuantity } from "@/lib/format-quantity";
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

export default async function RecipePage({ params }: PageProps<"/rezepte/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await requireUser();
  const detail = await getRecipeDetail(id, user.id);
  if (!detail) notFound();

  const { recipe, nutrition, ingredients, steps } = detail;
  const prep = formatMinutes(recipe.prep_minutes);
  const cook = formatMinutes(recipe.cook_minutes);
  const total = formatMinutes((recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0));
  const missingGrams = ingredients.filter((l) => l.amount != null && l.grams == null);

  return (
    <article className="space-y-8">
      <div className="space-y-4">
        <Link
          href="/rezepte"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Alle Rezepte
        </Link>

        <header className="space-y-3">
          {recipe.category ? (
            <p className="text-sm font-medium tracking-wide text-primary uppercase">{CATEGORY_LABELS[recipe.category]}</p>
          ) : null}
          <h1 className="text-3xl font-semibold text-balance md:text-4xl">{recipe.title}</h1>
          {!detail.isOwner && detail.authorName ? (
            <p className="text-sm text-muted-foreground">von {detail.authorName}</p>
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
          <RecipeActions recipeId={recipe.id} title={recipe.title} isOwner={detail.isOwner} />
          <FavoriteButton recipeId={recipe.id} isFavorite={detail.isFavorite} />
        </div>
      </div>

      {nutrition && nutrition.kcal_per_serving != null ? (
        <section aria-labelledby="makros" className="rounded-3xl border bg-card p-4 md:p-5">
          <h2 id="makros" className="mb-3 text-xl font-semibold">
            Nährwerte
          </h2>
          <MacroSummary
            values={{
              kcal: nutrition.kcal_per_serving,
              protein: nutrition.protein_per_serving ?? 0,
              carbs: nutrition.carbs_per_serving ?? 0,
              fat: nutrition.fat_per_serving ?? 0,
              fiber: nutrition.fiber_per_serving ?? 0,
            }}
            total={{
              kcal: nutrition.kcal_total ?? 0,
              protein: nutrition.protein_total ?? 0,
              carbs: nutrition.carbs_total ?? 0,
              fat: nutrition.fat_total ?? 0,
            }}
          />
        </section>
      ) : null}

      <div className="grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section aria-labelledby="zutaten" className="space-y-3">
          <h2 id="zutaten" className="text-xl font-semibold">
            Zutaten
          </h2>
          {ingredients.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Zutaten eingetragen.</p>
          ) : (
            <ul className="divide-y rounded-2xl border bg-card">
              {ingredients.map((line) => (
                <li key={line.id} className="flex gap-3 px-4 py-3">
                  <span className="w-24 shrink-0 font-medium tabular-nums">
                    {formatQuantity(line.amount, line.unit) || "–"}
                  </span>
                  <span className="min-w-0">
                    {line.ingredient.name}
                    {line.note ? <span className="text-muted-foreground">, {line.note}</span> : null}
                    {line.grams != null && line.unit !== "g" ? (
                      <span className="block text-xs text-muted-foreground">≈ {formatGrams(line.grams, 0)}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {missingGrams.length > 0 ? (
            <p className="flex gap-2 text-sm text-muted-foreground">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              Für {missingGrams.map((l) => l.ingredient.name).join(", ")} fehlt das Gewicht. Diese Zutaten zählen in den
              Nährwerten nicht mit.
            </p>
          ) : null}
        </section>

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
      </div>

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
