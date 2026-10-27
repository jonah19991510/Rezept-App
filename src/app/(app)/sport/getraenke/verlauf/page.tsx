import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, History } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { requireUser } from "@/lib/auth";
import { formatLiters, formatMg } from "@/lib/domain/drinks";
import { addDays, todayInBerlin } from "@/lib/domain/week";
import { formatDayShort } from "@/lib/format";
import { getDrinkDays, getDrinkSetup } from "@/lib/server/drinks";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Getränke-Verlauf" };

const month = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });

/** Getränketracker, Tab „Verlauf“: alle Tage mit Einträgen, neueste zuerst, nach Monat (anfangs drei Monate). */
export default async function DrinkHistoryPage({ searchParams }: PageProps<"/sport/getraenke/verlauf">) {
  const user = await requireUser();
  const query = await searchParams;
  const months = Math.min(60, Math.max(3, Number.parseInt(typeof query.monate === "string" ? query.monate : "3", 10) || 3));
  const today = todayInBerlin();
  const from = addDays(today, -Math.round(months * 30.5));
  const [{ goalMl }, days] = await Promise.all([getDrinkSetup(user.id), getDrinkDays(from, today)]);

  const groups = new Map<string, typeof days>();
  for (const d of [...days].reverse()) {
    const key = month.format(new Date(`${d.date}T12:00:00Z`));
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }

  if (days.length === 0) {
    return (
      <EmptyState icon={History} title="Noch keine Tage">
        Sobald du etwas einträgst, findest du hier jeden Tag mit Menge, Ziel und Koffein.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-6">
      {[...groups].map(([label, items]) => (
        <section key={label} aria-label={label}>
          <h2 className="mb-2 flex min-h-11 items-center justify-between px-1 font-sans text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            <span>{label}</span>
            <span className="font-medium tabular-nums normal-case">
              Ziel an {items.filter((d) => d.ml >= goalMl).length} von {items.length} Tagen
            </span>
          </h2>
          <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
            {items.map((d) => {
              const share = d.ml / goalMl;
              return (
                <li key={d.date}>
                  <Link href={`/sport/getraenke/verlauf/${d.date}`} className="flex min-h-16 items-center gap-3 px-4 py-3 transition hover:bg-muted/40">
                    <span className="w-16 shrink-0 text-sm font-medium text-muted-foreground">{d.date === today ? "Heute" : formatDayShort(`${d.date}T12:00:00Z`)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold tabular-nums">{formatLiters(d.ml)}</span>
                        <span className={cn("text-sm tabular-nums", share >= 1 ? "font-semibold text-sage" : "text-muted-foreground")}>{Math.round(share * 100)} %</span>
                      </span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                        <span className={cn("block h-full rounded-full", share >= 1 ? "bg-sage" : "bg-sport")} style={{ width: `${Math.min(1, share) * 100}%` }} />
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground tabular-nums">
                        {d.count === 1 ? "1 Getränk" : `${d.count} Getränke`} · {formatMg(d.caffeine)} Koffein
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <Link
        href={`/sport/getraenke/verlauf?monate=${months + 3}`}
        scroll={false}
        className="flex min-h-11 items-center justify-center rounded-full border text-sm font-medium transition hover:bg-muted"
      >
        Ältere Tage anzeigen
      </Link>
    </div>
  );
}
