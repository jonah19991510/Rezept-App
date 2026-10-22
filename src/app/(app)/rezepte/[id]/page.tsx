import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleCheck, Clock, ExternalLink, GitFork, GlassWater, Snowflake, Sparkles, Users } from "lucide-react";
import { CookLogSection } from "@/components/recipes/cook-log-section";
import { FavoriteButton } from "@/components/recipes/favorite-button";
import { PublishToggle } from "@/components/recipes/publish-toggle";
import { RecipePhoto } from "@/components/recipes/recipe-photo";
import { RecipeActions } from "@/components/recipes/recipe-actions";
import { RecipeCost } from "@/components/recipes/recipe-cost";
import { RecipeTags } from "@/components/recipes/recipe-tags";
import { ScaledRecipeContent } from "@/components/recipes/scaled-recipe-content";
import { ShareLink } from "@/components/recipes/share-link";
import { VersionHistory } from "@/components/recipes/version-history";
import { requireUser } from "@/lib/auth";
import { baseSpirit, dilutionNote } from "@/lib/domain/cocktail";
import { authorName } from "@/lib/domain/community";
import { defaultPriceUnit, unpricedIngredients } from "@/lib/domain/costs";
import { autoTagsFor } from "@/lib/domain/recipe-filter";
import { snapshotMacros } from "@/lib/domain/versions";
import { todayInBerlin } from "@/lib/domain/week";
import { formatMinutes } from "@/lib/format-quantity";
import { CATEGORY_LABELS, GLASS_LABELS, METHOD_LABELS, servingsLabel } from "@/lib/labels";
import { getCookLogs, getIngredientNutrition, getPrices, getRecipeCost, getRecipeVersions } from "@/lib/server/kitchen-log";
import { linkSideDishes } from "@/lib/domain/side-dishes";
import { getOwnRecipeTitles, getRecipeDetail } from "@/lib/server/recipes";
import { getSiteUrl } from "@/lib/site-url";

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

  const { recipe, nutrition, ingredients, steps, cocktail, alcohol } = detail;
  // Phase 15: Cocktails mit Drinks und Alkoholgehalt
  const isCocktail = recipe.recipe_type === "cocktail";
  const kicker = isCocktail
    ? [
        baseSpirit(ingredients.filter((l) => !l.is_optional).map((l) => ({ name: l.ingredient.name, amount: l.amount, unit: l.unit, ingredient: l.ingredient }))) ??
          "alkoholfrei",
        cocktail?.method ? METHOD_LABELS[cocktail.method] : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : recipe.category
      ? CATEGORY_LABELS[recipe.category]
      : null;
  // Phase 12: Kosten nach eigenen Preisen, eigenes Koch-Log, Versionen (nur Owner)
  const [cost, logs, versions, prices] = await Promise.all([
    getRecipeCost(recipe.id),
    getCookLogs(user.id, recipe.id),
    detail.isOwner ? getRecipeVersions(recipe.id) : Promise.resolve([]),
    getPrices(user.id),
  ]);
  // „Preise ergänzen“: welche Zutaten noch nicht in die Kosten eingehen, mit Vorlage fürs Preisformular
  const priceById = new Map(prices.map((p) => [p.ingredientId, p]));
  const missingPrices = unpricedIngredients(
    ingredients.map((l) => ({ ingredientId: l.ingredient_id, name: l.ingredient.name, grams: l.grams, isOptional: l.is_optional })),
    new Map(prices.map((p) => [p.ingredientId, p.perGram])),
  ).map((m) => {
    const p = priceById.get(m.ingredientId);
    const i = ingredients.find((l) => l.ingredient_id === m.ingredientId)!.ingredient;
    return {
      ...m,
      draft: {
        id: p?.id,
        ingredientId: m.ingredientId,
        name: m.name,
        info: { density_g_per_ml: i.density_g_per_ml, piece_weight_g: i.piece_weight_g },
        price: p ? p.price.toFixed(2).replace(".", ",") : "",
        amount: p ? String(p.packageAmount).replace(".", ",") : "",
        unit: p?.packageUnit ?? defaultPriceUnit(i.food_group, i.density_g_per_ml),
        store: p?.store ?? "",
      },
    };
  });
  const versionNutrition = await getIngredientNutrition([
    ...new Set(versions.flatMap((v) => v.snapshot.ingredients.map((i) => i.ingredient_id))),
  ]);
  const prep = formatMinutes(recipe.prep_minutes);
  const cook = formatMinutes(recipe.cook_minutes);
  const total = formatMinutes((recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0));
  // Optionale Zutaten zählen ohnehin nicht in den Nährwerten
  const missingGrams = ingredients.filter((l) => !l.is_optional && l.amount != null && l.grams == null);
  // Beilagen: gleichnamige eigene Rezepte verlinken
  const sideDishes = recipe.side_dishes.length
    ? linkSideDishes(recipe.side_dishes, await getOwnRecipeTitles(user.id), recipe.id).map((s) => ({
        name: s.name,
        href: s.recipeId ? `/rezepte/${s.recipeId}` : null,
      }))
    : [];
  // Direkt nach „In mein Rezeptbuch übernehmen“ (Weiterleitung mit ?uebernommen=1)
  const justForked = detail.isOwner && query.uebernommen === "1" && recipe.forked_from_id != null;
  const back = !detail.isOwner
    ? { href: isCocktail ? "/entdecken/bar" : "/entdecken", label: "Entdecken" }
    : isCocktail
      ? { href: "/rezepte/bar", label: "Alle Cocktails" }
      : { href: "/rezepte", label: "Alle Rezepte" };

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
          {kicker ? <p className="text-sm font-medium tracking-wide text-primary uppercase">{kicker}</p> : null}
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
              {recipe.servings} {servingsLabel(recipe.servings, recipe.recipe_type)}
            </li>
            {cocktail?.glass ? (
              <li className="flex items-center gap-1.5">
                <GlassWater className="size-4" aria-hidden />
                {GLASS_LABELS[cocktail.glass]}
              </li>
            ) : null}
            {cocktail?.ice ? (
              <li className="flex items-center gap-1.5">
                <Snowflake className="size-4" aria-hidden />
                Eis: {cocktail.ice}
              </li>
            ) : null}
            {cocktail?.garnish ? (
              <li className="flex items-center gap-1.5">
                <Sparkles className="size-4" aria-hidden />
                Garnitur: {cocktail.garnish}
              </li>
            ) : null}
            {total ? (
              <li className="flex items-center gap-1.5">
                <Clock className="size-4" aria-hidden />
                {total}
                {prep && cook ? ` (${prep} Vorbereitung, ${cook} Kochen)` : ""}
              </li>
            ) : null}
          </ul>

          <RecipeTags
            autoTags={isCocktail ? [] : autoTagsFor({ is_meal_prep: recipe.is_meal_prep, nutrition })}
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
        kind={recipe.recipe_type}
        cocktail={
          isCocktail && alcohol
            ? {
                abvPercent: alcohol.abv_percent ?? 0,
                alcoholGrams: alcohol.alcohol_g_per_drink ?? 0,
                volumeMl: alcohol.drink_volume_ml ?? 0,
                dilutionNote: dilutionNote(cocktail?.method ?? null, alcohol.dilution ?? 0),
              }
            : null
        }
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
          optional: l.is_optional,
        }))}
        sideDishes={sideDishes}
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

      <RecipeCost cost={cost} missingPrices={missingPrices} unit={isCocktail ? "Drink" : "Portion"} />

      <CookLogSection recipeId={recipe.id} logs={logs} today={todayInBerlin()} servings={recipe.servings} kind={recipe.recipe_type} />

      {detail.isOwner ? (
        <VersionHistory
          recipeId={recipe.id}
          currentVersion={recipe.current_version}
          versions={versions.map((v) => ({ ...v, macros: snapshotMacros(v.snapshot, versionNutrition) }))}
        />
      ) : null}

      {detail.isOwner ? (
        <PublishToggle recipeId={recipe.id} isPublic={recipe.is_public} displayName={user.displayName} />
      ) : null}

      {detail.isOwner ? (
        <ShareLink recipeId={recipe.id} title={recipe.title} initialToken={recipe.share_token} siteOrigin={await getSiteUrl()} />
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
