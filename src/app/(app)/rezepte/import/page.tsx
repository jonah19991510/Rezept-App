import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ImportFlow } from "@/components/recipes/import/import-flow";
import { requireUser } from "@/lib/auth";
import { collectTags } from "@/lib/domain/recipe-filter";
import { getNutritionThresholds } from "@/lib/server/app-config";
import { getOwnRecipeList } from "@/lib/server/recipes";

export const metadata: Metadata = { title: "Rezept importieren" };

export default async function ImportPage() {
  const user = await requireUser();
  const [thresholds, list] = await Promise.all([getNutritionThresholds(), getOwnRecipeList(user.id)]);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/rezepte"
        className="mb-2 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Alle Rezepte
      </Link>
      <PageHeader title="Rezept importieren" description="Rezept von einer Webseite übernehmen, prüfen und speichern." />
      <ImportFlow thresholds={thresholds} tagSuggestions={collectTags(list)} />
    </div>
  );
}
