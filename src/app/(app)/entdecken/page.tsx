import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Entdecken" };

export default function DiscoverPage() {
  return (
    <>
      <PageHeader title="Entdecken" description="Rezepte, die andere aus der Runde veröffentlicht haben." />
      <EmptyState icon={Compass} title="Hier gibt es bald etwas zu entdecken">
        Veröffentlichte Rezepte erscheinen hier mit dem Anzeigenamen der Person, die sie geteilt hat.
      </EmptyState>
    </>
  );
}
