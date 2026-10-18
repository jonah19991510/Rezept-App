import type { Metadata } from "next";
import { ChartPie } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Statistik" };

export default function StatsPage() {
  return (
    <>
      <PageHeader title="Statistik" description="Was in deinem Rezeptbuch und auf deinem Teller steckt." />
      <EmptyState icon={ChartPie} title="Noch keine Daten">
        Mit den ersten Rezepten und Wochenplänen füllen sich hier die Diagramme.
      </EmptyState>
    </>
  );
}
