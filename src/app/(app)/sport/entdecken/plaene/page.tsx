import type { Metadata } from "next";
import Link from "next/link";
import { Compass } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { DiscoverPlans } from "@/components/sport/discover-plans";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getPublicTrainingPlans } from "@/lib/server/sport";

export const metadata: Metadata = { title: "Pläne entdecken" };

/** Entdecken › Pläne (Phase S4): öffentliche Trainingspläne aus der Runde; trainieren oder übernehmen auf der Planseite. */
export default async function DiscoverPlansPage() {
  const user = await requireUser();
  const plans = await getPublicTrainingPlans(user.id);
  const authors = new Set(plans.map((p) => p.authorName)).size;

  return plans.length === 0 ? (
    <EmptyState
      icon={Compass}
      title="Noch keine öffentlichen Pläne"
      action={
        <Link href="/sport/plaene" className={buttonVariants({ variant: "outline" })}>
          Zu deinen Plänen
        </Link>
      }
    >
      Pläne sind zuerst privat. Öffne einen deiner Pläne und schalte „Öffentlich“ ein, dann erscheint er hier für alle aus der
      Runde, mit deinem Anzeigenamen.
    </EmptyState>
  ) : (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {plans.length} öffentliche {plans.length === 1 ? "Plan" : "Pläne"} von {authors} {authors === 1 ? "Person" : "Personen"}
      </p>
      <DiscoverPlans plans={plans} />
    </div>
  );
}
