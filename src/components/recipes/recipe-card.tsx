import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookCheck, ChefHat, Clock, Globe, Martini } from "lucide-react";
import { authorLabel } from "@/lib/domain/community";
import { photoUrl } from "@/lib/domain/photo";
import { autoTagsFor, totalMinutes, type RecipeListItem, type RecipeView } from "@/lib/domain/recipe-filter";
import { formatEuro, formatNumber } from "@/lib/format";
import { formatMinutes } from "@/lib/format-quantity";
import { CATEGORY_LABELS, GLASS_LABELS, METHOD_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { FavoriteButton } from "./favorite-button";
import { MacroDot } from "./macro-dot";
import { RecipeTags } from "./recipe-tags";
import { StarValue } from "./star-rating";

/**
 * Rezeptkarte im Raster (nebeneinander, Foto oben) oder in der Liste (untereinander, Foto links, mehr Angaben).
 * Der Titel-Link deckt die ganze Karte ab; das Herz liegt darüber und setzt Favoriten, ohne das Rezept zu öffnen.
 */
export function RecipeCard({ recipe, view = "grid" }: { recipe: RecipeListItem; view?: RecipeView }) {
  const c = recipe.cocktail;
  const href = `/rezepte/${recipe.id}`;
  const link = (
    <Link
      href={href}
      className="after:absolute after:inset-0 after:z-0 after:content-[''] focus-visible:outline-none group-hover:text-primary"
    >
      {recipe.title}
    </Link>
  );
  const shell =
    "group relative overflow-hidden rounded-3xl border bg-card shadow-sm shadow-foreground/5 transition hover:-translate-y-0.5 hover:shadow-md has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50";
  const heart = (
    <FavoriteButton
      recipeId={recipe.id}
      isFavorite={recipe.isFavorite}
      title={recipe.title}
      variant="overlay"
      className="absolute top-2 right-2 z-10"
    />
  );

  if (view === "grid") {
    const minutes = formatMinutes(totalMinutes(recipe));
    const subtitle = c
      ? [c.glass && c.glass !== "other" ? GLASS_LABELS[c.glass] : null, c.method ? METHOD_LABELS[c.method] : null]
          .filter(Boolean)
          .join(" · ") || (c.baseSpirit ?? "alkoholfrei")
      : [recipe.category ? CATEGORY_LABELS[recipe.category] : null, minutes].filter(Boolean).join(" · ");
    const kcal = recipe.nutrition?.kcal_per_serving;
    return (
      <article className={cn(shell, "flex h-full flex-col")}>
        <Thumb recipe={recipe} className="aspect-[4/3] w-full" sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" />
        {heart}
        <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
          <h2 className="line-clamp-2 text-base leading-snug font-semibold wrap-anywhere sm:text-lg">{link}</h2>
          {recipe.author ? <p className="truncate text-xs text-muted-foreground">{authorLabel(recipe.author)}</p> : null}
          {subtitle ? <p className="truncate text-sm text-muted-foreground">{subtitle}</p> : null}
          <div className="mt-auto flex flex-wrap items-center gap-x-1.5 gap-y-1 pt-1.5 text-xs tabular-nums sm:gap-x-2 sm:text-sm">
            {c ? (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 font-semibold text-primary">
                ≈ {formatNumber(c.abvPercent ?? 0, 0)} % vol
              </span>
            ) : kcal != null ? (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 font-semibold text-primary">
                {formatNumber(Math.round(kcal), 0)} kcal
              </span>
            ) : null}
            {c ? (
              kcal != null ? <span className="text-muted-foreground">{formatNumber(Math.round(kcal), 0)} kcal</span> : null
            ) : recipe.nutrition?.protein_per_serving != null ? (
              <span className="text-muted-foreground">{formatNumber(recipe.nutrition.protein_per_serving, 0)} g P</span>
            ) : null}
            {recipe.copied ? <BookCheck className="size-4 text-sage" aria-label="In deinem Buch" /> : null}
            {!recipe.author && recipe.isPublic ? <Globe className="size-4 text-muted-foreground" aria-label="Öffentlich" /> : null}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className={cn(shell, "flex gap-3 p-3")}>
      <Thumb recipe={recipe} className="size-20 shrink-0 rounded-2xl sm:size-24" sizes="96px" />
      <ListBody recipe={recipe} link={link} />
      {heart}
    </article>
  );
}

/** Foto oder, ohne Foto, ein Platzhalter mit Kochmütze bzw. Cocktailglas. */
function Thumb({ recipe, className, sizes }: { recipe: RecipeListItem; className: string; sizes: string }) {
  const Icon = recipe.cocktail ? Martini : ChefHat;
  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {recipe.image_url ? (
        <Image
          src={photoUrl(recipe.image_url, "klein")}
          alt=""
          fill
          unoptimized // Vorschaubild ist schon klein (800 px) und kommt aus der geschützten Route /foto
          sizes={sizes}
          className="object-cover"
        />
      ) : (
        <div className="grid size-full place-items-center">
          <Icon className="size-1/3 max-h-14 max-w-14 text-muted-foreground/50" strokeWidth={1.25} aria-hidden />
        </div>
      )}
    </div>
  );
}

function ListBody({ recipe, link }: { recipe: RecipeListItem; link: ReactNode }) {
  const minutes = formatMinutes(totalMinutes(recipe));
  const n = recipe.nutrition;
  const c = recipe.cocktail;
  // Phase 15: bei Cocktails Basisspirituose · Methode statt Kategorie
  const kicker = c
    ? [c.baseSpirit ?? "alkoholfrei", c.method ? METHOD_LABELS[c.method] : null, c.glass && c.glass !== "other" ? GLASS_LABELS[c.glass] : null]
        .filter(Boolean)
        .join(" · ")
    : recipe.category
      ? CATEGORY_LABELS[recipe.category]
      : null;
  const hasFooter = minutes || recipe.copied || recipe.avgRating != null || recipe.costPerServing != null;

  return (
    <div className="min-w-0 flex-1 space-y-1.5 pr-11">
      <div className="space-y-0.5">
        {kicker ? <p className="truncate text-xs font-medium tracking-wide text-primary uppercase">{kicker}</p> : null}
        <h2 className="flex items-start gap-1.5 text-base leading-snug font-semibold wrap-anywhere sm:text-lg">
          <span className="min-w-0">{link}</span>
          {!recipe.author && recipe.isPublic ? (
            <Globe className="mt-1 size-4 shrink-0 text-muted-foreground" aria-label="Öffentlich" />
          ) : null}
        </h2>
        {recipe.author ? <p className="text-sm text-muted-foreground">{authorLabel(recipe.author)}</p> : null}
      </div>

      {c ? (
        <dl className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
          <div className="flex items-center gap-1">
            <dt className="sr-only">Alkoholgehalt</dt>
            <dd className="font-semibold tabular-nums">{formatNumber(c.abvPercent ?? 0, 1)} % vol</dd>
          </div>
          {c.alcoholGrams != null && c.alcoholGrams > 0 ? (
            <div className="flex items-center gap-1">
              <dt className="sr-only">Alkohol pro Drink</dt>
              <dd className="tabular-nums">{formatNumber(c.alcoholGrams, 0)} g Alkohol</dd>
            </div>
          ) : null}
          {n?.kcal_per_serving != null ? (
            <div className="flex items-center gap-1">
              <dt className="sr-only">Kalorien pro Drink</dt>
              <dd className="flex items-center gap-1 tabular-nums">
                <MacroDot macro="kcal" />
                {formatNumber(Math.round(n.kcal_per_serving), 0)} kcal
              </dd>
            </div>
          ) : null}
        </dl>
      ) : n && n.kcal_per_serving != null ? (
        <dl className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
          <div className="flex items-center gap-1">
            <dt className="sr-only">Kalorien pro Portion</dt>
            <dd className="flex items-center gap-1 font-semibold">
              <MacroDot macro="kcal" />
              {formatNumber(Math.round(n.kcal_per_serving), 0)} kcal
            </dd>
          </div>
          {(
            [
              ["protein", "P", n.protein_per_serving],
              ["carbs", "KH", n.carbs_per_serving],
              ["fat", "F", n.fat_per_serving],
            ] as const
          ).map(([macro, label, value]) => (
            <div key={macro} className="flex items-center gap-1">
              <dt className="flex items-center gap-1 text-muted-foreground">
                <MacroDot macro={macro} />
                {label}
              </dt>
              <dd>{formatNumber(value ?? 0, 0)} g</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <RecipeTags autoTags={c ? [] : autoTagsFor(recipe)} tags={recipe.tags.slice(0, 3)} />

      {hasFooter ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
          {minutes ? (
            <p className="flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden />
              {minutes}
            </p>
          ) : null}
          {recipe.avgRating != null ? <StarValue value={recipe.avgRating} /> : null}
          {recipe.costPerServing != null ? (
            <p className="tabular-nums">
              {recipe.costComplete === false ? "ab " : ""}
              {formatEuro(recipe.costPerServing)}
              <span className="sr-only"> {c ? "pro Drink" : "pro Portion"}</span>
            </p>
          ) : null}
          {recipe.copied ? (
            <p className="flex items-center gap-1 text-sage">
              <BookCheck className="size-3.5" aria-hidden />
              <span className="text-foreground">In deinem Buch</span>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
