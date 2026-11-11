import type { Metadata } from "next";
import { SupplementView } from "@/components/sport/health/supplement-view";
import { requireUser } from "@/lib/auth";
import { getBodySettings } from "@/lib/server/body";
import { getSupplements } from "@/lib/server/health";

export const metadata: Metadata = { title: "Supplemente" };

/** Supplement-Archiv mit Inhaltsstoffen, Preisen und Abgleich gegen Empfehlung und Obergrenze. */
export default async function SupplementsPage() {
  const user = await requireUser();
  const [supplements, settings] = await Promise.all([getSupplements(user.id), getBodySettings(user.id)]);
  return <SupplementView supplements={supplements} sex={settings.sex} />;
}
