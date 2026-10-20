import type { Metadata } from "next";
import Link from "next/link";
import { ChartPie } from "lucide-react";
import { KitchenBarSwitch } from "@/components/bar/kitchen-bar-switch";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { StatsDashboard } from "@/components/stats/stats-dashboard";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getStatsData } from "@/lib/server/stats";

export const metadata: Metadata = { title: "Statistik" };

export default async function StatsPage() {
  const user = await requireUser();
  const data = await getStatsData(user.id);

  return (
    <>
      <KitchenBarSwitch active="kitchen" kitchenHref="/statistik" barHref="/statistik/bar" />
      <PageHeader title="Statistik" description="Was in deinem Rezeptbuch und auf deinem Teller steckt." />
      {data.recipes.length === 0 ? (
        <EmptyState
          icon={ChartPie}
          title="Noch keine Daten"
          action={
            <Link href="/rezepte/neu" className={buttonVariants()}>
              Erstes Rezept anlegen
            </Link>
          }
        >
          Mit den ersten Rezepten und Wochenplänen füllen sich hier die Diagramme.
        </EmptyState>
      ) : (
        <StatsDashboard {...data} />
      )}
    </>
  );
}
