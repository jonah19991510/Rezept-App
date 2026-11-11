import "server-only";
import { normalizeValues, type BloodTest } from "@/lib/domain/blood";
import { normalizeTemperatures, type Checkup, type MedicationIntake, type SickEpisode } from "@/lib/domain/medical";
import { normalizeIngredients, SUPPLEMENT_FORMS, type Supplement, type SupplementForm } from "@/lib/domain/supplements";
import { createClient } from "@/lib/supabase/server";

// Supplemente & Blutwerte, Medizin & Vorsorge lesen (RLS: nur eigene).

const num = (v: unknown) => (v == null ? null : Number(v));

export async function getSupplements(userId: string): Promise<Supplement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supplements")
    .select("id, name, brand, form, serving_label, servings_per_pack, price_eur, shop, servings_per_day, active, ingredients, note")
    .eq("user_id", userId)
    .order("name");
  if (error) throw new Error(`Supplemente konnten nicht geladen werden (${error.code})`);
  return data.map((r) => ({
    id: r.id,
    name: r.name,
    brand: r.brand,
    form: (SUPPLEMENT_FORMS.some((f) => f.value === r.form) ? r.form : "sonstiges") as SupplementForm,
    servingLabel: r.serving_label,
    servingsPerPack: num(r.servings_per_pack),
    priceEur: num(r.price_eur),
    shop: r.shop,
    servingsPerDay: Number(r.servings_per_day),
    active: r.active,
    ingredients: normalizeIngredients(r.ingredients),
    note: r.note,
  }));
}

/** Bluttests, neueste zuerst. */
export async function getBloodTests(userId: string): Promise<BloodTest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blood_tests")
    .select("id, taken_on, lab, results, note")
    .eq("user_id", userId)
    .order("taken_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Bluttests konnten nicht geladen werden (${error.code})`);
  return data.map((r) => ({ id: r.id, date: r.taken_on, lab: r.lab, note: r.note, values: normalizeValues(r.results) }));
}

/** Krankheiten, neueste zuerst. */
export async function getSickEpisodes(userId: string): Promise<SickEpisode[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sick_episodes")
    .select("id, title, started_on, ended_on, symptoms, sick_note, temperatures, note")
    .eq("user_id", userId)
    .order("started_on", { ascending: false });
  if (error) throw new Error(`Krankheitstage konnten nicht geladen werden (${error.code})`);
  return data.map((r) => ({
    id: r.id,
    title: r.title,
    start: r.started_on,
    end: r.ended_on,
    symptoms: r.symptoms ?? [],
    sickNote: r.sick_note,
    temperatures: normalizeTemperatures(r.temperatures),
    note: r.note,
  }));
}

/** Medikamenten-Einnahmen, neueste zuerst. */
export async function getMedicationIntakes(userId: string): Promise<MedicationIntake[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medication_intakes")
    .select("id, name, dose, taken_on, taken_time, reason, episode_id, note")
    .eq("user_id", userId)
    .order("taken_on", { ascending: false })
    .order("taken_time", { ascending: false, nullsFirst: false })
    .limit(1000);
  if (error) throw new Error(`Medikamente konnten nicht geladen werden (${error.code})`);
  return data.map((r) => ({
    id: r.id,
    name: r.name,
    dose: r.dose,
    date: r.taken_on,
    time: r.taken_time ? r.taken_time.slice(0, 5) : null,
    reason: r.reason,
    episodeId: r.episode_id,
    note: r.note,
  }));
}

/** Vorsorge-Untersuchungen mit ihren Besuchen (neueste zuerst). */
export async function getCheckups(userId: string): Promise<Checkup[]> {
  const supabase = await createClient();
  const [checkups, visits] = await Promise.all([
    supabase.from("checkups").select("id, name, doctor, interval_months, next_on, note").eq("user_id", userId).order("name"),
    supabase.from("checkup_visits").select("id, checkup_id, visited_on, note").eq("user_id", userId).order("visited_on", { ascending: false }),
  ]);
  if (checkups.error || visits.error) throw new Error(`Vorsorge konnte nicht geladen werden (${(checkups.error ?? visits.error)!.code})`);
  return checkups.data.map((c) => ({
    id: c.id,
    name: c.name,
    doctor: c.doctor,
    intervalMonths: c.interval_months,
    nextOn: c.next_on,
    note: c.note,
    visits: visits.data.filter((v) => v.checkup_id === c.id).map((v) => ({ id: v.id, date: v.visited_on, note: v.note })),
  }));
}
