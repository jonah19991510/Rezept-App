import type { Metadata } from "next";
import { Coffee, Droplets, Dumbbell, Lightbulb, Sparkles, ThumbsUp, type LucideIcon } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { daysOf, formatLiters, personalTips } from "@/lib/domain/drinks";
import { addDays, todayInBerlin } from "@/lib/domain/week";
import { getDrinkEntries, getDrinkSetup } from "@/lib/server/drinks";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Getränke-Tipps" };

/** Allgemeine Hinweise (Orientierungswerte, keine medizinische Beratung). */
const GENERAL: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Droplets,
    title: "Wie viel trinken?",
    text: "Für Erwachsene gelten etwa 1,5 Liter Getränke am Tag als Richtwert, dazu kommt Wasser aus dem Essen. Bei Hitze, Sport oder Fieber brauchst du deutlich mehr.",
  },
  {
    icon: Dumbbell,
    title: "Beim Training",
    text: "Pro Stunde Sport kommen grob 0,5 bis 1 Liter dazu, je nach Schweiß. Vor dem Training ein großes Glas, währenddessen schluckweise, danach nach Durst.",
  },
  {
    icon: Lightbulb,
    title: "Gleichmäßig über den Tag",
    text: "Das Tempo auf „Heute“ verteilt dein Ziel von 7 bis 21 Uhr. Wer morgens startet und abends weniger trinkt, schläft meist besser durch.",
  },
  {
    icon: Coffee,
    title: "Koffein",
    text: "Bis 400 mg am Tag und bis 200 mg auf einmal gelten für gesunde Erwachsene als unbedenklich (EFSA), in Schwangerschaft und Stillzeit bis 200 mg am Tag. Kaffee zählt in normalen Mengen voll zur Trinkmenge.",
  },
  {
    icon: Sparkles,
    title: "Woran du es merkst",
    text: "Heller, fast farbloser Urin spricht für genug Flüssigkeit, dunkelgelber für zu wenig. Kopfschmerzen und Müdigkeit am Nachmittag sind oft ein erstes Zeichen.",
  },
  {
    icon: Droplets,
    title: "Nicht übertreiben",
    text: "Mehr als etwa einen Liter pro Stunde über mehrere Stunden schafft der Körper nicht auszuscheiden; bei langen Ausdauereinheiten dann auch an Salz denken.",
  },
];

/** Getränketracker, Tab „Tipps“: persönliche Hinweise aus den letzten 14 Tagen und allgemeine Tipps. */
export default async function DrinkTipsPage() {
  const user = await requireUser();
  const today = todayInBerlin();
  const from = addDays(today, -13);
  const [{ goalMl }, entries] = await Promise.all([getDrinkSetup(user.id), getDrinkEntries(user.id, from, today)]);
  const tips = personalTips(entries, daysOf(from, today), goalMl);

  return (
    <div className="space-y-6">
      <section aria-labelledby="fuer-dich" className="space-y-3">
        <h2 id="fuer-dich" className="text-lg font-semibold">
          Für dich
        </h2>
        {tips.length === 0 ? (
          <p className="rounded-3xl border border-dashed p-5 text-sm text-muted-foreground">
            Sobald du an drei Tagen eingetragen hast, stehen hier Hinweise aus deinen eigenen Daten, zum Beispiel zu deinem Tempo, Koffein am Nachmittag oder Zucker aus
            Getränken. Dein Ziel: {formatLiters(goalMl, 1)} am Tag.
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {tips.map((t) => (
              <li key={t.title} className={cn("flex gap-3 rounded-3xl border p-4", t.tone === "good" ? "border-sage/40 bg-sage/10" : "bg-card")}>
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", t.tone === "good" ? "bg-sage/20 text-sage" : "bg-primary/15 text-primary")} aria-hidden>
                  {t.tone === "good" ? <ThumbsUp className="size-5" /> : <Lightbulb className="size-5" />}
                </span>
                <span>
                  <span className="block font-semibold">{t.title}</span>
                  <span className="block text-sm text-muted-foreground">{t.text}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">Aus deinen Einträgen der letzten 14 Tage.</p>
      </section>

      <section aria-labelledby="allgemein" className="space-y-3">
        <h2 id="allgemein" className="text-lg font-semibold">
          Gut zu wissen
        </h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {GENERAL.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3 rounded-3xl border bg-card p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sport-soft text-sport" aria-hidden>
                <Icon className="size-5" />
              </span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="block text-sm text-muted-foreground">{text}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">Orientierungswerte für gesunde Erwachsene, keine medizinische Beratung.</p>
      </section>
    </div>
  );
}
