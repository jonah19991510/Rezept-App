import type { Metadata } from "next";
import { BodyTracker } from "@/components/sport/body/body-tracker";
import { requireUser } from "@/lib/auth";
import { todayInBerlin } from "@/lib/domain/week";
import { getBodySettings, getMeasurements } from "@/lib/server/body";

export const metadata: Metadata = { title: "Körpermaße" };

/** Körpermaße: Gewicht und Umfänge mit Übersicht, Diagrammen und Verlauf. */
export default async function BodyPage() {
  const user = await requireUser();
  const [measurements, { settings, sex }] = await Promise.all([getMeasurements(user.id), getBodySettings(user.id)]);
  return <BodyTracker measurements={measurements} settings={settings} sex={sex} today={todayInBerlin()} />;
}
