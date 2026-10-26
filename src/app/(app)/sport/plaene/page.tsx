import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, ClipboardList, Globe } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { TagLabel } from "@/components/layout/list-blocks";
import { PageHeader } from "@/components/layout/page-header";
import { NewRecipeFab } from "@/components/recipes/new-recipe-fab";
import { ActiveWorkoutBanner } from "@/components/sport/active-workout-banner";
import { PlanMenu } from "@/components/sport/plan-menu";
import { SportTabs } from "@/components/sport/sport-tabs";
import { StartTraining } from "@/components/sport/start-training";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { planSummary } from "@/lib/domain/training-plan";
import { getTrainingPlans, type PlanListItem } from "@/lib/server/sport";
import { getActiveWorkout } from "@/lib/server/workouts";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Trainingspläne" };

function PlanCard({ plan }: { plan: PlanListItem }) {
  return (
    <li className="relative rounded-3xl border bg-card transition-colors hover:border-primary/40">
      <div className="flex items-start gap-2 p-4 pr-2 md:p-5 md:pr-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl leading-tight font-semibold wrap-anywhere">
            {/* Der Titel-Link deckt die ganze Karte ab, das Menü liegt darüber */}
            <Link href={`/sport/plaene/${plan.id}`} className="after:absolute after:inset-0 after:rounded-3xl focus-visible:outline-none">
              {plan.title}
            </Link>
          </h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            {planSummary(plan.days.map((d) => ({ exercises: Array(d.exerciseCount) })))}
            {plan.isPublic ? (
              <TagLabel icon={Globe}>Öffentlich</TagLabel>
            ) : null}
          </p>
        </div>
        <div className="relative z-10">
          <PlanMenu planId={plan.id} title={plan.title} archived={plan.isArchived} />
        </div>
      </div>
      {plan.days.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5 px-4 pb-4 md:px-5 md:pb-5" aria-label="Trainingstage">
          {plan.days.map((d) => (
            <li key={d.id} className="max-w-full truncate rounded-full bg-sport-soft px-3 py-1 text-sm text-sport">
              {d.name}
              {d.focus ? <span className="opacity-75"> · {d.focus}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default async function PlansPage() {
  const user = await requireUser();
  const [plans, active] = await Promise.all([getTrainingPlans(user.id), getActiveWorkout(user.id)]);
  const current = plans.filter((p) => !p.isArchived);
  const archived = plans.filter((p) => p.isArchived);

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
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {current.map((p) => (
                <PlanCard key={p.id} plan={p} />
              ))}
            </ul>
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
              <ul className="mt-2 grid grid-cols-1 gap-3 opacity-80 md:grid-cols-2">
                {archived.map((p) => (
                  <PlanCard key={p.id} plan={p} />
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      )}

      <NewRecipeFab href="/sport/plaene/neu" label="Neuer Plan" />
    </div>
  );
}
