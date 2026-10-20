import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock, ExternalLink, GlassWater, Snowflake, Sparkles, Users } from "lucide-react";
import { BarMood } from "@/components/bar/bar-mood";
import { Brand } from "@/components/layout/brand";
import { RecipeTags } from "@/components/recipes/recipe-tags";
import { ScaledRecipeContent } from "@/components/recipes/scaled-recipe-content";
import { SharedActions } from "@/components/recipes/shared-actions";
import { getCurrentUser } from "@/lib/auth";
import { dilutionNote } from "@/lib/domain/cocktail";
import { missingGramNames, shareDescription, sharedMacros } from "@/lib/domain/shared-recipe";
import { formatDate } from "@/lib/format";
import { formatMinutes } from "@/lib/format-quantity";
import { CATEGORY_LABELS, GLASS_LABELS, METHOD_LABELS, servingsLabel } from "@/lib/labels";
import { getSharedRecipe } from "@/lib/server/shared-recipes";
import { createClient } from "@/lib/supabase/server";

// Geteilte Rezeptkarte (Phase 14): ohne Login lesbar, solange der Link gilt. noindex kommt wie überall
// aus dem Root-Layout, dem Header X-Robots-Tag und robots.txt; die Link-Vorschau (opengraph-image) geht trotzdem.

export async function generateMetadata({ params }: PageProps<"/r/[token]">): Promise<Metadata> {
  const { token } = await params;
  const recipe = await getSharedRecipe(token);
  if (!recipe) return { title: "Link ungültig" };
  const description = shareDescription(recipe);
  return {
    title: recipe.title,
    description,
    openGraph: { title: recipe.title, description, type: "article", siteName: "Rezeptbuch", locale: "de_DE" },
    twitter: { card: "summary_large_image", title: recipe.title, description },
  };
}

/** Wer schaut? Gast, Owner (dann Link aufs eigene Rezept) oder anderer angemeldeter Nutzer. */
async function viewerFor(token: string) {
  const user = await getCurrentUser();
  if (!user) return { kind: "guest" } as const;
  // RLS: eigene (und öffentliche) Rezepte sind lesbar; so erkennen wir das eigene Rezept zum Token
  const supabase = await createClient();
  const { data } = await supabase.from("recipes").select("id, owner_id").eq("share_token", token).maybeSingle();
  if (data && data.owner_id === user.id) return { kind: "owner", ownRecipeId: data.id } as const;
  return { kind: "user" } as const;
}

export default async function SharedRecipePage({ params }: PageProps<"/r/[token]">) {
  const { token } = await params;
  const recipe = await getSharedRecipe(token);
  if (!recipe) notFound();
  const viewer = await viewerFor(token);

  const macros = sharedMacros(recipe);
  const prep = formatMinutes(recipe.prep_minutes);
  const cook = formatMinutes(recipe.cook_minutes);
  const total = formatMinutes((recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0));
  // Phase 15: Cocktails mit Bar-Stimmung, Glas/Methode/Eis/Garnitur und Alkoholgehalt pro Drink
  const isCocktail = recipe.recipe_type === "cocktail";
  const cocktail = recipe.cocktail;
  const kicker = isCocktail
    ? ["Cocktail", cocktail?.method ? METHOD_LABELS[cocktail.method] : null].filter(Boolean).join(" · ")
    : recipe.category
      ? CATEGORY_LABELS[recipe.category]
      : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 print:max-w-none print:p-0">
      {isCocktail ? <BarMood /> : null}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Brand href="/" />
      </header>

      <article className="overflow-hidden rounded-3xl border bg-card shadow-sm print:rounded-none print:border-0 print:shadow-none">
        {recipe.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- Foto kommt aus der geschützten Route, schon verkleinert
          <img
            src={`/r/${token}/foto`}
            alt={`Foto: ${recipe.title}`}
            className="aspect-[16/10] w-full object-cover print:aspect-[16/7]"
          />
        ) : null}

        <div className="space-y-8 p-5 md:p-8 print:space-y-5 print:p-0 print:pt-4">
          <header className="space-y-3">
            {kicker ? <p className="text-sm font-medium tracking-wide text-primary uppercase">{kicker}</p> : null}
            <h1 className="text-3xl font-semibold text-balance md:text-4xl">{recipe.title}</h1>
            {recipe.author ? <p className="text-sm text-muted-foreground">von {recipe.author}</p> : null}
            {recipe.description ? <p className="max-w-prose whitespace-pre-line text-muted-foreground">{recipe.description}</p> : null}
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
            <RecipeTags autoTags={recipe.is_meal_prep && !isCocktail ? ["meal_prep"] : []} tags={recipe.tags} />
          </header>

          <SharedActions token={token} viewer={viewer} />

          <ScaledRecipeContent
            recipeId=""
            showCookButton={false}
            servings={recipe.servings}
            kind={recipe.recipe_type}
            cocktail={
              isCocktail && recipe.alcohol
                ? {
                    abvPercent: recipe.alcohol.abv_percent,
                    alcoholGrams: recipe.alcohol.alcohol_g,
                    volumeMl: recipe.alcohol.volume_ml,
                    dilutionNote: dilutionNote(cocktail?.method ?? null, recipe.alcohol.dilution),
                  }
                : null
            }
            perServing={macros}
            lines={recipe.ingredients.map((l) => ({
              id: String(l.position),
              amount: l.amount,
              unit: l.unit,
              grams: l.grams,
              name: l.name,
              note: l.note,
            }))}
            missingGramsNames={missingGramNames(recipe)}
            steps={
              <section aria-labelledby="zubereitung" className="space-y-3">
                <h2 id="zubereitung" className="text-xl font-semibold">
                  Zubereitung
                </h2>
                {recipe.steps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine Schritte eingetragen.</p>
                ) : (
                  <ol className="space-y-4">
                    {recipe.steps.map((step, i) => (
                      <li key={step.position} className="flex gap-3 break-inside-avoid">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                          {i + 1}
                        </span>
                        <p className="pt-1 leading-relaxed whitespace-pre-line">{step.text}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            }
          />

          <footer className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-xs text-muted-foreground">
            <span>Geteilt aus dem Rezeptbuch · Stand {formatDate(recipe.updated_at)}</span>
            {recipe.source_url ? <SourceLink url={recipe.source_url} /> : null}
          </footer>
        </div>
      </article>
    </div>
  );
}

function SourceLink({ url }: { url: string }) {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
    >
      Quelle: {host}
      <ExternalLink className="size-3" aria-hidden />
    </a>
  );
}
