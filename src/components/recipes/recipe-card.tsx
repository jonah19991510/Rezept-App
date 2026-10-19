import Link from "next/link";
import { BookCheck, Clock, Globe, Heart } from "lucide-react";
import { authorLabel } from "@/lib/domain/community";
import { autoTagsFor, totalMinutes, type RecipeListItem } from "@/lib/domain/recipe-filter";
import { formatNumber } from "@/lib/format";
import { formatMinutes } from "@/lib/format-quantity";
import { CATEGORY_LABELS } from "@/lib/labels";
import { MacroDot } from "./macro-dot";
import { RecipeTags } from "./recipe-tags";

export function RecipeCard({ recipe }: { recipe: RecipeListItem }) {
  const minutes = formatMinutes(totalMinutes(recipe));
  const n = recipe.nutrition;

  return (
    <Link
      href={`/rezepte/${recipe.id}`}
      className="group flex h-full flex-col gap-3 rounded-3xl border bg-card p-4 shadow-sm shadow-foreground/5 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          {recipe.category ? (
            <p className="text-xs font-medium tracking-wide text-primary uppercase">{CATEGORY_LABELS[recipe.category]}</p>
          ) : null}
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

      {n && n.kcal_per_serving != null ? (
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

      <RecipeTags autoTags={autoTagsFor(recipe)} tags={recipe.tags.slice(0, 3)} />

      {minutes || recipe.copied ? (
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {minutes ? (
            <p className="flex items-center gap-1.5">
              <Clock className="size-4" aria-hidden />
              {minutes}
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
