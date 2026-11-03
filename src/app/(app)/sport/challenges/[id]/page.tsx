import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Users } from "lucide-react";
import { ChallengeBoard, ChallengeStatsCard } from "@/components/sport/challenges/challenge-board";
import { ChallengeMenu, JoinButton } from "@/components/sport/challenges/challenge-actions";
import { ChallengeIcon, phaseLabel, RuleCard } from "@/components/sport/challenges/challenge-parts";
import { MyProgress } from "@/components/sport/challenges/my-progress";
import { requireUser } from "@/lib/auth";
import { canJoin, challengePhase, challengeStats, dateLabel, ruleLines, ruleSummary } from "@/lib/domain/challenges";
import { addDays, todayInBerlin } from "@/lib/domain/week";
import { getChallengeDetail } from "@/lib/server/challenges";

const isId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

export async function generateMetadata({ params }: PageProps<"/sport/challenges/[id]">): Promise<Metadata> {
  const user = await requireUser();
  const { id } = await params;
  const detail = isId(id) ? await getChallengeDetail(id, user.id) : null;
  return { title: detail?.challenge.title ?? "Challenge" };
}

/**
 * Challenge: Kopf mit Teilnehmerzahl, „Mitmachen“, eigener Fortschritt (abhaken, Kästchen je Tag), Regeln in Klartext,
 * Statistik der Gruppe und Rangliste.
 */
export default async function ChallengePage({ params }: PageProps<"/sport/challenges/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  if (!isId(id)) notFound();
  const detail = await getChallengeDetail(id, user.id);
  if (!detail) notFound();
  const { challenge: c, board, me, myValues, locked } = detail;
  const today = todayInBerlin();
  const phase = challengePhase(c, today);
  const stats = challengeStats(c, board, today);
  const isOwn = c.createdBy === user.id;
  const isAdmin = user.role === "admin";
  const joinable = !me && canJoin(c, today);

  let startText: string;
  if (c.startMode === "join") startText = `Deine ${c.frequency === "weekly" ? "Wochen" : "Tage"} zählen ab heute, bis ${dateLabel(addDays(today, c.durationDays - 1))}.`;
  else if (phase.kind === "upcoming") startText = `Start für alle am ${dateLabel(c.startsOn!)}.`;
  else startText = `Läuft schon seit ${dateLabel(c.startsOn!)}. Tage vor deinem Einstieg zählen als nicht erfüllt.`;

  return (
    <article className="space-y-6">
      <div>
        <Link
          href="/sport/entdecken/challenges"
          className="inline-flex min-h-10 items-center gap-1 rounded-full bg-muted pr-4 pl-2.5 text-sm font-medium transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Challenges
        </Link>
        <div className="mt-4 flex items-start gap-4">
          <ChallengeIcon icon={c.icon} color={c.color} size="lg" />
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="text-3xl leading-tight font-semibold wrap-anywhere md:text-4xl">{c.title}</h1>
            <p className="text-muted-foreground">{ruleSummary(c)}</p>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="rounded-full bg-sport-soft px-2.5 py-0.5 text-xs font-semibold text-sport">{phaseLabel(phase)}</span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Users className="size-4" aria-hidden />
                {board.length} Teilnehmer
              </span>
              <span>{isOwn ? "von dir" : `von ${c.creatorName}`}</span>
            </p>
          </div>
          <ChallengeMenu
            challengeId={c.id}
            title={c.title}
            canEdit={isOwn || isAdmin}
            canDelete={(isOwn && !locked) || isAdmin}
            isParticipant={me != null}
            othersJoined={locked}
          />
        </div>
        {c.description ? <p className="mt-4 whitespace-pre-line">{c.description}</p> : null}
      </div>

      {joinable ? <JoinButton challengeId={c.id} title={c.title} startText={startText} /> : null}
      {!me && !joinable ? (
        <p className="rounded-3xl border border-dashed p-4 text-sm text-muted-foreground">
          {phase.kind === "over" ? "Diese Challenge ist vorbei." : "Der Einstieg ist nicht mehr möglich."} Die Rangliste und die Statistik siehst du trotzdem.
        </p>
      ) : null}

      {me ? <MyProgress challenge={c} progress={me.progress} values={myValues} today={today} rank={me.rank} /> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <ChallengeBoard rules={c} board={board} today={today} />
        <div className="space-y-6">
          <RuleCard lines={ruleLines(c)} />
          {board.length ? <ChallengeStatsCard rules={c} stats={stats} color={c.color} today={today} /> : null}
        </div>
      </div>
    </article>
  );
}
