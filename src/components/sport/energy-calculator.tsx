"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { CircleAlert, Target } from "lucide-react";
import { toast } from "sonner";
import { saveGoalsAction } from "@/app/(app)/einstellungen/actions";
import { saveEnergyProfileAction } from "@/app/(app)/sport/energie/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatDecimalInput, parseDecimal } from "@/lib/domain/decimal";
import {
  calculateEnergy,
  FORMULA_OPTIONS,
  formulaReason,
  GOAL_OPTIONS,
  LIMITS,
  palDescription,
  SPORT_OPTIONS,
  type EnergyProfile,
  type FormulaKey,
  type GoalKey,
  type Sex,
} from "@/lib/domain/energy";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type Goals = { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null };

/** Zahlenfelder als Text (Eingabe mit Komma), der Rest direkt. */
type Form = {
  sex: Sex;
  age: string;
  heightCm: string;
  weightKg: string;
  bodyFat: string;
  pal: number;
  sport: number;
  goal: GoalKey;
  customKcal: string;
  targetWeightKg: string;
  proteinPerKg: string;
  fatPercent: string;
  formula: FormulaKey;
};

const NUMBER_FIELDS = ["age", "heightCm", "weightKg", "bodyFat", "customKcal", "targetWeightKg", "proteinPerKg", "fatPercent"] as const;
type NumberField = (typeof NUMBER_FIELDS)[number];
const OPTIONAL: NumberField[] = ["bodyFat", "targetWeightKg"];

function toForm(p: EnergyProfile): Form {
  const s = (v: number | null, digits = 1) => (v == null ? "" : formatDecimalInput(v, digits));
  return {
    ...p,
    age: s(p.age, 0),
    heightCm: s(p.heightCm, 0),
    weightKg: s(p.weightKg),
    bodyFat: s(p.bodyFat),
    customKcal: s(p.customKcal, 0),
    targetWeightKg: s(p.targetWeightKg),
    proteinPerKg: s(p.proteinPerKg),
    fatPercent: s(p.fatPercent, 0),
  };
}

/** Eingaben prüfen: gültiges Profil oder die Felder mit Fehlern. */
function parseForm(form: Form): { profile: EnergyProfile | null; invalid: Set<NumberField> } {
  const invalid = new Set<NumberField>();
  const values = {} as Record<NumberField, number | null>;
  for (const key of NUMBER_FIELDS) {
    const raw = form[key].trim();
    const optional = OPTIONAL.includes(key) || (key === "customKcal" && form.goal !== "eigen");
    if (raw === "") {
      values[key] = null;
      if (!optional) invalid.add(key);
      continue;
    }
    const n = parseDecimal(raw);
    const [min, max] = LIMITS[key];
    if (n == null || n < min || n > max) invalid.add(key);
    values[key] = n;
  }
  if (invalid.size > 0) return { profile: null, invalid };
  return {
    profile: {
      sex: form.sex,
      age: values.age!,
      heightCm: values.heightCm!,
      weightKg: values.weightKg!,
      bodyFat: values.bodyFat,
      pal: form.pal,
      sport: form.sport,
      goal: form.goal,
      customKcal: form.goal === "eigen" ? values.customKcal : null,
      targetWeightKg: values.targetWeightKg,
      proteinPerKg: values.proteinPerKg!,
      fatPercent: values.fatPercent!,
      formula: form.formula,
    },
    invalid,
  };
}

const kcal = (v: number) => formatNumber(Math.round(v), 0);
const pal = (v: number) => new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const signed = (v: number, text: string) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${text}`;

/**
 * Energiebedarfsrechner: links die Eingaben, rechts Grundumsatz, Gesamtumsatz und Tagesziel, die Formeln im
 * Vergleich und die Makronährstoffe. Eingaben werden im Konto gemerkt; das Ergebnis lässt sich als Tagesziel für den
 * Wochenplan übernehmen.
 */
export function EnergyCalculator({ initial, goals }: { initial: EnergyProfile; goals: { default: Goals; training: Goals } }) {
  const [form, setForm] = useState<Form>(() => toForm(initial));
  const { profile, invalid } = useMemo(() => parseForm(form), [form]);
  // Letztes gültiges Ergebnis stehen lassen, während ein Feld gerade bearbeitet wird
  const [lastValid, setLastValid] = useState(initial);
  if (profile && profile !== lastValid) setLastValid(profile);
  const shown = profile ?? lastValid;
  const result = useMemo(() => calculateEnergy(shown), [shown]);
  const [goalOpen, setGoalOpen] = useState(false);

  // Eingaben gebremst im Konto speichern
  const savedJson = useRef(JSON.stringify(initial));
  useEffect(() => {
    if (!profile) return;
    const json = JSON.stringify(profile);
    if (json === savedJson.current) return;
    const timer = setTimeout(() => {
      savedJson.current = json;
      void saveEnergyProfileAction(profile).then((r) => {
        if (!r.ok) toast.error("Die Eingaben konnten nicht gespeichert werden.");
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [profile]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const totalPal = Math.round((form.pal + form.sport) * 100) / 100;
  const maxFormula = Math.max(...result.formulas.map((f) => (f.value ?? 0) * 1.1));

  return (
    // Zeilen „auto, 1fr“: die Kennzahlen sind so hoch wie nötig, der Rest rückt direkt darunter
    <div className="grid gap-6 md:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] md:grid-rows-[auto_1fr] md:items-start">
      {/* Kennzahlen: am Handy oben, am Desktop rechts oben */}
      <section className="overflow-hidden rounded-3xl border bg-card md:col-start-2 md:row-start-1" aria-label="Ergebnis">
        <div className="grid grid-cols-2 lg:grid-cols-3">
          <Kpi label="Grundumsatz" value={kcal(result.bmr)} sub={result.formulas.find((f) => f.key === result.used)?.label ?? ""} />
          <Kpi label="Gesamtumsatz" value={kcal(result.tdee)} sub={`Grundumsatz × PAL ${pal(result.palTotal)}`} className="border-l" />
          <div className="col-span-2 border-t bg-sage/10 p-4 lg:col-span-1 lg:border-t-0 lg:border-l">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Dein Tagesziel</p>
            <p className="font-heading text-3xl font-semibold text-sage tabular-nums md:text-4xl">{kcal(result.target)}</p>
            <p className="text-sm text-muted-foreground tabular-nums">
              {signed(Math.round(result.diff), `${kcal(Math.abs(result.diff))} kcal`)}
              {Math.abs(result.kgPerWeek) >= 0.01 ? ` · ca. ${signed(result.kgPerWeek, `${formatNumber(Math.abs(result.kgPerWeek), 2)} kg/Woche`)}` : ""}
            </p>
          </div>
        </div>
        <div className="flex justify-end border-t p-3">
          <Button type="button" variant="outline" className="h-11 w-full rounded-full sm:w-auto" onClick={() => setGoalOpen(true)} disabled={!profile}>
            <Target aria-hidden />
            Als Tagesziel übernehmen
          </Button>
        </div>
      </section>

      <form className="space-y-5 rounded-3xl border bg-card p-4 md:col-start-1 md:row-span-2 md:row-start-1 md:p-5" onSubmit={(e) => e.preventDefault()} aria-label="Deine Angaben">
        <Field label="Geschlecht">
          <div className="grid grid-cols-2 rounded-full border bg-background p-0.5" role="group" aria-label="Geschlecht">
            {(["m", "w"] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={form.sex === s}
                onClick={() => set("sex", s)}
                className={cn(
                  "h-11 rounded-full text-sm font-medium text-muted-foreground transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  form.sex === s && "bg-sport text-sport-foreground",
                )}
              >
                {s === "m" ? "Männlich" : "Weiblich"}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <NumberInput id="e-age" label="Alter" unit="J" value={form.age} onChange={(v) => set("age", v)} invalid={invalid.has("age")} numeric hint="18–100" />
          <NumberInput id="e-height" label="Größe" unit="cm" value={form.heightCm} onChange={(v) => set("heightCm", v)} invalid={invalid.has("heightCm")} numeric />
          <NumberInput id="e-weight" label="Gewicht" unit="kg" value={form.weightKg} onChange={(v) => set("weightKg", v)} invalid={invalid.has("weightKg")} />
          <NumberInput id="e-fat" label="Körperfett" unit="%" placeholder="optional" value={form.bodyFat} onChange={(v) => set("bodyFat", v)} invalid={invalid.has("bodyFat")} />
        </div>
        {invalid.has("age") ? <p className="-mt-3 text-sm text-destructive">Die Formeln gelten für Erwachsene von 18 bis 100 Jahren.</p> : null}

        <Field label="Alltagsaktivität (PAL)" aside={<span className="font-semibold text-foreground tabular-nums">{formatNumber(form.pal, 2)}</span>} htmlFor="e-pal">
          <input
            id="e-pal"
            type="range"
            min={LIMITS.pal[0]}
            max={LIMITS.pal[1]}
            step={0.05}
            value={form.pal}
            onChange={(e) => set("pal", Number(e.target.value))}
            className="h-11 w-full accent-sport"
            aria-valuetext={`PAL ${formatNumber(form.pal, 2)}: ${palDescription(form.pal)}`}
          />
          <p className="text-sm text-muted-foreground">{palDescription(form.pal)}</p>
        </Field>

        <Field label="Sport zusätzlich" htmlFor="e-sport">
          <NativeSelect id="e-sport" value={String(form.sport)} onChange={(e) => set("sport", Number(e.target.value))}>
            {SPORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
          <p className="text-sm text-muted-foreground">Wird auf den Alltags-PAL addiert. Die DGE rechnet für 4–5 Einheiten pro Woche mit +0,3.</p>
          <p className="text-sm font-semibold">
            {form.sport > 0
              ? `Mit Sport-Zuschlag: PAL ${pal(form.pal)} + ${formatNumber(form.sport, 1)} = ${pal(totalPal)} für den Gesamtumsatz.`
              : `Ohne Sport-Zuschlag: PAL ${pal(form.pal)} für den Gesamtumsatz.`}
          </p>
        </Field>

        <Field label="Ziel" htmlFor="e-goal">
          <NativeSelect
            id="e-goal"
            value={form.goal}
            onChange={(e) => {
              const goal = e.target.value as GoalKey;
              // Beim Wechsel auf „Eigenes Ziel“ mit dem aktuellen Ziel vorbelegen
              setForm((f) => ({ ...f, goal, customKcal: goal === "eigen" && f.customKcal === "" ? String(Math.round(result.target / 50) * 50) : f.customKcal }));
            }}
          >
            {GOAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </Field>

        {form.goal === "eigen" ? (
          <div className="space-y-1.5">
            <NumberInput id="e-kcal" label="Dein Kalorienziel" unit="kcal" value={form.customKcal} onChange={(v) => set("customKcal", v)} invalid={invalid.has("customKcal")} numeric />
            <p className="text-sm text-muted-foreground tabular-nums">
              Gesamtumsatz {kcal(result.tdee)} kcal –{" "}
              {Math.abs(result.diff) < 1
                ? "dein Ziel entspricht genau dem Bedarf."
                : `dein Ziel liegt ${kcal(Math.abs(result.diff))} kcal ${result.diff < 0 ? "darunter" : "darüber"} (${formatNumber(Math.abs(Math.round(result.diffPercent)), 0)} % ${result.diff < 0 ? "Defizit" : "Überschuss"}).`}
            </p>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <NumberInput
            id="e-target"
            label="Ideal- bzw. Wunschgewicht"
            unit="kg"
            placeholder={form.weightKg || "optional"}
            value={form.targetWeightKg}
            onChange={(v) => set("targetWeightKg", v)}
            invalid={invalid.has("targetWeightKg")}
          />
          <p className="text-sm text-muted-foreground">Danach richtet sich dein Proteinbedarf. Leer lassen = aktuelles Gewicht.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumberInput id="e-protein" label="Protein pro kg" unit="g/kg" value={form.proteinPerKg} onChange={(v) => set("proteinPerKg", v)} invalid={invalid.has("proteinPerKg")} />
          <NumberInput id="e-fatpct" label="Fett-Anteil" unit="%" value={form.fatPercent} onChange={(v) => set("fatPercent", v)} invalid={invalid.has("fatPercent")} numeric />
        </div>

        <Field label="Formel für den Grundumsatz" htmlFor="e-formula">
          <NativeSelect id="e-formula" value={form.formula} onChange={(e) => set("formula", e.target.value as FormulaKey)}>
            {FORMULA_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} disabled={o.value === "katch" && form.bodyFat.trim() === ""}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
          {form.formula === "auto" ? <p className="text-sm text-muted-foreground">{formulaReason(shown)}</p> : null}
        </Field>

        {!profile ? <p className="rounded-2xl bg-destructive/10 p-3 text-sm">Bitte prüfe die rot markierten Felder. Bis dahin bleibt das letzte Ergebnis stehen.</p> : null}
      </form>

      <div className="space-y-6 md:col-start-2 md:row-start-2">
        {result.warnings.length > 0 ? (
          <ul className="space-y-2">
            {result.warnings.map((w) => (
              <li key={w} className="flex gap-2 rounded-2xl border border-macro-carbs/40 bg-macro-carbs/10 p-3 text-sm">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-macro-carbs" aria-hidden />
                {w}
              </li>
            ))}
          </ul>
        ) : null}

        <section className="rounded-3xl border bg-card p-4 md:p-5" aria-labelledby="formeln">
          <h2 id="formeln" className="text-lg font-semibold">
            Formeln im Vergleich
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Grundumsatz nach jeder Formel mit deinen Daten. Die helle Spanne zeigt, wie unsicher jede Schätzung ist: Einzelne Menschen weichen oft um ±10 % ab.
          </p>
          <ul className="space-y-3">
            {result.formulas.map((f) => (
              <li key={f.key} className={cn("grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_3.5rem] items-center gap-3", f.value == null && "opacity-50")}>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{f.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {f.active ? <span className="font-semibold text-sage uppercase">aktiv · </span> : null}
                    {f.sub}
                  </span>
                </span>
                <span className="relative h-2.5 rounded-full bg-muted" aria-hidden>
                  {f.value != null ? (
                    <>
                      {/* Spanne ±10 % */}
                      <span
                        className={cn("absolute inset-y-0 rounded-full", f.active ? "bg-sage/30" : "bg-muted-foreground/20")}
                        style={{ left: `${((f.value * 0.9) / maxFormula) * 100}%`, width: `${((f.value * 0.2) / maxFormula) * 100}%` }}
                      />
                      <span className={cn("absolute inset-y-0 left-0 rounded-full", f.active ? "bg-sage" : "bg-muted-foreground/60")} style={{ width: `${(f.value / maxFormula) * 100}%` }} />
                    </>
                  ) : null}
                </span>
                <span className="text-right font-semibold tabular-nums">{f.value != null ? kcal(f.value) : "–"}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border bg-card p-4 md:p-5" aria-labelledby="makros">
          <h2 id="makros" className="text-lg font-semibold">
            Makronährstoffe
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Protein mit {formatNumber(shown.proteinPerKg, 1)} g pro kg {shown.targetWeightKg != null ? `Wunschgewicht (${formatNumber(result.proteinWeightKg, 1)} kg)` : `Körpergewicht (${formatNumber(result.proteinWeightKg, 1)} kg)`},
            Fett mit {formatNumber(shown.fatPercent, 0)} % der Energie, der Rest als Kohlenhydrate.
          </p>
          <div className="flex h-4 overflow-hidden rounded-full bg-muted" aria-hidden>
            <span className="bg-macro-protein" style={{ width: `${result.protein.share}%` }} />
            <span className="bg-macro-fat" style={{ width: `${result.fat.share}%` }} />
            <span className="bg-macro-carbs" style={{ width: `${result.carbs.share}%` }} />
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-3">
            <Macro label="Protein" color="bg-macro-protein" grams={result.protein.grams} sub={`${kcal(result.protein.kcal)} kcal · ${result.protein.share} % · ${formatNumber(shown.proteinPerKg, 1)} g/kg`} />
            <Macro label="Fett" color="bg-macro-fat" grams={result.fat.grams} sub={`${kcal(result.fat.kcal)} kcal · ${result.fat.share} %`} />
            <Macro label="Kohlenhydrate" color="bg-macro-carbs" grams={result.carbs.grams} sub={`${kcal(result.carbs.kcal)} kcal · ${result.carbs.share} % · ${formatNumber(result.carbsPerKg, 1)} g/kg`} />
          </dl>
        </section>

        <details className="group rounded-3xl border bg-card p-4 md:p-5">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Formeln und Quellen</summary>
          <div className="mt-2 space-y-3 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">Mifflin-St Jeor</strong> (Mifflin u. a., 1990): 10 × Gewicht + 6,25 × Größe in cm − 5 × Alter, + 5 bei Männern
              bzw. − 161 bei Frauen. Gilt in Studien als genaueste Schätzung für die meisten Erwachsenen.
            </p>
            <p>
              <strong className="text-foreground">Henry / Oxford</strong> (Henry, 2005): getrennt nach Geschlecht und Altersgruppe (18–29, 30–59, ab 60) aus Gewicht
              und Größe, in MJ gerechnet. Grundlage der Referenzwerte der EFSA.
            </p>
            <p>
              <strong className="text-foreground">Katch-McArdle</strong>: 370 + 21,6 × fettfreie Masse in kg. Braucht einen verlässlichen Körperfettwert
              (Körperfettwaagen schätzen oft mehrere Prozentpunkte daneben).
            </p>
            <p>
              <strong className="text-foreground">Gesamtumsatz</strong> = Grundumsatz × PAL. PAL-Werte und der Sport-Zuschlag von +0,3 für 4–5 Einheiten pro Woche
              nach den Referenzwerten der DGE; die anderen Zuschläge sind Abstufungen davon.
            </p>
            <p>
              <strong className="text-foreground">Gewicht pro Woche</strong>: grob 7.700 kcal je kg Körperfett. Wasser, Glykogen und Anpassungen des Körpers machen
              die Waage in den ersten Wochen unruhiger.
            </p>
            <p>
              <strong className="text-foreground">Makros</strong>: Protein 4 kcal/g, Kohlenhydrate 4 kcal/g, Fett 9 kcal/g. Für Muskelaufbau und beim Abnehmen werden
              meist 1,6–2,2 g Protein pro kg empfohlen, die DGE nennt 0,8 g als Mindestmaß.
            </p>
            <p>Alles sind Schätzungen für gesunde Erwachsene. Nach 2–3 Wochen zeigt der Verlauf deines Gewichts, ob du das Ziel anpassen solltest.</p>
          </div>
        </details>
      </div>

      <TakeOverDialog open={goalOpen} onOpenChange={setGoalOpen} goals={goals} next={{ kcal: result.target, protein: result.protein.grams, carbs: result.carbs.grams, fat: result.fat.grams }} />
    </div>
  );
}

function Kpi({ label, value, sub, className }: { label: string; value: string; sub: string; className?: string }) {
  return (
    <div className={cn("p-4", className)}>
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="font-heading text-3xl font-semibold tabular-nums md:text-4xl">{value}</p>
      <p className="text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}

function Macro({ label, color, grams, sub }: { label: string; color: string; grams: number; sub: string }) {
  return (
    <div className="min-w-0">
      <span className={cn("mb-2 block h-1 rounded-full", color)} aria-hidden />
      <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="font-heading text-2xl font-semibold tabular-nums">{grams} g</dd>
      <dd className="text-xs text-muted-foreground tabular-nums">{sub}</dd>
    </div>
  );
}

function Field({ label, aside, htmlFor, children }: { label: string; aside?: ReactNode; htmlFor?: string; children: ReactNode }) {
  const Tag = htmlFor ? "label" : "p";
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <Tag htmlFor={htmlFor} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {label}
        </Tag>
        {aside}
      </div>
      {children}
    </div>
  );
}

function NumberInput({
  id,
  label,
  unit,
  value,
  onChange,
  invalid,
  numeric,
  placeholder,
  hint,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  numeric?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          inputMode={numeric ? "numeric" : "decimal"}
          value={value}
          placeholder={placeholder}
          title={hint}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid}
          className="h-12 pr-12 text-base tabular-nums"
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

/** Ergebnis als Tagesziel des Wochenplans übernehmen: für alle Tage oder nur für Trainingstage. */
function TakeOverDialog({
  open,
  onOpenChange,
  goals,
  next,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goals: { default: Goals; training: Goals };
  next: { kcal: number; protein: number; carbs: number; fat: number };
}) {
  const [type, setType] = useState<"default" | "training">("default");
  const [pending, startTransition] = useTransition();
  const current = goals[type];
  const rows: { label: string; unit: string; key: keyof Goals }[] = [
    { label: "Kalorien", unit: "kcal", key: "kcal" },
    { label: "Protein", unit: "g", key: "protein" },
    { label: "Kohlenhydrate", unit: "g", key: "carbs" },
    { label: "Fett", unit: "g", key: "fat" },
  ];

  function save() {
    startTransition(async () => {
      const result = await saveGoalsAction({ kcal: Math.round(next.kcal), protein: next.protein, carbs: next.carbs, fat: next.fat }, type);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(type === "default" ? "Tagesziel übernommen" : "Ziel für Trainingstage übernommen");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Als Tagesziel übernehmen</DialogTitle>
          <DialogDescription>Der Wochenplan vergleicht deine geplanten Mahlzeiten mit diesem Ziel.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 rounded-full border bg-background p-0.5" role="group" aria-label="Für welche Tage">
          {(["default", "training"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => setType(t)}
              className={cn("h-11 rounded-full text-sm font-medium text-muted-foreground transition", type === t && "bg-primary/15 text-primary")}
            >
              {t === "default" ? "Alle Tage" : "Trainingstage"}
            </button>
          ))}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="py-1.5 text-left font-medium" />
              <th className="py-1.5 text-right font-medium">bisher</th>
              <th className="py-1.5 text-right font-medium">neu</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b last:border-0">
                <td className="py-1.5">{r.label}</td>
                <td className="py-1.5 text-right text-muted-foreground tabular-nums">{current[r.key] != null ? `${formatNumber(current[r.key]!, 0)} ${r.unit}` : "–"}</td>
                <td className="py-1.5 text-right font-semibold tabular-nums">
                  {formatNumber(Math.round(next[r.key]), 0)} {r.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="button" onClick={save} disabled={pending}>
            Übernehmen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
