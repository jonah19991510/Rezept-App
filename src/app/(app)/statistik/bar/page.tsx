import type { Metadata } from "next";
import Link from "next/link";
import { Martini } from "lucide-react";
import { KitchenBarSwitch } from "@/components/bar/kitchen-bar-switch";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { BarStatsDashboard } from "@/components/stats/bar-stats-dashboard";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { barStats } from "@/lib/domain/bar-stats";
import { getCookLogs } from "@/lib/server/kitchen-log";
import { getOwnRecipeList } from "@/lib/server/recipes";

export const metadata: Metadata = { title: "Bar-Statistik" };

/** Phase 15: eigene Cocktails nach Basisspirituose, Methode und Alkoholgehalt. */
export default async function BarStatsPage() {
  const user = await requireUser();
  const [cocktails, logs] = await Promise.all([getOwnRecipeList(user.id, "cocktail"), getCookLogs(user.id)]);
  const stats = barStats(
    cocktails.map((c) => ({
      id: c.id,
      title: c.title,
      cocktail: c.cocktail ?? { method: null, glass: null, abvPercent: null, alcoholGrams: null, baseSpirit: null },
      kcal: c.nutrition?.kcal_per_serving ?? null,
      timesMixed: logs.filter((l) => l.recipeId === c.id).length,
    })),
  );

  return (
    <>
      <KitchenBarSwitch active="bar" kitchenHref="/statistik" barHref="/statistik/bar" />
      <PageHeader title="Statistik" description="Was in deiner Bar steckt." />
      {stats.total === 0 ? (
        <EmptyState
          icon={Martini}
          title="Noch keine Cocktails"
          action={
            <Link href="/rezepte/neu?typ=cocktail" className={buttonVariants()}>
              Ersten Cocktail anlegen
            </Link>
          }
        >
          Mit den ersten Cocktails siehst du hier, welche Spirituosen, Methoden und Stärken deine Bar prägen.
        </EmptyState>
      ) : (
        <BarStatsDashboard stats={stats} />
      )}
    </>
  );
}
