import type { Metadata } from "next";
import { DrinkStats } from "@/components/sport/drinks/drink-stats";
import { requireUser } from "@/lib/auth";
import { goalStreak, periodRange, type StatsView } from "@/lib/domain/drinks";
import { addDays, isIsoDate, todayInBerlin } from "@/lib/domain/week";
import { getDrinkDays, getDrinkEntries, getDrinkSetup } from "@/lib/server/drinks";

export const metadata: Metadata = { title: "Getränke-Statistik" };

/** Getränketracker, Tab „Statistik“: Woche oder Monat um `?datum=` (Standard: diese Woche, heute gewählt). */
export default async function DrinkStatsPage({ searchParams }: PageProps<"/sport/getraenke/statistik">) {
  const user = await requireUser();
  const query = await searchParams;
  const today = todayInBerlin();
  const view: StatsView = query.ansicht === "monat" ? "monat" : "woche";
  const date = isIsoDate(query.datum) && query.datum <= today ? query.datum : today;
  const filter = typeof query.getraenk === "string" ? query.getraenk : null;
  const { from, to } = periodRange(view, date);

  const [{ goalMl, drinks }, entries, days] = await Promise.all([
    getDrinkSetup(user.id),
    getDrinkEntries(user.id, from, to),
    // Serie: höchstens ein Jahr zurück
    getDrinkDays(addDays(today, -366), today),
  ]);
  const streak = goalStreak(new Map(days.map((d) => [d.date, d.ml])), goalMl, today);

  return (
    <DrinkStats
      key={`${view}-${date}`}
      view={view}
      date={date}
      today={today}
      goalMl={goalMl}
      drinks={drinks}
      entries={entries}
      streak={streak}
      initialFilter={filter}
    />
  );
}
