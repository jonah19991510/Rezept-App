import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { NewRecipeFab } from "@/components/recipes/new-recipe-fab";
import { ActiveWorkoutBanner } from "@/components/sport/active-workout-banner";
import { PlanList } from "@/components/sport/plan-card";
import { SportTabs } from "@/components/sport/sport-tabs";
import { StartTraining } from "@/components/sport/start-training";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getTrainingPlans } from "@/lib/server/sport";
import { getActiveWorkout, getLastPlanDayId, getLastPlanWorkout } from "@/lib/server/workouts";
import { PLAN_KIND_LABELS, PLAN_KINDS } from "@/lib/domain/training-plan";
import { nextPlanDay } from "@/lib/domain/workout";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Trainingspläne" };

export default async function PlansPage() {
  const user = await requireUser();
  const [plans, active, last] = await Promise.all([getTrainingPlans(user.id), getActiveWorkout(user.id), getLastPlanWorkout(user.id)]);
  const current = plans.filter((p) => !p.isArchived);
  const archived = plans.filter((p) => p.isArchived);
  // Hervorgehoben: der zuletzt trainierte Plan, sonst der zuletzt geänderte
  const featured = current.find((p) => p.id === last?.planId) ?? current[0] ?? null;
  const lastDayId = !featured ? null : featured.id === last?.planId ? last.dayId : await getLastPlanDayId(user.id, featured.id);
  const nextDay = featured ? nextPlanDay(featured.days, lastDayId) : null;

  return (
    // Unten Platz lassen, damit der schwebende Knopf die letzte Karte nicht verdeckt
    <div className="pb-16 md:pb-20">
      <PageHeader title="Training" />
      <SportTabs active="plaene" />
      {active ? <ActiveWorkoutBanner workout={active} /> : null}

      {plans.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Noch kein Trainingsplan"
          action={
            <Link href="/sport/plaene/neu" className={cn(buttonVariants(), "rounded-full px-6")}>
              Ersten Plan anlegen
            </Link>
          }
        >
          Lege einen Plan mit deinen Trainingstagen an, z. B. „Push / Pull / Beine“, und wähle die Übungen aus der
          Übungsdatenbank.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {current.length > 0 ? (
            // Abschnitte nach Art des Plans; leere Abschnitte entfallen
            PLAN_KINDS.map((kind) => {
              const list = current.filter((p) => p.kind === kind);
              if (list.length === 0) return null;
              return (
                <section key={kind} aria-labelledby={`plaene-${kind}`}>
                  <h2 id={`plaene-${kind}`} className="mb-3 flex items-baseline gap-2 px-1 text-2xl leading-tight font-semibold">
                    {PLAN_KIND_LABELS[kind]}
                    <span className="font-sans text-sm font-normal tracking-normal text-muted-foreground tabular-nums">
                      {list.length === 1 ? "1 Plan" : `${list.length} Pläne`}
                    </span>
                  </h2>
                  <PlanList plans={list} featuredId={featured?.id} next={nextDay} />
                </section>
              );
            })
          ) : (
            <p className="rounded-3xl border border-dashed p-6 text-center text-muted-foreground">
              Alle Pläne sind ausgeblendet. Unten kannst du einen wieder einblenden.
            </p>
          )}

          {active ? null : (
            <div className="flex justify-center">
              <StartTraining label="Freies Training ohne Plan" variant="outline" />
            </div>
          )}

          {archived.length > 0 ? (
            <details className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-1 font-sans text-sm font-semibold tracking-wide text-muted-foreground uppercase hover:text-foreground [&::-webkit-details-marker]:hidden">
                <span>Ausgeblendet</span>
                <span className="flex items-center gap-1.5 font-medium tabular-nums normal-case">
                  {archived.length}
                  <ChevronDown className="size-4 -rotate-90 transition-transform group-open:rotate-0" aria-hidden />
                </span>
              </summary>
              <PlanList plans={archived} className="mt-2 opacity-80" />
            </details>
          ) : null}
        </div>
      )}

      <NewRecipeFab href="/sport/plaene/neu" label="Neuer Plan" />
    </div>
  );
}
