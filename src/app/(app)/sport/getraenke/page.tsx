import type { Metadata } from "next";
import { TodayView } from "@/components/sport/drinks/today-view";
import { requireUser } from "@/lib/auth";
import { berlinParts } from "@/lib/domain/workout";
import { todayInBerlin } from "@/lib/domain/week";
import { getDrinkEntries, getDrinkSetup } from "@/lib/server/drinks";

export const metadata: Metadata = { title: "Getränke" };

/** Getränketracker, Tab „Heute“. */
export default async function DrinksTodayPage() {
  const user = await requireUser();
  const today = todayInBerlin();
  const [{ goalMl, drinks }, entries] = await Promise.all([getDrinkSetup(user.id), getDrinkEntries(user.id, today, today)]);
  const [h, m] = berlinParts(new Date().toISOString()).time.split(":").map(Number);
  return <TodayView goalMl={goalMl} drinks={drinks} entries={entries} today={today} initialMinutes={h * 60 + m} />;
}
