import Image from "next/image";
import Link from "next/link";
import { BookCheck, Clock, Globe, Heart, Martini } from "lucide-react";
import { authorLabel } from "@/lib/domain/community";
import { photoUrl } from "@/lib/domain/photo";
import { autoTagsFor, totalMinutes, type RecipeListItem } from "@/lib/domain/recipe-filter";
import { formatEuro, formatNumber } from "@/lib/format";
import { formatMinutes } from "@/lib/format-quantity";
import { CATEGORY_LABELS, GLASS_LABELS, METHOD_LABELS } from "@/lib/labels";
import { MacroDot } from "./macro-dot";
import { RecipeTags } from "./recipe-tags";
import { StarValue } from "./star-rating";

export function RecipeCard({ recipe }: { recipe: RecipeListItem }) {
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
    <Link
      href={`/rezepte/${recipe.id}`}
      className="group flex h-full flex-col gap-3 overflow-hidden rounded-3xl border bg-card p-4 shadow-sm shadow-foreground/5 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {recipe.image_url ? (
        <div className="relative -mx-4 -mt-4 aspect-[16/10] bg-muted">
          <Image
            src={photoUrl(recipe.image_url, "klein")}
            alt=""
            fill
            unoptimized // Vorschaubild ist schon klein (800 px) und kommt aus der geschützten Route /foto
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          {kicker ? <p className="text-xs font-medium tracking-wide text-primary uppercase">{kicker}</p> : null}
          <h2 className="text-lg leading-snug font-semibold group-hover:text-primary">{recipe.title}</h2>
          {recipe.author ? <p className="text-sm text-muted-foreground">{authorLabel(recipe.author)}</p> : null}
        </div>
        <div className="mt-1 flex shrink-0 gap-1.5">
          {/* Im eigenen Buch: Globus für veröffentlichte Rezepte (in Entdecken sind alle öffentlich) */}
          {!recipe.author && recipe.isPublic ? (
            <Globe className="size-5 text-muted-foreground" aria-label="Öffentlich" />
          ) : null}
          {recipe.isFavorite ? <Heart className="size-5 fill-primary text-primary" aria-label="Favorit" /> : null}
        </div>
      </div>

      {c ? (
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <div className="flex items-center gap-1">
            <dt className="sr-only">Alkoholgehalt</dt>
            <dd className="flex items-center gap-1 font-semibold tabular-nums">
              <Martini className="size-4 text-primary" aria-hidden />
              {formatNumber(c.abvPercent ?? 0, 1)} % vol
            </dd>
          </div>
          {c.alcoholGrams != null && c.alcoholGrams > 0 ? (
            <div className="flex items-center gap-1">
              <dt className="sr-only">Alkohol pro Drink</dt>
              <dd className="font-medium tabular-nums">{formatNumber(c.alcoholGrams, 0)} g Alkohol</dd>
            </div>
          ) : null}
          {n?.kcal_per_serving != null ? (
            <div className="flex items-center gap-1">
              <dt className="sr-only">Kalorien pro Drink</dt>
              <dd className="flex items-center gap-1 font-medium tabular-nums">
                <MacroDot macro="kcal" />
                {formatNumber(Math.round(n.kcal_per_serving), 0)} kcal
              </dd>
            </div>
          ) : null}
        </dl>
      ) : n && n.kcal_per_serving != null ? (
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <div className="flex items-center gap-1">
            <dt className="sr-only">Kalorien pro Portion</dt>
            <dd className="flex items-center gap-1 font-semibold">
              <MacroDot macro="kcal" />
              {formatNumber(Math.round(n.kcal_per_serving), 0)} kcal
            </dd>
          </div>
          <div className="flex items-center gap-1">
            <dt className="flex items-center gap-1 text-muted-foreground">
              <MacroDot macro="protein" />
              P
            </dt>
            <dd className="font-medium">{formatNumber(n.protein_per_serving ?? 0, 0)} g</dd>
          </div>
          <div className="flex items-center gap-1">
            <dt className="flex items-center gap-1 text-muted-foreground">
              <MacroDot macro="carbs" />
              KH
            </dt>
            <dd className="font-medium">{formatNumber(n.carbs_per_serving ?? 0, 0)} g</dd>
          </div>
          <div className="flex items-center gap-1">
            <dt className="flex items-center gap-1 text-muted-foreground">
              <MacroDot macro="fat" />
              F
            </dt>
            <dd className="font-medium">{formatNumber(n.fat_per_serving ?? 0, 0)} g</dd>
          </div>
        </dl>
      ) : null}

      <RecipeTags autoTags={c ? [] : autoTagsFor(recipe)} tags={recipe.tags.slice(0, 3)} />

      {hasFooter ? (
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {minutes ? (
            <p className="flex items-center gap-1.5">
              <Clock className="size-4" aria-hidden />
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
            <p className="flex items-center gap-1.5 text-sage">
              <BookCheck className="size-4" aria-hidden />
              <span className="text-foreground">In deinem Buch</span>
            </p>
          ) : null}
        </div>
      ) : null}
    </Link>
  );
}
