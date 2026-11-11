"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Pill } from "lucide-react";
import { toast } from "sonner";
import { setSupplementActiveAction } from "@/app/(app)/sport/supplemente/actions";
import { EmptyState } from "@/components/layout/empty-state";
import { Switch } from "@/components/ui/switch";
import {
  checkSupplement,
  dailyTotals,
  formatAmount,
  formLabel,
  monthlyCost,
  supplementCost,
  VERDICT_LABEL,
  verdictText,
  worstVerdict,
  type Sex,
  type Supplement,
  type TotalCheck,
} from "@/lib/domain/supplements";
import { cn } from "@/lib/utils";
import { euro, Fab, MedicalNote, SectionTitle, StatTile, ToneBadge, verdictTone } from "./health-parts";
import { SupplementSheet } from "./supplement-sheet";

/**
 * Supplement-Archiv: Kennzahlen (wie viele, Kosten im Monat), Tagessumme aller Stoffe der Supplemente, die man gerade
 * nimmt (mit Abgleich gegen Empfehlung und Obergrenze), und die Liste aller Supplemente (gerade / früher).
 */
export function SupplementView({ supplements, sex }: { supplements: Supplement[]; sex: Sex | null }) {
  const [sheet, setSheet] = useState<{ supplement: Supplement | null } | null>(null);
  const active = supplements.filter((s) => s.active);
  const inactive = supplements.filter((s) => !s.active);
  const totals = dailyTotals(supplements, sex);
  const cost = monthlyCost(supplements);
  const tooMuch = totals.filter((t) => t.verdict === "zu_viel").length;
  const overBfr = totals.filter((t) => t.verdict === "ueber_bfr").length;

  return (
    <>
      {supplements.length === 0 ? (
        <EmptyState icon={Pill} title="Noch keine Supplemente">
          Leg deine Supplemente mit Inhaltsstoffen und Preis an. Die App rechnet zusammen, was du am Tag bekommst, und zeigt, ob es zur Empfehlung passt oder zu viel ist.
        </EmptyState>
      ) : (
        <div className="space-y-7">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatTile label="Nehme ich gerade" value={active.length} sub={inactive.length ? `${inactive.length} im Archiv` : "Supplemente"} />
            <StatTile
              label="Kosten im Monat"
              value={cost.total > 0 ? euro(cost.total) : "–"}
              sub={cost.missing ? `${cost.missing} ohne Preis` : `${euro(cost.total * 12)} im Jahr`}
            />
            <StatTile
              className="col-span-2 md:col-span-1"
              label="Abgleich"
              value={
                <span className={tooMuch ? "text-destructive" : overBfr ? "text-amber-700 dark:text-amber-300" : "text-sport"}>
                  {tooMuch ? `${tooMuch}× zu viel` : overBfr ? `${overBfr}× über BfR` : totals.length ? "Alles im Rahmen" : "–"}
                </span>
              }
              sub={
                tooMuch && overBfr
                  ? `dazu ${overBfr}× über der BfR-Höchstmenge`
                  : `${totals.length} ${totals.length === 1 ? "Stoff" : "Stoffe"} zusammengerechnet`
              }
            />
          </div>

          {totals.length ? (
            <section aria-labelledby="tagessumme">
              <SectionTitle id="tagessumme" aside="aus Supplementen, ohne Ernährung">
                Tagessumme
              </SectionTitle>
              {sex == null ? (
                <p className="mb-3 text-sm text-muted-foreground">
                  Empfehlungen gelten hier für Männer. Für Frauen-Werte das Geschlecht unter{" "}
                  <Link href="/sport/koerper" className="font-medium text-primary underline-offset-4 hover:underline">
                    Körpermaße → Einstellungen
                  </Link>{" "}
                  eintragen.
                </p>
              ) : null}
              <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
                {totals.map((t) => (
                  <TotalRow key={t.nutrient.key} total={t} />
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="archiv">
            <SectionTitle id="archiv">Nehme ich gerade</SectionTitle>
            {active.length ? (
              <ul className="grid gap-3 md:grid-cols-2">
                {active.map((s) => (
                  <SupplementCard key={s.id} supplement={s} sex={sex} onOpen={() => setSheet({ supplement: s })} />
                ))}
              </ul>
            ) : (
              <p className="rounded-3xl border border-dashed p-5 text-center text-sm text-muted-foreground">Gerade nimmst du keins. Schalte eins im Archiv wieder ein.</p>
            )}
          </section>

          {inactive.length ? (
            <section aria-labelledby="frueher">
              <SectionTitle id="frueher">Archiv · nehme ich nicht mehr</SectionTitle>
              <ul className="grid gap-3 md:grid-cols-2">
                {inactive.map((s) => (
                  <SupplementCard key={s.id} supplement={s} sex={sex} onOpen={() => setSheet({ supplement: s })} />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}

      <MedicalNote>
        Empfehlungen nach DGE (sonst EFSA), Obergrenzen nach EFSA, Höchstmengen für Nahrungsergänzung nach BfR; für Erwachsene. Gezählt wird nur, was die Supplemente liefern – die
        Ernährung kommt dazu. Orientierung, keine ärztliche Beratung.
      </MedicalNote>

      <Fab onClick={() => setSheet({ supplement: null })}>Supplement</Fab>
      {sheet ? <SupplementSheet key={sheet.supplement?.id ?? "neu"} supplement={sheet.supplement} sex={sex} onClose={() => setSheet(null)} /> : null}
    </>
  );
}

/** Ein Stoff der Tagessumme: Menge, Balken bis zur Obergrenze, Ergebnis mit Erklärung, Herkunft. */
function TotalRow({ total }: { total: TotalCheck }) {
  const n = total.nutrient;
  const tone = verdictTone(total.verdict);
  const ul = n.ul?.value ?? null;
  // Skala: bis zur Obergrenze (oder doppelte Empfehlung), mindestens bis zur Menge
  const scale = Math.max(ul ?? (total.rec ?? total.amount) * 2, total.amount, total.rec ?? 0) || 1;
  const pct = (v: number) => `${Math.min(100, (v / scale) * 100)}%`;
  return (
    <li className="grid gap-2 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium">{n.label}</span>
        <span className="shrink-0 font-semibold tabular-nums">
          {formatAmount(total.amount)} {n.unit}
          {total.percentOfRec != null ? <span className="ml-1.5 text-sm font-normal text-muted-foreground">{Math.round(total.percentOfRec)} %</span> : null}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-muted" aria-hidden>
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full", tone === "bad" ? "bg-destructive" : tone === "warn" ? "bg-amber-500" : "bg-sport")}
          style={{ width: pct(total.amount) }}
        />
        {total.rec != null ? <span className="absolute -inset-y-1 w-0.5 rounded bg-foreground/50" style={{ left: pct(total.rec) }} /> : null}
        {ul != null ? <span className="absolute -inset-y-1 w-0.5 rounded bg-destructive" style={{ left: `calc(${pct(ul)} - 2px)` }} /> : null}
      </div>
      <p className="text-sm text-muted-foreground">
        <ToneBadge tone={tone} className="mr-1.5 align-[1px]">
          {VERDICT_LABEL[total.verdict]}
        </ToneBadge>
        {verdictText(total)}
        {total.nearLimit ? " Nah an der Obergrenze." : ""}
        {n.hint ? ` ${n.hint}` : ""}
      </p>
      {total.sources.length > 1 ? (
        <p className="text-xs text-muted-foreground tabular-nums">
          Aus {total.sources.map((s) => `${s.name} (${formatAmount(s.amount)} ${n.unit})`).join(" + ")}
        </p>
      ) : null}
    </li>
  );
}

function SupplementCard({ supplement: s, sex, onOpen }: { supplement: Supplement; sex: Sex | null; onOpen: () => void }) {
  const [pending, startTransition] = useTransition();
  const checks = checkSupplement(s, sex);
  const worst = worstVerdict(checks);
  const cost = supplementCost(s);
  const meta = [s.brand, formLabel(s.form), s.shop].filter(Boolean).join(" · ");
  const dosage = `${formatAmount(s.servingsPerDay)}× täglich${s.servingLabel ? ` · ${s.servingLabel}` : ""}`;

  function toggle(value: boolean) {
    startTransition(async () => {
      const result = await setSupplementActiveAction(s.id, value);
      if (!result.ok) toast.error(result.message ?? "Das ging gerade nicht.");
      else toast.success(value ? `${s.name}: nehme ich wieder` : `${s.name} ins Archiv gelegt`);
    });
  }

  return (
    <li className={cn("flex flex-col gap-3 rounded-3xl border bg-card p-4", !s.active && "bg-card/60")}>
      <div className="flex items-start gap-3">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
          <span className="block font-semibold wrap-anywhere">{s.name}</span>
          {meta ? <span className="block text-sm text-muted-foreground">{meta}</span> : null}
          <span className="block text-sm text-muted-foreground tabular-nums">{dosage}</span>
        </button>
        <Switch checked={s.active} disabled={pending} onCheckedChange={toggle} aria-label={s.active ? `${s.name}: nehme ich gerade` : `${s.name}: wieder nehmen`} className="mt-1.5" />
      </div>

      {checks.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {checks.map((c, i) => (
            <li
              key={i}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs tabular-nums",
                c.check?.verdict === "zu_viel" && "border-destructive/40 text-destructive",
                c.check?.verdict === "ueber_bfr" && "border-amber-500/50 text-amber-700 dark:text-amber-300",
              )}
              title={c.check ? verdictText(c.check) : undefined}
            >
              {c.ingredient.name} {formatAmount(c.ingredient.amount)} {c.ingredient.unit}
              {c.check?.percentOfRec != null ? <span className="text-muted-foreground"> · {Math.round(c.check.percentOfRec)} % am Tag</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Noch keine Inhaltsstoffe eingetragen.</p>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground tabular-nums">
          {cost.perMonth != null ? `${euro(cost.perMonth)} / Monat` : s.priceEur != null ? `${euro(s.priceEur)} je Packung` : "Ohne Preis"}
          {cost.packDays != null ? ` · reicht ${Math.floor(cost.packDays)} Tage` : ""}
        </span>
        {worst === "zu_viel" || worst === "ueber_bfr" ? <ToneBadge tone={verdictTone(worst)}>{VERDICT_LABEL[worst]}</ToneBadge> : null}
      </div>
    </li>
  );
}
