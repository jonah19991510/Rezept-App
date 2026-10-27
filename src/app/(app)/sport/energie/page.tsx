import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { EnergyCalculator } from "@/components/sport/energy-calculator";
import { requireUser } from "@/lib/auth";
import { normalizeProfile } from "@/lib/domain/energy";
import { getAllGoals } from "@/lib/server/plan";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Energiebedarf" };

/** Energiebedarfsrechner: Grund- und Gesamtumsatz, Tagesziel und Makros; Eingaben im Konto gemerkt. */
export default async function EnergyPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [settings, goals] = await Promise.all([
    supabase.from("user_settings").select("energy_profile").eq("user_id", user.id).maybeSingle(),
    getAllGoals(user.id),
  ]);
  return (
    <>
      <PageHeader title="Energiebedarf" description="Grundumsatz, Gesamtumsatz und Tagesziel aus deinen Angaben." />
      <EnergyCalculator initial={normalizeProfile(settings.data?.energy_profile)} goals={goals} />
    </>
  );
}
