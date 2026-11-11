import type { Metadata } from "next";
import { BloodView } from "@/components/sport/health/blood-view";
import { requireUser } from "@/lib/auth";
import { todayInBerlin } from "@/lib/domain/week";
import { getBodySettings } from "@/lib/server/body";
import { getBloodTests } from "@/lib/server/health";

export const metadata: Metadata = { title: "Blutwerte" };

/** Blutwerte-Archiv: Bluttests mit Werten, Einordnung und Veränderungen zwischen den Tests. */
export default async function BloodPage() {
  const user = await requireUser();
  const [tests, settings] = await Promise.all([getBloodTests(user.id), getBodySettings(user.id)]);
  return <BloodView tests={tests} sex={settings.sex} today={todayInBerlin()} />;
}
