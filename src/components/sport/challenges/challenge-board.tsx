import { Crown, Flame, Medal } from "lucide-react";
import {
  amount,
  dateLabel,
  hasStreak,
  progressLabel,
  statusLabel,
  unitOf,
  type BoardRow,
  type ChallengeRules,
  type ChallengeStats,
} from "@/lib/domain/challenges";
import { drinkColor } from "@/lib/domain/drinks";
import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";
import { StatusPill } from "./challenge-parts";

/** Statistik der Challenge: Teilnehmer nach Status, heute erledigt, gemeinsame Menge, Erfolgsquote je Tag. */
export function ChallengeStatsCard({ rules, stats, color, today }: { rules: ChallengeRules; stats: ChallengeStats; color: string; today: string }) {
  const c = drinkColor(color);
  const race = rules.metric === "most";
  const tiles = race
    ? [
        { label: "Teilnehmer", value: String(stats.participants) },
        { label: "Dabei", value: String(stats.byStatus.active + stats.byStatus.upcoming) },
        { label: "Ø pro Person", value: stats.participants ? amount(Math.round((stats.sum / stats.participants) * 10) / 10) : "–" },
        { label: "Bester Tag", value: stats.bestDay ? amount(stats.bestDay.value) : "–", hint: stats.bestDay ? `${stats.bestDay.name}, ${dateLabel(stats.bestDay.date)}` : undefined },
      ]
    : [
        { label: "Teilnehmer", value: String(stats.participants) },
        { label: "Dabei", value: String(stats.byStatus.active + stats.byStatus.upcoming) },
        { label: "Geschafft", value: String(stats.byStatus.completed) },
        rules.missedRule === "strict" ? { label: "Ausgeschieden", value: String(stats.byStatus.failed) } : { label: "Nicht geschafft", value: String(stats.byStatus.ended) },
      ];
  const showSum = rules.metric !== "check" || rules.source === "workouts";
  const rated = stats.rates.filter((r) => r.due > 0);

  return (
    <section className="space-y-4 rounded-3xl border bg-card p-4 md:p-5" aria-labelledby="statistik">
      <h2 id="statistik" className="font-heading text-xl font-semibold">
        Statistik
      </h2>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl bg-muted/60 p-3">
            <dt className="text-xs text-muted-foreground">{t.label}</dt>
            <dd className="font-heading text-2xl font-semibold tabular-nums">{t.value}</dd>
            {"hint" in t && t.hint ? <dd className="truncate text-xs text-muted-foreground">{t.hint}</dd> : null}
          </div>
        ))}
      </dl>
      <div className="grid gap-2 sm:grid-cols-2">
        {stats.today.due > 0 ? (
          <p className="rounded-2xl border p-3 text-sm">
            <span className="block text-muted-foreground">Heute erledigt</span>
            <span className="text-lg font-semibold tabular-nums">
              {stats.today.met} von {stats.today.due}
            </span>
          </p>
        ) : null}
        {showSum ? (
          <p className="rounded-2xl border p-3 text-sm">
            <span className="block text-muted-foreground">Zusammen geschafft</span>
            <span className="text-lg font-semibold tabular-nums">
              {amount(stats.sum)} {unitOf(rules, stats.sum)}
            </span>
          </p>
        ) : null}
      </div>

      {rated.length > 1 ? (
        <div>
          <p className="mb-2 text-sm font-semibold text-muted-foreground">{race ? "Mit Eintrag pro Tag" : "Erfüllt pro Tag"}</p>
          <div className="flex h-28 items-end gap-[3px]" role="img" aria-label={`Anteil der Teilnehmer, die den Tag erfüllt haben, ${dateLabel(stats.rates[0].date)} bis ${dateLabel(stats.rates.at(-1)!.date)}`}>
            {stats.rates.map((r) => {
              const share = r.due ? r.met / r.due : 0;
              return (
                <div key={r.date} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${dateLabel(r.date)}: ${r.met} von ${r.due}`}>
                  <div
                    className={cn("w-full rounded-t-[3px]", r.due === 0 && "bg-muted")}
                    style={{ height: r.due ? `${Math.max(3, share * 100)}%` : "3%", background: r.due ? (r.date === today ? `color-mix(in srgb, ${c} 55%, var(--card))` : c) : undefined }}
                  />
                </div>
              );
            })}
          </div>
          <p className="mt-1 flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>{dateLabel(stats.rates[0].date)}</span>
            <span>{dateLabel(stats.rates.at(-1)!.date)}</span>
          </p>
        </div>
      ) : null}
    </section>
  );
}

const MEDALS = ["#e0b100", "#9aa3ad", "#b0773f"];

/** Rangliste der Challenge: Platz, Name, Status, Fortschritt, Serie, Punkte (bzw. Menge bei „insgesamt“). */
export function ChallengeBoard({ rules, board, today }: { rules: ChallengeRules; board: BoardRow[]; today: string }) {
  const total = rules.metric === "total" || rules.metric === "most";
  return (
    <section className="space-y-3" aria-labelledby="rangliste">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 id="rangliste" className="font-heading text-xl font-semibold">
          Rangliste
        </h2>
        <span className="text-sm text-muted-foreground">{total ? `nach ${unitOf(rules)} insgesamt` : "nach Punkten"}</span>
      </div>
      {board.length === 0 ? (
        <p className="rounded-3xl border border-dashed p-5 text-center text-sm text-muted-foreground">Noch macht niemand mit. Sei die erste Person!</p>
      ) : (
        <ol className="divide-y overflow-hidden rounded-3xl border bg-card">
          {board.map((row) => {
            const p = row.progress;
            return (
              <li key={row.userId} className={cn("flex items-center gap-3 px-3 py-2.5", row.isMe && "bg-sport-soft/50")}>
                <span className="grid w-8 shrink-0 place-items-center text-sm font-semibold tabular-nums" aria-label={`Platz ${row.rank}`}>
                  {row.rank <= 3 && p.status !== "failed" ? (
                    row.rank === 1 ? (
                      <Crown className="size-5" style={{ color: MEDALS[0] }} aria-hidden />
                    ) : (
                      <Medal className="size-5" style={{ color: MEDALS[row.rank - 1] }} aria-hidden />
                    )
                  ) : (
                    row.rank
                  )}
                </span>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold" aria-hidden>
                  {initials(row.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {row.name}
                    {row.isMe ? <span className="text-muted-foreground"> (du)</span> : null}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground tabular-nums">
                    {rules.metric === "most" ? (
                      p.status === "active" ? (
                        <span>heute {amount(p.days.find((d) => d.date === today)?.value ?? 0)}</span>
                      ) : (
                        <StatusPill status={p.status}>{statusLabel(p)}</StatusPill>
                      )
                    ) : p.status === "active" ? (
                      <span>{progressLabel(rules, p)}</span>
                    ) : (
                      <StatusPill status={p.status}>{statusLabel(p)}</StatusPill>
                    )}
                    {p.points.place ? <span>+{p.points.place} Platzbonus</span> : null}
                    {hasStreak(rules) && p.streak > 1 ? (
                      <span className="inline-flex items-center gap-0.5">
                        <Flame className="size-3 text-orange-500" aria-hidden />
                        {p.streak}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  <span className="block font-semibold">{total ? amount(p.sum) : p.points.total}</span>
                  <span className="block text-xs text-muted-foreground">{total ? unitOf(rules, p.sum) : "Punkte"}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
