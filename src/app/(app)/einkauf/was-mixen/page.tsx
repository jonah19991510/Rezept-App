import type { Metadata } from "next";
import Link from "next/link";
import { GlassWater, Wine } from "lucide-react";
import { KitchenBarSwitch } from "@/components/bar/kitchen-bar-switch";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { CookOptions } from "@/components/shopping/cook-options";
import { ShoppingTabs } from "@/components/shopping/shopping-tabs";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { bottleHints, type MixRecipe } from "@/lib/domain/cocktail";
import { cookability } from "@/lib/domain/pantry";
import { getPantry } from "@/lib/server/pantry";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Was kann ich mixen?" };

/**
 * Phase 15: „Was kann ich mixen?“ wie „Was kann ich kochen?“, nur für Cocktails. Abgeglichen wird der ganze
 * Vorrat (Limetten oder Minze liegen oft in der Küche). Dazu die eine Flasche, die die meisten neuen Cocktails freischaltet.
 */
export default async function WhatToMixPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [pantry, recipes] = await Promise.all([
    getPantry(user.id),
    supabase
      .from("recipes")
      .select(
        "id, title, recipe_ingredients!recipe_ingredients_recipe_id_fkey(ingredient_id, is_optional, ingredients!recipe_ingredients_ingredient_id_fkey(name, is_staple, food_group))",
      )
      .eq("owner_id", user.id)
      .eq("recipe_type", "cocktail"),
  ]);
  if (recipes.error) throw new Error(`Cocktails konnten nicht geladen werden (${recipes.error.code})`);

  const pantryIds = new Set(pantry.map((p) => p.ingredientId));
  const mixRecipes: MixRecipe[] = recipes.data.map((r) => ({
    id: r.id,
    title: r.title,
    // Optionale Zutaten fehlen nie
    lines: r.recipe_ingredients.filter((l) => !l.is_optional).map((l) => ({
      ingredientId: l.ingredient_id,
      name: l.ingredients.name,
      isStaple: l.ingredients.is_staple,
      foodGroup: l.ingredients.food_group,
    })),
  }));
  const options = cookability(mixRecipes, pantryIds, new Set());
  const hints = bottleHints(mixRecipes, pantryIds);
  const [best, ...others] = hints;
  const barCount = pantry.filter((p) => p.location === "bar").length;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Einkauf" description="Was kann ich mit meiner Bar mixen?" />
      <ShoppingTabs active="kochen" bar />
      <KitchenBarSwitch active="bar" kitchenHref="/einkauf/was-kochen" barHref="/einkauf/was-mixen" />
      {recipes.data.length === 0 ? (
        <EmptyState
          icon={GlassWater}
          title="Noch keine Cocktails"
          action={
            <Link href="/rezepte/neu?typ=cocktail" className={buttonVariants()}>
              Ersten Cocktail anlegen
            </Link>
          }
        >
          Leg Cocktails in der Bar an. Dann siehst du hier, welche du mit deinem Bar-Bestand sofort mixen kannst.
        </EmptyState>
      ) : barCount === 0 ? (
        <EmptyState
          icon={Wine}
          title="Erst die Bar füllen"
          action={
            <Link href="/einkauf/vorrat?bereich=bar" className={buttonVariants()}>
              Zum Bar-Bestand
            </Link>
          }
        >
          Trag ein, welche Spirituosen, Liköre, Sirupe und Säfte du zu Hause hast. Dann siehst du hier, welche Cocktails du
          sofort mixen kannst und welche Flasche dir am meisten neue Drinks bringt.
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {best ? (
            <section aria-labelledby="flasche" className="space-y-2 rounded-3xl border border-primary/40 bg-primary/10 p-4 md:p-5">
              <h2 id="flasche" className="flex items-center gap-2 text-lg font-semibold">
                <Wine className="size-5 text-primary" aria-hidden />
                Die eine Flasche: {best.name}
              </h2>
              <p className="text-sm">
                Damit kannst du {best.unlocks.length === 1 ? "einen neuen Cocktail" : `${best.unlocks.length} neue Cocktails`}{" "}
                mixen: {best.unlocks.join(", ")}.
              </p>
              {others.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Danach:{" "}
                  {others
                    .slice(0, 3)
                    .map((h) => `${h.name} (${h.unlocks.length})`)
                    .join(", ")}
                </p>
              ) : null}
            </section>
          ) : null}
          <CookOptions options={options} kind="cocktail" />
        </div>
      )}
    </div>
  );
}
