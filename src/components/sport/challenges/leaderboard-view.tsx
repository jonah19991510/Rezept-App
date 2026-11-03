"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Crown, EyeOff, Flame, Medal, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";
import { setLeaderboardHiddenAction } from "@/app/(app)/sport/challenges/actions";
import { EmptyState } from "@/components/layout/empty-state";
import { RadioSegments } from "@/components/recipes/editor/editor-parts";
import { buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { POINTS, type LeaderRow } from "@/lib/domain/challenges";
import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";

type View = "monat" | "gesamt";
const MEDALS = ["#e0b100", "#9aa3ad", "#b0773f"];

/**
 * Gesamtrangliste: Punkte über alle Challenges, „Dieser Monat“ oder „Gesamt“. Oben die ersten drei als Treppchen,
 * darunter alle weiteren; die eigene Zeile ist hervorgehoben. Unten, wie es Punkte gibt, und der Schalter zum
 * Ausblenden.
 */
export function LeaderboardView({ month, total, monthLabel, meHidden }: { month: LeaderRow[]; total: LeaderRow[]; monthLabel: string; meHidden: boolean }) {
  const [view, setView] = useState<View>("monat");
  const rows = view === "monat" ? month : total;
  const ranked = rows.filter((r) => !r.hidden);
  const me = rows.find((r) => r.isMe);
  const podium = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  return (
    <div className="space-y-6">
      <RadioSegments
        label="Zeitraum"
        value={view}
        onChange={setView}
        options={[
          { value: "monat", label: monthLabel },
          { value: "gesamt", label: "Gesamt" },
        ]}
      />

      {total.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Noch keine Punkte"
          action={
            <Link href="/sport/entdecken/challenges" className={buttonVariants({ variant: "outline" })}>
              Zu den Challenges
            </Link>
          }
        >
          In der Rangliste steht, wer bei mindestens einer Challenge mitmacht. Punkte gibt es für jeden erfüllten Tag.
        </EmptyState>
      ) : ranked.length === 0 ? (
        <p className="rounded-3xl border border-dashed p-5 text-center text-sm text-muted-foreground">In diesem Monat hat noch niemand Punkte gesammelt.</p>
      ) : (
        <>
          <ol className="grid grid-cols-3 items-end gap-2" aria-label="Die ersten drei">
            {[podium[1], podium[0], podium[2]].map((row, i) =>
              row ? (
                <li key={row.userId} className={cn("flex flex-col items-center gap-1.5 text-center", i === 1 ? "order-2" : i === 0 ? "order-1" : "order-3")}>
                  {row.rank === 1 ? <Crown className="size-6" style={{ color: MEDALS[0] }} aria-hidden /> : <Medal className="size-5" style={{ color: MEDALS[Math.min(2, row.rank - 1)] }} aria-hidden />}
                  <span
                    className={cn("grid place-items-center rounded-full bg-muted font-semibold", row.rank === 1 ? "size-16 text-lg" : "size-12", row.isMe && "ring-3 ring-sport")}
                    aria-hidden
                  >
                    {initials(row.name)}
                  </span>
                  <span className="w-full truncate text-sm font-medium">
                    {row.name}
                    {row.isMe ? <span className="sr-only"> (du)</span> : null}
                  </span>
                  <span
                    className={cn("flex w-full flex-col items-center justify-start rounded-t-2xl pt-2 font-semibold tabular-nums", row.rank === 1 ? "h-24 bg-sport text-sport-foreground" : row.rank === 2 ? "h-16 bg-sport-soft" : "h-12 bg-muted")}
                    aria-label={`Platz ${row.rank}, ${row.points} Punkte`}
                  >
                    {row.points}
                    <span className="text-xs font-normal opacity-80">Punkte</span>
                  </span>
                </li>
              ) : (
                <li key={`leer-${i}`} className={i === 1 ? "order-2" : i === 0 ? "order-1" : "order-3"} aria-hidden />
              ),
            )}
          </ol>

          {rest.length ? (
            <ol className="divide-y overflow-hidden rounded-3xl border bg-card" start={4}>
              {rest.map((row) => (
                <LeaderLine key={row.userId} row={row} />
              ))}
            </ol>
          ) : null}
        </>
      )}

      {me ? (
        <div className="rounded-3xl border bg-card p-4">
          <p className="mb-2 text-sm font-semibold text-muted-foreground">Du</p>
          <ul>
            <LeaderLine row={me} />
          </ul>
          {me.hidden ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <EyeOff className="size-4 shrink-0" aria-hidden />
              Du bist ausgeblendet, nur du siehst deine Punkte.
            </p>
          ) : null}
        </div>
      ) : null}

      <section className="rounded-3xl border bg-card p-4 md:p-5" aria-labelledby="punkte">
        <h2 id="punkte" className="mb-2 flex items-center gap-2 font-heading text-xl font-semibold">
          <Sparkles className="size-5 text-sport" aria-hidden />
          So gibt es Punkte
        </h2>
        <ul className="space-y-1.5 text-sm">
          <li>
            <span className="font-semibold tabular-nums">{POINTS.day}</span> für jeden erfüllten Tag (bei „x Tage pro Woche“ höchstens x je Woche)
          </li>
          <li>
            <span className="font-semibold tabular-nums">+{POINTS.streakWeek}</span> für jede volle Woche am Stück (bei „Streng“ und „Serie zählt“)
          </li>
          <li>
            <span className="font-semibold tabular-nums">+{POINTS.completion}</span> für jede geschaffte Challenge
          </li>
          <li>
            <span className="font-semibold tabular-nums">+{POINTS.place.join(" / +")}</span> für Platz 1 bis 3 am Ende eines Wettkampfs („Wer schafft mehr?“ mit gemeinsamem Start)
          </li>
          <li className="text-muted-foreground">Bei Gesamtmengen gibt es die Tagespunkte anteilig zum Fortschritt, beim Wettkampf für jeden Tag mit Eintrag.</li>
          <li className="text-muted-foreground">Private Challenges zählen nicht für die Gesamtrangliste.</li>
        </ul>
      </section>

      <LeaderboardVisibility hidden={meHidden} />
    </div>
  );
}

function LeaderLine({ row }: { row: LeaderRow }) {
  return (
    <li className={cn("flex items-center gap-3 px-3 py-2.5", row.isMe && "bg-sport-soft/50")}>
      <span className="w-7 shrink-0 text-center text-sm font-semibold tabular-nums" aria-label={`Platz ${row.rank}`}>
        {row.hidden ? "–" : row.rank}
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
          <span>
            {row.challenges} {row.challenges === 1 ? "Challenge" : "Challenges"}
          </span>
          {row.completed ? <span>{row.completed} geschafft</span> : null}
          {row.bestStreak > 1 ? (
            <span className="inline-flex items-center gap-0.5">
              <Flame className="size-3 text-orange-500" aria-hidden />
              {row.bestStreak}
            </span>
          ) : null}
        </span>
      </span>
      <span className="shrink-0 text-right tabular-nums">
        <span className="block font-semibold">{row.points}</span>
        <span className="block text-xs text-muted-foreground">Punkte</span>
      </span>
    </li>
  );
}

/** Schalter „In der Rangliste zeigen“ (auch in den Einstellungen). */
export function LeaderboardVisibility({ hidden: initial }: { hidden: boolean }) {
  const [hidden, setHidden] = useState(initial);
  const [pending, startTransition] = useTransition();
  return (
    <label className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-2">
      <span>
        <span className="block font-medium">In der Gesamtrangliste zeigen</span>
        <span className="block text-sm text-muted-foreground">Ausgeschaltet sehen nur die Ranglisten der einzelnen Challenges deinen Namen.</span>
      </span>
      <Switch
        checked={!hidden}
        disabled={pending}
        onCheckedChange={(show) => {
          setHidden(!show);
          startTransition(async () => {
            const result = await setLeaderboardHiddenAction(!show);
            if (!result.ok) {
              setHidden(show);
              toast.error(result.message);
            }
          });
        }}
      />
    </label>
  );
}
