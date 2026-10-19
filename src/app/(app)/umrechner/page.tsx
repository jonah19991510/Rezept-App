import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { UnitConverter } from "@/components/tools/unit-converter";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Einheiten-Umrechner" };

/** Kleines Werkzeug: amerikanische Mengen und °F in metrische Angaben. */
export default async function ConverterPage() {
  await requireUser();
  const supabase = await createClient();
  // Zutaten mit hinterlegter Dichte aus dem Grundbestand (für cup → Gramm)
  const { data } = await supabase
    .from("ingredients")
    .select("id, name, density_g_per_ml")
    .eq("source", "seed")
    .not("density_g_per_ml", "is", null)
    .order("name");

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Einheiten-Umrechner" description="Amerikanische Mengen und Temperaturen in Gramm, Milliliter und °C." />
      <UnitConverter
        ingredients={(data ?? []).flatMap((i) => (i.density_g_per_ml ? [{ id: i.id, name: i.name, density: i.density_g_per_ml }] : []))}
      />
    </div>
  );
}
