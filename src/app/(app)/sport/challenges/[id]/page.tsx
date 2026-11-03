import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, History, Repeat, Users } from "lucide-react";
import { ChallengeBoard, ChallengeStatsCard } from "@/components/sport/challenges/challenge-board";
import { ChallengeMenu, JoinButton } from "@/components/sport/challenges/challenge-actions";
import { ChallengeIcon, phaseLabel, PrivateBadge, RuleCard, StatusPill } from "@/components/sport/challenges/challenge-parts";
import { MyProgress } from "@/components/sport/challenges/my-progress";
import { chipClass } from "@/components/recipes/chip-select";
import { requireUser } from "@/lib/auth";
import { amount, canJoin, challengePhase, dateLabel, roundAt, roundLabel, ruleLines, ruleSummary, unitOf } from "@/lib/domain/challenges";
import { addDays, todayInBerlin } from "@/lib/domain/week";
import { getChallengeDetail, type RoundSummary } from "@/lib/server/challenges";
import type { Challenge } from "@/lib/domain/challenges";

const isId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

export async function generateMetadata({ params }: PageProps<"/sport/challenges/[id]">): Promise<Metadata> {
  const user = await requireUser();
  const { id } = await params;
  const detail = isId(id) ? await getChallengeDetail(id, user.id) : null;
  return { title: detail?.challenge.title ?? "Challenge" };
}

/**
 * Challenge: Kopf mit Teilnehmerzahl, „Mitmachen“, eigener Fortschritt (abhaken, Kästchen je Tag), Regeln in Klartext,
 * Statistik der Gruppe und Rangliste. Bei Monats-/Jahres-Challenges und Wiederholung mit Runden zum Umschalten
 * (`?runde=`) und den Ergebnissen früherer Runden.
 */
export default async function ChallengePage({ params, searchParams }: PageProps<"/sport/challenges/[id]">) {
  const user = await requireUser();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!isId(id)) notFound();
  const requested = typeof query.runde === "string" && /^\d+$/.test(query.runde) ? Number(query.runde) : undefined;
  const detail = await getChallengeDetail(id, user.id, requested);
  if (!detail) notFound();
  const { challenge: c, rules, board, me, myValues, locked, stats, rounds, selected, current, history, myNextRound, isParticipant } = detail;
  const today = todayInBerlin();
  const phase = challengePhase(c, today);
  const isOwn = c.createdBy === user.id;
  const isAdmin = user.role === "admin";
  const joinable = !isParticipant && canJoin(c, today);
  const viewingPast = selected < current;
  const selectedLabel = rounds.find((r) => r.index === selected)?.label ?? null;

  let startText: string;
  if (c.startMode === "join") startText = `Deine ${c.frequency === "weekly" ? "Wochen" : "Tage"} zählen ab heute, bis ${dateLabel(addDays(today, c.durationDays - 1))}.`;
  else if (phase.kind === "upcoming") startText = `Start für alle am ${dateLabel(c.startsOn!)}.`;
  else if (c.repeats && phase.kind === "running") {
    const round = roundAt(c, phase.round);
    startText =
      today <= addDays(round.from, c.lateJoinDays)
        ? `Die laufende Runde (${roundLabel(c, round)}) hat am ${dateLabel(round.from)} begonnen, du steigst direkt ein. Tage davor zählen als nicht erfüllt.`
        : `Du bist ab der nächsten Runde dabei: ${roundLabel(c, roundAt(c, phase.round + 1))}, Start am ${dateLabel(roundAt(c, phase.round + 1).from)}.`;
  } else startText = `Läuft schon seit ${dateLabel(c.startsOn!)}. Tage vor deinem Einstieg zählen als nicht erfüllt.`;

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
              <span className="rounded-full bg-sport-soft px-2.5 py-0.5 text-xs font-semibold text-sport">
                {c.repeats && phase.kind === "running" ? `${roundLabel(c, roundAt(c, phase.round))} · Tag ${phase.day} von ${phase.of}` : phaseLabel(phase)}
              </span>
              {c.isPublic ? null : <PrivateBadge />}
              {c.repeats ? (
                <span className="inline-flex items-center gap-1">
                  <Repeat className="size-4" aria-hidden />
                  wiederholt sich
                </span>
              ) : null}
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
            isParticipant={isParticipant}
            othersJoined={locked}
          />
        </div>
        {c.description ? <p className="mt-4 whitespace-pre-line">{c.description}</p> : null}
        {c.isPublic ? null : (
          <p className="mt-3 text-sm text-muted-foreground">Private Challenge: nur du siehst sie, die Punkte zählen nicht für die Gesamtrangliste.</p>
        )}
      </div>

      {joinable ? <JoinButton challengeId={c.id} title={c.title} startText={startText} /> : null}
      {!isParticipant && !joinable ? (
        <p className="rounded-3xl border border-dashed p-4 text-sm text-muted-foreground">
          {phase.kind === "over" ? "Diese Challenge ist vorbei." : "Der Einstieg ist nicht mehr möglich."} Die Rangliste und die Statistik siehst du trotzdem.
        </p>
      ) : null}
      {myNextRound && !viewingPast ? (
        <p className="rounded-3xl border border-sport/30 bg-sport-soft/60 p-4 text-sm">
          Du bist dabei und zählst ab der nächsten Runde: <span className="font-semibold">{myNextRound}</span>. Bis dahin siehst du hier die laufende Runde der anderen.
        </p>
      ) : null}

      {rounds.length > 1 ? (
        <nav aria-label="Runden" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden">
          {[...rounds].reverse().map((r) => (
            <Link key={r.index} href={r.index === current ? `/sport/challenges/${c.id}` : `/sport/challenges/${c.id}?runde=${r.index}`} scroll={false} aria-current={r.index === selected ? "page" : undefined} className={chipClass(r.index === selected)}>
              {r.label}
              {r.index === current ? <span className="text-xs opacity-75">läuft</span> : null}
            </Link>
          ))}
        </nav>
      ) : null}

      {viewingPast ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <History className="size-4" aria-hidden />
          Du siehst die abgeschlossene Runde {selectedLabel}.{" "}
          <Link href={`/sport/challenges/${c.id}`} scroll={false} className="font-medium text-primary hover:underline">
            Zur laufenden Runde
          </Link>
        </p>
      ) : null}

      {me ? (
        <MyProgress key={selected} challenge={{ ...rules, id: c.id, title: c.title, color: c.color }} progress={me.progress} values={myValues} today={today} rank={me.rank} />
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <ChallengeBoard rules={rules} board={board} today={today} />
        <div className="space-y-6">
          {history.length ? <RoundHistory challenge={c} history={history} selected={selected} /> : null}
          <RuleCard lines={ruleLines(c)} />
          {board.length ? <ChallengeStatsCard rules={rules} stats={stats} color={c.color} today={today} /> : null}
        </div>
      </div>
    </article>
  );
}

/** Frühere Runden: je Runde das eigene Ergebnis und wie die Gruppe abgeschnitten hat; antippen zeigt die Runde. */
function RoundHistory({ challenge: c, history, selected }: { challenge: Challenge; history: RoundSummary[]; selected: number }) {
  const race = c.metric === "most" || c.metric === "total";
  const done = history.filter((h) => h.mine?.status === "completed").length;
  const mineCount = history.filter((h) => h.mine).length;
  return (
    <section className="rounded-3xl border bg-card p-4 md:p-5" aria-labelledby="fruehere-runden">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="fruehere-runden" className="font-heading text-xl font-semibold">
          Frühere Runden
        </h2>
        {mineCount && c.metric !== "most" ? (
          <span className="text-sm text-muted-foreground tabular-nums">
            {done} von {mineCount} geschafft
          </span>
        ) : null}
      </div>
      <ul className="divide-y">
        {history.map((h) => (
          <li key={h.round.index}>
            <Link
              href={`/sport/challenges/${c.id}?runde=${h.round.index}`}
              scroll={false}
              aria-current={h.round.index === selected ? "page" : undefined}
              className="flex min-h-14 items-center justify-between gap-3 py-2 transition-colors hover:text-primary aria-[current=page]:text-primary"
            >
              <span className="min-w-0">
                <span className="block font-medium">{h.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {h.participants} Teilnehmer
                  {c.metric === "most" ? (h.leader ? ` · Platz 1: ${h.leader}` : "") : ` · ${h.completed} geschafft`}
                </span>
              </span>
              {h.mine ? (
                <span className="flex shrink-0 flex-col items-end gap-0.5 text-right text-sm tabular-nums">
                  {c.metric === "most" ? (
                    <span className="font-semibold">Platz {h.mine.rank}</span>
                  ) : (
                    <StatusPill status={h.mine.status}>{h.mine.status === "completed" ? "Geschafft" : h.mine.status === "failed" ? "Ausgeschieden" : "Nicht geschafft"}</StatusPill>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {race ? `${amount(h.mine.sum)} ${unitOf(c, h.mine.sum)} · ` : `${h.mine.covered}/${h.mine.periodTotal} · `}
                    {h.mine.points} P.
                  </span>
                </span>
              ) : (
                <span className="shrink-0 text-xs text-muted-foreground">nicht dabei</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
