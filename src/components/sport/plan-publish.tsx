"use client";

import { useOptimistic, useTransition } from "react";
import { Copy, Globe, Lock } from "lucide-react";
import { toast } from "sonner";
import { forkPlanAction, setPlanPublicAction } from "@/app/(app)/sport/plaene/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: false, label: "Privat", icon: Lock },
  { value: true, label: "Öffentlich", icon: Globe },
] as const;

/** Umschalter Privat | Öffentlich auf der eigenen Planseite (wie bei Rezepten). Wirkt sofort. */
export function PlanPublishToggle({ planId, isPublic }: { planId: string; isPublic: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(isPublic);
  const [pending, startTransition] = useTransition();

  function select(next: boolean) {
    if (next === optimistic) return;
    startTransition(async () => {
      setOptimistic(next);
      const result = await setPlanPublicAction(planId, next);
      if (!result.ok) toast.error(result.message ?? "Das hat nicht geklappt.");
      else toast.success(next ? "Veröffentlicht. Der Plan steht jetzt unter Entdecken." : "Der Plan ist wieder privat.");
    });
  }

  return (
    <div className="space-y-2">
      <div className="grid max-w-sm grid-cols-2 gap-1 rounded-full border bg-card p-1" role="group" aria-label="Sichtbarkeit">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            aria-pressed={optimistic === value}
            aria-describedby="plan-sichtbarkeit"
            disabled={pending}
            onClick={() => select(value)}
            className={cn(
              "flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-transparent px-4 text-sm font-medium text-muted-foreground transition hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              optimistic === value && "border-primary/60 bg-primary/15 text-primary hover:text-primary",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>
      <p id="plan-sichtbarkeit" className="px-1 text-sm text-muted-foreground">
        {optimistic
          ? "Für alle unter „Entdecken“ sichtbar, nur mit deinem Anzeigenamen. Andere können ihn trainieren und übernehmen; deine Trainings sehen sie nicht."
          : "Nur du siehst diesen Plan."}
      </p>
    </div>
  );
}

/** „In meine Pläne übernehmen“ für einen fremden öffentlichen Plan. */
export function ForkPlanButton({ planId }: { planId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      className="h-12 rounded-full px-5"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await forkPlanAction(planId);
          if (result && !result.ok) toast.error(result.message);
        })
      }
    >
      <Copy aria-hidden />
      In meine Pläne übernehmen
    </Button>
  );
}
