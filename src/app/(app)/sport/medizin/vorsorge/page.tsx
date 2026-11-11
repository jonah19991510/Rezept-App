import type { Metadata } from "next";
import { CheckupView } from "@/components/sport/health/checkup-view";
import { requireUser } from "@/lib/auth";
import { todayInBerlin } from "@/lib/domain/week";
import { getCheckups } from "@/lib/server/health";

export const metadata: Metadata = { title: "Vorsorge" };

/** Vorsorge: Untersuchungen mit letztem Besuch und nächstem Termin. */
export default async function CheckupPage() {
  const user = await requireUser();
  const checkups = await getCheckups(user.id);
  return <CheckupView checkups={checkups} today={todayInBerlin()} />;
}
