import Link from "next/link";
import { ArrowLeft, CircleCheck, GitFork } from "lucide-react";
import { authorName } from "@/lib/domain/community";
import { FavoriteButton } from "./favorite-button";
import { PublishToggle } from "./publish-toggle";
import { RecipeMenu, roundIconClass } from "./recipe-actions";
import { RecipePhoto } from "./recipe-photo";
import { RecipeTags } from "./recipe-tags";

export type RecipeFact = { label: string; value: string; sub?: string | null };

/**
 * Kopf der Rezeptseite: oben Zurück, Herz und Menü, darunter Foto, Kategorie-Zeile und Titel, bei eigenen Rezepten
 * gleich der Schalter Privat | Öffentlich, dann drei Kacheln (Küche: Zeit, Portionen, Kosten; Bar: Glas, Eis, Stärke).
 */
export function RecipeHero({
  recipe,
  back,
  kicker,
  facts,
  isOwner,
  isFavorite,
  author,
  forkedFrom,
  justForked = false,
}: {
  recipe: { id: string; title: string; image_url: string | null; is_public: boolean; description: string | null; tags: string[]; cocktail: boolean };
  back: { href: string; label: string };
  /** z. B. „Fleischgericht · High Protein“ bzw. „Gin · geshaked“ */
  kicker: string | null;
  facts: RecipeFact[];
  isOwner: boolean;
  isFavorite: boolean;
  /** Anzeigename bei fremden Rezepten */
  author: string | null;
  forkedFrom: { id: string; title: string; authorName: string } | null;
  justForked?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={back.href}
          className="inline-flex h-11 items-center gap-1.5 rounded-full border bg-card px-4 text-sm font-medium transition hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
        <div className="flex gap-2">
          <FavoriteButton recipeId={recipe.id} isFavorite={isFavorite} className={roundIconClass} />
          {isOwner ? <RecipeMenu recipeId={recipe.id} title={recipe.title} /> : null}
        </div>
      </div>

      {justForked ? (
        <p role="status" className="flex items-start gap-2 rounded-2xl border border-sage/40 bg-sage/10 px-4 py-3 text-sm">
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-sage" aria-hidden />
          In dein Rezeptbuch übernommen. Das ist jetzt deine eigene, private Kopie: Du kannst sie frei bearbeiten.
        </p>
      ) : null}

      <RecipePhoto recipeId={recipe.id} imagePath={recipe.image_url} title={recipe.title} isOwner={isOwner} cocktail={recipe.cocktail} />

      <header className="space-y-3">
        <div className="space-y-1">
          {kicker ? <p className="font-sans text-xs font-semibold tracking-wider text-primary uppercase">{kicker}</p> : null}
          <h1 className="text-3xl font-semibold text-balance md:text-4xl">{recipe.title}</h1>
        </div>
        {!isOwner ? <p className="text-sm text-muted-foreground">von {authorName(author)}</p> : null}
        {isOwner && forkedFrom ? (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <GitFork className="size-4" aria-hidden />
            <span>
              Übernommen von {forkedFrom.authorName}:{" "}
              <Link href={`/rezepte/${forkedFrom.id}`} className="text-primary underline-offset-4 hover:underline">
                {forkedFrom.title}
              </Link>
            </span>
          </p>
        ) : null}

        {isOwner ? <PublishToggle recipeId={recipe.id} isPublic={recipe.is_public} /> : null}

        <dl className="grid grid-cols-3 gap-2">
          {facts.map((f) => (
            <div key={f.label} className="min-w-0 rounded-2xl border bg-card px-3 py-2.5">
              <dt className="text-xs text-muted-foreground">{f.label}</dt>
              <dd className="truncate font-semibold tabular-nums">{f.value}</dd>
              {f.sub ? <dd className="truncate text-xs text-muted-foreground">{f.sub}</dd> : null}
            </div>
          ))}
        </dl>

        {recipe.description ? <p className="max-w-prose text-muted-foreground">{recipe.description}</p> : null}
        <RecipeTags autoTags={[]} tags={recipe.tags} />
      </header>
    </div>
  );
}
