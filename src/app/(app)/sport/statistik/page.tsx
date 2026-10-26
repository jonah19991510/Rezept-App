import type { Metadata } from "next";
import { ChartLine } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SportStatsDashboard } from "@/components/sport/stats/sport-stats-dashboard";
import { requireUser } from "@/lib/auth";
import { todayInBerlin } from "@/lib/domain/week";
import { getWorkoutStatsData } from "@/lib/server/workouts";

export const metadata: Metadata = { title: "Statistik" };

/** Sport-Statistik (Phase S3): alles aus den beendeten Trainings. */
export default async function SportStatsPage() {
  const user = await requireUser();
  const workouts = await getWorkoutStatsData(user.id);

  return (
    <>
      <PageHeader title="Statistik" description="Dein Fortschritt aus allen Trainings." />
      {workouts.length === 0 ? (
        <EmptyState icon={ChartLine} title="Noch keine Daten">
          Sobald du dein erstes Training beendet hast, siehst du hier Gewichte, Bestwerte, Volumen und mehr.
        </EmptyState>
      ) : (
        <SportStatsDashboard workouts={workouts} today={todayInBerlin()} />
      )}
    </>
  );
}
