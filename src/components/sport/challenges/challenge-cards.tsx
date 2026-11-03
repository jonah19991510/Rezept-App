import Link from "next/link";
import { ChevronDown, Flame, Plus, Trophy, Users } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { GroupHeading } from "@/components/layout/list-blocks";
import { buttonVariants } from "@/components/ui/button";
import {
  canJoin,
  challengePhase,
  hasStreak,
  progressLabel,
  progressShare,
  ruleSummary,
  statusLabel,
  type ParticipationStatus,
} from "@/lib/domain/challenges";
import type { ChallengeListItem } from "@/lib/server/challenges";
import { cn } from "@/lib/utils";
import { ChallengeIcon, phaseLabel, ProgressBar, StatusPill } from "./challenge-parts";
import { DayAction } from "./entry-controls";

const cardClass = "relative rounded-3xl border bg-card p-4 transition-colors hover:border-primary/40 md:p-5";
const linkClass = "after:absolute after:inset-0 after:rounded-3xl focus-visible:outline-none";

const STATUS_ORDER: Record<ParticipationStatus, number> = { active: 0, upcoming: 1, completed: 2, ended: 3, failed: 4 };

/**
 * Tab „Challenges“: oben die eigenen (mit heutigem Abhaken bzw. Eintragen), darunter alle, bei denen man noch
 * mitmachen kann, unten zugeklappt die vorbei sind oder keinen Einstieg mehr erlauben.
 */
export function ChallengeOverview({ items, today }: { items: ChallengeListItem[]; today: string }) {
  const mine = items
    .filter((i) => i.mine)
    .sort((a, b) => STATUS_ORDER[a.mine!.status] - STATUS_ORDER[b.mine!.status] || a.mine!.to.localeCompare(b.mine!.to));
  const others = items.filter((i) => !i.mine);
  const open = others.filter((i) => canJoin(i.challenge, today)).sort((a, b) => b.participantCount - a.participantCount);
  const closed = others.filter((i) => !canJoin(i.challenge, today));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {items.length === 0 ? "Noch keine Challenges" : `${items.length} ${items.length === 1 ? "Challenge" : "Challenges"}`}
        </p>
        <Link href="/sport/challenges/neu" className={cn(buttonVariants(), "h-11 rounded-full px-4")}>
          <Plus aria-hidden />
          Neue Challenge
        </Link>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Starte die erste Challenge"
          action={
            <Link href="/sport/challenges/neu" className={buttonVariants({ variant: "outline" })}>
              Challenge anlegen
            </Link>
          }
        >
          Zum Beispiel „30 Tage Liegestütze“ oder „30 Tage kein Alkohol“. Du legst die Regeln fest, alle aus der Runde können
          mitmachen und sich in der Rangliste vergleichen.
        </EmptyState>
      ) : null}

      {mine.length ? (
        <section aria-labelledby="meine-challenges">
          <div id="meine-challenges">
            <GroupHeading aside={mine.length}>Meine Challenges</GroupHeading>
          </div>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {mine.map((item) => (
              <MyChallengeCard key={item.challenge.id} item={item} today={today} />
            ))}
          </ul>
        </section>
      ) : null}

      {open.length ? (
        <section aria-labelledby="mitmachen">
          <div id="mitmachen">
            <GroupHeading aside={open.length}>Mitmachen</GroupHeading>
          </div>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {open.map((item) => (
              <ChallengeCard key={item.challenge.id} item={item} today={today} />
            ))}
          </ul>
        </section>
      ) : null}

      {closed.length ? (
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-1 text-sm font-semibold tracking-wide text-muted-foreground uppercase [&::-webkit-details-marker]:hidden">
            <span>Vorbei oder Einstieg vorbei</span>
            <span className="flex items-center gap-1 font-medium normal-case tabular-nums">
              {closed.length}
              <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
            </span>
          </summary>
          <ul className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
            {closed.map((item) => (
              <ChallengeCard key={item.challenge.id} item={item} today={today} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function ParticipantCount({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <Users className="size-3.5" aria-hidden />
      {n} Teilnehmer
    </span>
  );
}

/** Eigene Challenge: Status, Fortschritt, heute abhaken bzw. eintragen. */
function MyChallengeCard({ item, today }: { item: ChallengeListItem; today: string }) {
  const { challenge: c, mine: p } = item;
  if (!p) return null;
  const todayCell = p.days.find((d) => d.date === today);
  const canAct = todayCell != null && todayCell.state !== "future" && p.status !== "failed";
  return (
    <li className={cardClass}>
      <div className="flex items-start gap-3">
        <ChallengeIcon icon={c.icon} color={c.color} />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg leading-tight font-semibold wrap-anywhere">
            <Link href={`/sport/challenges/${c.id}`} className={linkClass}>
              {c.title}
            </Link>
          </h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <StatusPill status={p.status}>{statusLabel(p)}</StatusPill>
            {hasStreak(c) && p.streak > 0 ? (
              <span className="inline-flex items-center gap-0.5 tabular-nums">
                <Flame className="size-3.5 text-orange-500" aria-hidden />
                {p.streak}
              </span>
            ) : null}
            <span className="tabular-nums">{p.points.total} P.</span>
          </p>
        </div>
        {canAct ? (
          <div className="relative z-10">
            <DayAction challenge={{ ...c }} date={today} value={todayCell.value} />
          </div>
        ) : null}
      </div>
      <div className="mt-3 space-y-1.5">
        <ProgressBar share={progressShare(c, p)} color={c.color} label={`Fortschritt ${c.title}`} />
        <p className="flex justify-between gap-3 text-sm text-muted-foreground tabular-nums">
          <span>{progressLabel(c, p)}</span>
          <ParticipantCount n={item.participantCount} />
        </p>
      </div>
    </li>
  );
}

/** Challenge zum Mitmachen: Regeln kurz, Zeitraum, Teilnehmerzahl, von wem. */
function ChallengeCard({ item, today }: { item: ChallengeListItem; today: string }) {
  const { challenge: c } = item;
  const phase = challengePhase(c, today);
  return (
    <li className={cardClass}>
      <div className="flex items-start gap-3">
        <ChallengeIcon icon={c.icon} color={c.color} />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg leading-tight font-semibold wrap-anywhere">
            <Link href={`/sport/challenges/${c.id}`} className={linkClass}>
              {c.title}
            </Link>
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{ruleSummary(c)}</p>
        </div>
      </div>
      {c.description ? <p className="mt-2 line-clamp-2 text-sm">{c.description}</p> : null}
      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", phase.kind === "over" ? "bg-muted" : "bg-sport-soft text-sport")}>{phaseLabel(phase)}</span>
        <ParticipantCount n={item.participantCount} />
        <span className="truncate">{item.isOwn ? "von dir" : `von ${c.creatorName}`}</span>
      </p>
    </li>
  );
}
