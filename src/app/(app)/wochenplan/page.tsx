import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Wochenplan" };

export default function MealPlanPage() {
  return (
    <>
      <PageHeader title="Wochenplan" description="Plane Frühstück, Mittag, Abend und Snacks für die Woche." />
      <EmptyState icon={CalendarDays} title="Noch nichts geplant">
        Hier planst du bald deine Woche und siehst, wie nah du deinen Tageszielen kommst.
      </EmptyState>
    </>
  );
}
