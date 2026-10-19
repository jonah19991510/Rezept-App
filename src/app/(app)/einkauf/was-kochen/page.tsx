import type { Metadata } from "next";
import Link from "next/link";
import { Refrigerator } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { CookOptions } from "@/components/shopping/cook-options";
import { ShoppingTabs } from "@/components/shopping/shopping-tabs";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { cookability, expiryStatus } from "@/lib/domain/pantry";
import { todayInBerlin } from "@/lib/domain/week";
import { getPantry } from "@/lib/server/pantry";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Was kann ich kochen?" };

export default async function WhatToCookPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [pantry, recipes] = await Promise.all([
    getPantry(user.id),
    supabase
      .from("recipes")
      .select(
        "id, title, recipe_ingredients!recipe_ingredients_recipe_id_fkey(ingredient_id, ingredients!recipe_ingredients_ingredient_id_fkey(name, is_staple))",
      )
      .eq("owner_id", user.id)
      .eq("recipe_type", "dish"),
  ]);
  if (recipes.error) throw new Error(`Rezepte konnten nicht geladen werden (${recipes.error.code})`);

  const today = todayInBerlin();
  const pantryIds = new Set(pantry.map((p) => p.ingredientId));
  const expiringIds = new Set(
    pantry.filter((p) => ["soon", "expired"].includes(expiryStatus(p.expiresOn, today) ?? "")).map((p) => p.ingredientId),
  );
  const options = cookability(
    recipes.data.map((r) => ({
      id: r.id,
      title: r.title,
      lines: r.recipe_ingredients.map((l) => ({ ingredientId: l.ingredient_id, name: l.ingredients.name, isStaple: l.ingredients.is_staple })),
    })),
    pantryIds,
    expiringIds,
  );

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Einkauf" description="Was kann ich mit meinem Vorrat kochen?" />
      <ShoppingTabs active="/einkauf/was-kochen" />
      {pantry.length === 0 ? (
        <EmptyState
          icon={Refrigerator}
          title="Erst den Vorrat füllen"
          action={
            <Link href="/einkauf/vorrat" className={buttonVariants()}>
              Zum Vorrat
            </Link>
          }
        >
          Trag ein, was du zu Hause hast. Dann siehst du hier, welche deiner Rezepte du sofort kochen kannst und was
          jeweils noch fehlt. Grundzutaten wie Salz, Pfeffer und Öl zählen nicht mit.
        </EmptyState>
      ) : (
        <CookOptions options={options} />
      )}
    </div>
  );
}
