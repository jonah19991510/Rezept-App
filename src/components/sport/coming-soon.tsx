import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

/** Platzhalterseite für Teile von Sport & Gesundheit, die noch nicht gebaut sind: was hier entstehen wird. */
export function ComingSoon({ icon: Icon, title, intro, features }: { icon: LucideIcon; title: string; intro: string; features: string[] }) {
  return (
    <>
      <PageHeader title={title} />
      <section className="rounded-3xl border bg-card p-6 md:p-8">
        <div className="flex items-start gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-sport-soft text-sport">
            <Icon className="size-7" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <span className="inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Kommt bald</span>
            <p className="text-muted-foreground">{intro}</p>
          </div>
        </div>
        <h2 className="mt-6 mb-3 font-sans text-sm font-semibold tracking-normal text-muted-foreground">Was hier entsteht</h2>
        <ul className="grid gap-2">
          {features.map((f) => (
            <li key={f} className="flex gap-2.5">
              <Check className="mt-0.5 size-4 shrink-0 text-sport" aria-hidden />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <Link href="/sport/plaene" className="mt-6 inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">
          Zu deinen Trainingsplänen
        </Link>
      </section>
    </>
  );
}
