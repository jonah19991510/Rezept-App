import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Pencil } from "lucide-react";
import { CookLogSection } from "@/components/recipes/cook-log-section";
import { ForkActions } from "@/components/recipes/recipe-actions";
import { RecipeHero, type RecipeFact } from "@/components/recipes/recipe-hero";
import { ScaledRecipeContent, sideActionClass } from "@/components/recipes/scaled-recipe-content";
import { ShareLink } from "@/components/recipes/share-link";
import { VersionHistory } from "@/components/recipes/version-history";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { baseSpirit, dilutionNote } from "@/lib/domain/cocktail";
import { defaultPriceUnit, unpricedIngredients } from "@/lib/domain/costs";
import { autoTagsFor } from "@/lib/domain/recipe-filter";
import { snapshotMacros } from "@/lib/domain/versions";
import { todayInBerlin } from "@/lib/domain/week";
import { formatEuro, formatNumber } from "@/lib/format";
import { formatMinutes } from "@/lib/format-quantity";
import { AUTO_TAG_LABELS, GLASS_LABELS, METHOD_LABELS, servingsLabel } from "@/lib/labels";
import { getCookLogs, getIngredientNutrition, getPrices, getRecipeCost, getRecipeVersions } from "@/lib/server/kitchen-log";
import { linkSideDishes } from "@/lib/domain/side-dishes";
import { getOwnRecipeTitles, getRecipeDetail } from "@/lib/server/recipes";
import { getSiteUrl } from "@/lib/site-url";
import { cn } from "@/lib/utils";

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
  const autoTags = isCocktail ? [] : autoTagsFor({ is_meal_prep: recipe.is_meal_prep, nutrition });
  const kicker = isCocktail
    ? [
        baseSpirit(ingredients.filter((l) => !l.is_optional).map((l) => ({ name: l.ingredient.name, amount: l.amount, unit: l.unit, ingredient: l.ingredient }))) ??
          "alkoholfrei",
        cocktail?.method ? METHOD_LABELS[cocktail.method] : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : [recipe.category_name, ...autoTags.map((t) => AUTO_TAG_LABELS[t])].filter(Boolean).join(" · ") ||
      null;
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
      ? { href: "/rezepte/bar", label: "Cocktails" }
      : { href: "/rezepte", label: "Rezepte" };
  // Drei Kacheln unter dem Titel: Küche Zeit/Portionen/Kosten, Bar Glas/Eis/Stärke
  const unit = servingsLabel(1, recipe.recipe_type);
  const facts: RecipeFact[] = isCocktail
    ? [
        { label: "Glas", value: cocktail?.glass ? GLASS_LABELS[cocktail.glass] : "–", sub: `${recipe.servings} ${servingsLabel(recipe.servings, "cocktail")}` },
        { label: "Eis", value: cocktail?.ice || "ohne", sub: cocktail?.garnish ? `Garnitur: ${cocktail.garnish}` : null },
        {
          label: "Stärke",
          value: alcohol?.abv_percent != null ? `≈ ${formatNumber(alcohol.abv_percent, 0)} % vol` : "–",
          sub: alcohol?.abv_percent != null ? "nach Verdünnung" : null,
        },
      ]
    : [
        // „10 Vorb. · 15 Kochen“ (ohne „Min.“, damit es in die Kachel passt)
        { label: "Zeit", value: total ?? "–", sub: prep && cook ? `${prep.replace(/ Min\.$/, "")} Vorb. · ${cook.replace(/ Min\.$/, "")} Kochen` : (prep ?? cook ?? null) },
        { label: "Portionen", value: String(recipe.servings), sub: "Grundrezept" },
        {
          label: "Kosten",
          value: cost && cost.priced > 0 ? formatEuro(cost.perServing) : "–",
          sub: cost && cost.priced > 0 ? `${cost.priced < cost.count ? "mind., " : ""}pro ${unit}` : "keine Preise",
        },
      ];

  return (
    <article className="space-y-8">
      <RecipeHero
        recipe={{
          id: recipe.id,
          title: recipe.title,
          image_url: recipe.image_url,
          is_public: recipe.is_public,
          description: recipe.description,
          tags: recipe.tags,
          cocktail: isCocktail,
        }}
        back={back}
        kicker={kicker}
        facts={facts}
        isOwner={detail.isOwner}
        isFavorite={detail.isFavorite}
        author={detail.authorName}
        forkedFrom={detail.forkedFrom}
        justForked={justForked}
      />

      <ScaledRecipeContent
        recipeId={recipe.id}
        servings={recipe.servings}
        kind={recipe.recipe_type}
        actions={
          detail.isOwner ? (
            <Link href={`/rezepte/${recipe.id}/bearbeiten`} className={cn(buttonVariants({ variant: "outline", size: "lg" }), sideActionClass)}>
              <Pencil aria-hidden />
              Bearbeiten
            </Link>
          ) : (
            <ForkActions recipeId={recipe.id} ownCopyId={detail.ownCopyId} className={cn("h-12", sideActionClass)} />
          )
        }
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
        cost={{ cost, missingPrices }}
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

      <CookLogSection recipeId={recipe.id} logs={logs} today={todayInBerlin()} servings={recipe.servings} kind={recipe.recipe_type} />

      {detail.isOwner ? (
        <VersionHistory
          recipeId={recipe.id}
          currentVersion={recipe.current_version}
          versions={versions.map((v) => ({ ...v, macros: snapshotMacros(v.snapshot, versionNutrition) }))}
        />
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
