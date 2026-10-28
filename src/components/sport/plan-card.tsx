import Link from "next/link";
import { Globe } from "lucide-react";
import { PlanMenu } from "@/components/sport/plan-menu";
import { StartTraining } from "@/components/sport/start-training";
import { planSummary } from "@/lib/domain/training-plan";
import type { PlanListItem } from "@/lib/server/sport";
import { cn } from "@/lib/utils";

type NextDay = PlanListItem["days"][number];

/**
 * Plankarte: Kreis mit der Zahl der Tage, Titel, Umfang, Tage als Chips. Der aktuelle Plan (zuletzt trainiert) ist
 * hervorgehoben, sein nächster Tag markiert und darunter direkt startbar.
 */
export function PlanCard({ plan, next }: { plan: PlanListItem; next?: NextDay | null }) {
  const featured = next !== undefined;
  return (
    <li className={cn("relative rounded-3xl transition-colors", featured ? "bg-sport-soft" : "border bg-card hover:bg-muted/60 dark:border-transparent")}>
      <div className="flex items-start gap-3 p-4 pr-2 md:p-5 md:pr-3">
        <span
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-full text-lg font-semibold tabular-nums",
            featured ? "bg-sport text-sport-foreground" : "bg-sport-soft text-sport",
          )}
          aria-hidden
        >
          {plan.days.length}
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="flex items-center gap-2 text-xl leading-tight font-semibold">
            {/* Der Titel-Link deckt die ganze Karte ab, Menü und Start-Knopf liegen darüber */}
            <Link href={`/sport/plaene/${plan.id}`} className="min-w-0 wrap-anywhere after:absolute after:inset-0 after:rounded-3xl focus-visible:outline-none">
              {plan.title}
            </Link>
            {plan.isPublic ? (
              <Globe className="size-4 shrink-0 text-muted-foreground" aria-label="Öffentlich" role="img" />
            ) : null}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{planSummary(plan.days.map((d) => ({ exercises: Array(d.exerciseCount) })))}</p>
          {plan.days.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Trainingstage">
              {plan.days.map((d) => (
                <li
                  key={d.id}
                  className={cn(
                    "max-w-full truncate rounded-full px-3 py-1 text-sm font-medium",
                    !featured
                      ? "bg-sport-soft text-sport"
                      : d.id === next?.id
                        ? "bg-sport text-sport-foreground"
                        : "bg-background/60 text-foreground",
                  )}
                >
                  {d.name}
                  {d.focus ? <span className="opacity-75"> · {d.focus}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="relative z-10">
          <PlanMenu planId={plan.id} title={plan.title} archived={plan.isArchived} />
        </div>
      </div>
      {featured && next ? (
        <div className="relative z-10 mx-4 mb-4 flex items-center gap-3 rounded-full bg-background/60 py-1.5 pr-1.5 pl-4 md:mx-5 md:mb-5">
          <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            Als Nächstes:{" "}
            <span className="font-semibold text-foreground">
              {next.name}
              {next.focus ? ` · ${next.focus}` : ""}
            </span>
          </p>
          <StartTraining
            planId={plan.id}
            days={[next]}
            nextDayId={next.id}
            iconOnly
            label={`${next.name} starten`}
            className="bg-sport text-sport-foreground hover:bg-sport/90"
          />
        </div>
      ) : null}
    </li>
  );
}
