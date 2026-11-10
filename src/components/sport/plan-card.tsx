import Link from "next/link";
import { Activity, Dumbbell, Globe, Zap, type LucideIcon } from "lucide-react";
import { PlanMenu } from "@/components/sport/plan-menu";
import { StartTraining } from "@/components/sport/start-training";
import { planSummary, type PlanKind } from "@/lib/domain/training-plan";
import type { PlanListItem } from "@/lib/server/sport";
import { cn } from "@/lib/utils";

type NextDay = PlanListItem["days"][number];

const KIND_ICONS: Record<PlanKind, LucideIcon> = { strength: Dumbbell, strength_endurance: Zap, cardio: Activity };

/** Pläne als eine abgerundete Karte mit Trennlinien zwischen den Zeilen. */
export function PlanList({
  plans,
  featuredId,
  next,
  className,
}: {
  plans: PlanListItem[];
  featuredId?: string | null;
  next?: NextDay | null;
  className?: string;
}) {
  return (
    <ul className={cn("divide-y overflow-hidden rounded-3xl border bg-card dark:border-transparent", className)}>
      {plans.map((p) => (
        <PlanRow key={p.id} plan={p} next={p.id === featuredId ? next : undefined} />
      ))}
    </ul>
  );
}

/**
 * Planzeile: Symbol der Art (Hantel, Blitz bzw. Puls-Linie), Titel, Umfang, Tage als Chips, Menü. Der aktuelle Plan (zuletzt
 * trainiert) trägt „Aktiv“, sein nächster Tag ist markiert und darunter direkt startbar.
 */
function PlanRow({ plan, next }: { plan: PlanListItem; next?: NextDay | null }) {
  const featured = next !== undefined;
  const Icon = KIND_ICONS[plan.kind];
  return (
    <li className="relative transition-colors hover:bg-muted/60">
      <div className="flex items-start gap-3 p-4 pr-2 md:items-center md:px-5 md:pr-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sport-soft text-sport" aria-hidden>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1 md:flex md:items-center md:gap-4">
          <div className="min-w-0 md:w-2/5 md:shrink-0">
            <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg leading-tight font-semibold">
              {/* Der Titel-Link deckt die ganze Zeile ab, Menü und Start-Knopf liegen darüber */}
              <Link href={`/sport/plaene/${plan.id}`} className="min-w-0 wrap-anywhere after:absolute after:inset-0 focus-visible:outline-none">
                {plan.title}
              </Link>
              {plan.isPublic ? (
                <span className="flex items-center gap-1 font-sans text-xs font-normal tracking-normal text-muted-foreground">
                  <Globe className="size-3.5 shrink-0" aria-hidden />
                  Öffentlich
                </span>
              ) : null}
              {featured ? (
                <span className="rounded-full bg-sport px-2 py-0.5 font-sans text-xs font-semibold tracking-normal text-sport-foreground">
                  Aktiv
                </span>
              ) : null}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{planSummary(plan.days.map((d) => ({ exercises: Array(d.exerciseCount) })))}</p>
          </div>
          {plan.days.length > 0 ? (
            <ul className="mt-3 flex min-w-0 flex-wrap gap-1.5 md:mt-0" aria-label="Trainingstage">
              {plan.days.map((d) => (
                <li
                  key={d.id}
                  className={cn(
                    "max-w-full truncate rounded-full px-3 py-1 text-[0.8125rem] font-semibold",
                    featured && d.id === next?.id ? "bg-sport text-sport-foreground" : "bg-sport-soft text-sport",
                  )}
                >
                  {d.name}
                  {d.focus ? <span className="font-normal opacity-80"> · {d.focus}</span> : null}
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
        <div className="relative z-10 mx-4 mb-4 flex items-center gap-3 rounded-full bg-sport-soft py-1.5 pr-1.5 pl-4 md:mr-5 md:ml-[4.75rem]">
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
