import type { Metadata } from "next";
import { LeaderboardView } from "@/components/sport/challenges/leaderboard-view";
import { requireUser } from "@/lib/auth";
import { globalLeaderboard, monthRange } from "@/lib/domain/challenges";
import { todayInBerlin } from "@/lib/domain/week";
import { getLeaderboard } from "@/lib/server/challenges";

export const metadata: Metadata = { title: "Rangliste" };

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** Entdecken › Rangliste: Punkte aller, die bei Challenges mitmachen, diesen Monat und insgesamt. */
export default async function LeaderboardPage() {
  const user = await requireUser();
  const today = todayInBerlin();
  const { participations, meHidden } = await getLeaderboard(user.id);
  return (
    <LeaderboardView
      month={globalLeaderboard(participations, user.id, monthRange(today))}
      total={globalLeaderboard(participations, user.id, null)}
      monthLabel={MONTHS[Number(today.slice(5, 7)) - 1]}
      meHidden={meHidden}
    />
  );
}
