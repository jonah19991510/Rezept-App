import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText, Link2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ImportFlow } from "@/components/recipes/import/import-flow";
import { MarkdownImportFlow } from "@/components/recipes/import/markdown-import-flow";
import { requireUser } from "@/lib/auth";
import { collectTags } from "@/lib/domain/recipe-filter";
import { getNutritionThresholds } from "@/lib/server/app-config";
import { getOwnRecipeList } from "@/lib/server/recipes";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Rezepte importieren" };

const TABS = [
  { id: "link", label: "Per Link", icon: Link2, href: "/rezepte/import" },
  { id: "markdown", label: "Aus Markdown", icon: FileText, href: "/rezepte/import?quelle=markdown" },
] as const;

export default async function ImportPage({ searchParams }: PageProps<"/rezepte/import">) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const source = params.quelle === "markdown" ? "markdown" : "link";
  const [thresholds, list] = await Promise.all([getNutritionThresholds(), getOwnRecipeList(user.id)]);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/einstellungen#daten"
        className="mb-2 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Einstellungen
      </Link>
      <PageHeader
        title="Rezepte importieren"
        description={
          source === "markdown"
            ? "Rezepte aus einer Markdown-Datei oder einem Notion-Export übernehmen, prüfen und speichern."
            : "Rezept von einer Webseite übernehmen, prüfen und speichern."
        }
      />
      <nav aria-label="Importquelle" className="mb-5 inline-flex rounded-2xl border bg-card p-1">
        {TABS.map((tab) => {
          const active = tab.id === source;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <tab.icon className="size-4" aria-hidden />
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {source === "markdown" ? (
        <MarkdownImportFlow
          thresholds={thresholds}
          tagSuggestions={collectTags(list)}
          existingTitles={list.map((r) => r.title)}
        />
      ) : (
        <ImportFlow thresholds={thresholds} tagSuggestions={collectTags(list)} />
      )}
    </div>
  );
}
