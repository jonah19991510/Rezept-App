"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, SearchX } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { ChipRow, SearchField, TagLabel } from "@/components/layout/list-blocks";
import { chipClass } from "@/components/recipes/chip-select";
import { MUSCLE_LABELS, MUSCLE_ORDER, type MuscleGroup } from "@/lib/domain/exercises";
import { DAYS_FILTER_LABELS, filterPublicPlans, planMainMuscles, type DaysFilter } from "@/lib/domain/training-plan";
import type { PublicPlanItem } from "@/lib/server/sport";

const DAYS: DaysFilter[] = ["1-2", "3", "4+"];

/** Öffentliche Pläne: Suche, Tage und Muskelgruppe als wischbare Chips (wie bei Essen & Trinken), Karten. */
export function DiscoverPlans({ plans }: { plans: PublicPlanItem[] }) {
  const [query, setQuery] = useState("");
  const [days, setDays] = useState<DaysFilter | null>(null);
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const shown = useMemo(() => filterPublicPlans(plans, { query, days, muscle }), [plans, query, days, muscle]);
  // Nur Muskelgruppen anbieten, die in mindestens einem Plan vorkommen
  const muscles = useMemo(() => MUSCLE_ORDER.filter((m) => plans.some((p) => (p.muscleSets[m] ?? 0) > 0)), [plans]);

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <SearchField value={query} onChange={setQuery} placeholder="Pläne oder Namen suchen …" label="Pläne suchen" />
        <ChipRow label="Filter">
          {DAYS.map((d) => (
            <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(days === d ? null : d)} className={chipClass(days === d)}>
              {DAYS_FILTER_LABELS[d]}
            </button>
          ))}
          {muscles.map((m) => (
            <button key={m} type="button" aria-pressed={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)} className={chipClass(muscle === m)}>
              {MUSCLE_LABELS[m]}
            </button>
          ))}
        </ChipRow>
      </div>

      <p className="text-sm text-muted-foreground">
        {shown.length === plans.length ? `${plans.length} ${plans.length === 1 ? "Plan" : "Pläne"}` : `${shown.length} von ${plans.length} Plänen`}
      </p>

      {shown.length === 0 ? (
        <EmptyState icon={SearchX} title="Nichts gefunden">
          Kein Plan passt zu diesen Filtern. Probier es mit weniger Filtern.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {shown.map((p) => {
            const focus = planMainMuscles(p.muscleSets);
            return (
              <li key={p.id} className="relative rounded-3xl border bg-card p-4 transition-colors hover:border-primary/40 md:p-5">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="min-w-0 text-xl leading-tight font-semibold wrap-anywhere">
                    <Link href={`/sport/plaene/${p.id}`} className="after:absolute after:inset-0 after:rounded-3xl focus-visible:outline-none">
                      {p.title}
                    </Link>
                  </h2>
                  {p.copied ? (
                    <TagLabel tone="sage" icon={Check}>
                      Übernommen
                    </TagLabel>
                  ) : null}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {p.isOwn ? "von dir" : `von ${p.authorName}`} · {p.days.length === 1 ? "1 Tag" : `${p.days.length} Tage`}
                  {focus.length ? ` · ${focus.map((m) => MUSCLE_LABELS[m]).join(", ")}` : ""}
                </p>
                {p.description ? <p className="mt-2 line-clamp-2 text-sm">{p.description}</p> : null}
                <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Trainingstage">
                  {p.days.map((d, i) => (
                    <li key={`${d.name}-${i}`} className="max-w-full truncate rounded-full bg-sport-soft px-3 py-1 text-sm text-sport">
                      {d.name}
                      {d.focus ? <span className="opacity-75"> · {d.focus}</span> : null}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
