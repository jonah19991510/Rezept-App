import Link from "next/link";
import { Check, Trophy } from "lucide-react";
import { AsideLink, CARD, Empty, WidgetTitle } from "@/components/home/widget-parts";
import { GroupHeading } from "@/components/layout/list-blocks";
import { dateLabel, isDayOpen, progressLabel, progressShare, statusLabel } from "@/lib/domain/challenges";
import { drinkColor } from "@/lib/domain/drinks";
import type { ChallengeListItem } from "@/lib/server/challenges";
import { ChallengeIcon, ProgressBar } from "./challenge-parts";
import { DayAction } from "./entry-controls";

/** Eigene Challenges, die an `date` laufen (ohne Ausgeschiedene). */
function dueOn(items: ChallengeListItem[], date: string) {
  return items.filter((i) => i.mine && i.mine.status !== "failed" && date >= i.mine.from && date <= i.mine.to);
}

/** Eine Zeile: Symbol, Name, Stand und rechts Abhaken bzw. Eintragen (wenn der Tag sich noch ändern lässt). */
function DayRow({ item, date, today, showBar }: { item: ChallengeListItem; date: string; today: string; showBar?: boolean }) {
  const { challenge: c, mine: p } = item;
  if (!p) return null;
  const cell = p.days.find((d) => d.date === date);
  const editable = c.source === "workouts" ? date === today : isDayOpen(date, today, c.backfillDays);
  return (
    <li className="py-2">
      <div className="flex min-h-12 items-center gap-3">
        <Link href={`/sport/challenges/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
          <ChallengeIcon icon={c.icon} color={c.color} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{c.title}</span>
            <span className="block truncate text-xs text-muted-foreground tabular-nums">
              {statusLabel(p)} · {progressLabel(c, p)}
            </span>
          </span>
        </Link>
        {editable ? (
          <DayAction challenge={c} date={date} value={cell?.value ?? 0} size="md" />
        ) : cell?.state === "met" ? (
          <span className="grid size-10 place-items-center rounded-full text-white" style={{ background: drinkColor(c.color) }} aria-label="erfüllt">
            <Check className="size-5" strokeWidth={3} aria-hidden />
          </span>
        ) : null}
      </div>
      {showBar ? (
        <div className="mt-1.5 pl-12">
          <ProgressBar share={progressShare(c, p)} color={c.color} label={`Fortschritt ${c.title}`} />
        </div>
      ) : null}
    </li>
  );
}

/** Habits „Heute“: die eigenen Challenges des gezeigten Tages zum Abhaken bzw. Eintragen. */
export function ChallengesForDay({ items, date, today }: { items: ChallengeListItem[]; date: string; today: string }) {
  const due = dueOn(items, date);
  if (!due.length) return null;
  const done = due.filter((i) => i.mine!.days.find((d) => d.date === date)?.state === "met").length;
  return (
    <section aria-label="Challenges">
      <GroupHeading aside={`${done}/${due.length}`}>Challenges</GroupHeading>
      <ul className="divide-y rounded-3xl border bg-card px-3">
        {due.map((item) => (
          <DayRow key={item.challenge.id} item={item} date={date} today={today} />
        ))}
      </ul>
      {date !== today ? <p className="mt-1 px-1 text-xs text-muted-foreground">Für {dateLabel(date)}; ändern geht, solange die Challenge Nachtragen erlaubt.</p> : null}
    </section>
  );
}

/** Startseite: laufende Challenges mit Fortschritt und heutigem Abhaken; ohne Challenges ein Hinweis zum Mitmachen. */
export function ChallengesWidget({ items, today }: { items: ChallengeListItem[]; today: string }) {
  const running = dueOn(items, today);
  const upcoming = items.filter((i) => i.mine?.status === "upcoming");
  return (
    <section className={CARD} aria-label="Challenges">
      <WidgetTitle icon={Trophy} title="Challenges" aside={<AsideLink href="/sport/entdecken/challenges">Entdecken</AsideLink>} />
      {running.length === 0 ? (
        <Empty>
          {upcoming.length
            ? `${upcoming[0].challenge.title} startet am ${dateLabel(upcoming[0].mine!.from)}.`
            : "Du machst gerade bei keiner Challenge mit."}{" "}
          <Link href="/sport/entdecken/challenges" className="font-medium text-primary hover:underline">
            {upcoming.length ? "Alle Challenges" : "Challenge finden"}
          </Link>
        </Empty>
      ) : (
        <ul className="divide-y">
          {running.map((item) => (
            <DayRow key={item.challenge.id} item={item} date={today} today={today} showBar />
          ))}
        </ul>
      )}
    </section>
  );
}
