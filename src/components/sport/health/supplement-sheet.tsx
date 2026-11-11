"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteSupplementAction, saveSupplementAction } from "@/app/(app)/sport/supplemente/actions";
import { choiceChipClass, EditorSheet, FieldHeading } from "@/components/recipes/editor/editor-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatDecimalInput, parseDecimal } from "@/lib/domain/decimal";
import {
  AMOUNT_UNITS,
  checkNutrient,
  formatAmount,
  matchNutrient,
  NUTRIENTS,
  nutrientOf,
  SUPPLEMENT_FORMS,
  supplementCost,
  toNutrientUnit,
  VERDICT_LABEL,
  type AmountUnit,
  type Ingredient,
  type Sex,
  type Supplement,
  type SupplementForm,
} from "@/lib/domain/supplements";
import { euro, Field, ToneBadge, UnitInput, verdictTone } from "./health-parts";

const OTHER = "__anderer";

type Row = { key: number; nutrient: string; name: string; amount: string; unit: AmountUnit };
type Form = {
  name: string;
  brand: string;
  form: SupplementForm;
  servingLabel: string;
  servingsPerPack: string;
  priceEur: string;
  shop: string;
  servingsPerDay: string;
  active: boolean;
  rows: Row[];
  note: string;
};

let nextKey = 1;

function formFrom(s: Supplement | null): Form {
  return {
    name: s?.name ?? "",
    brand: s?.brand ?? "",
    form: s?.form ?? "kapsel",
    servingLabel: s?.servingLabel ?? "",
    servingsPerPack: s?.servingsPerPack != null ? formatDecimalInput(s.servingsPerPack, 1) : "",
    priceEur: s?.priceEur != null ? formatDecimalInput(s.priceEur, 2) : "",
    shop: s?.shop ?? "",
    servingsPerDay: formatDecimalInput(s?.servingsPerDay ?? 1, 2),
    active: s?.active ?? true,
    rows: (s?.ingredients ?? []).map((i) => ({ key: nextKey++, nutrient: i.nutrient ?? OTHER, name: i.nutrient ? "" : i.name, amount: formatDecimalInput(i.amount, 3), unit: i.unit })),
    note: s?.note ?? "",
  };
}

const emptyRow = (): Row => ({ key: nextKey++, nutrient: "", name: "", amount: "", unit: "mg" });

/**
 * Supplement anlegen oder bearbeiten: Name, Marke, Form, Portion, Einnahme pro Tag, Packung und Preis, Inhaltsstoffe
 * je Portion (bekannter Stoff mit Abgleich oder freier Name), „Nehme ich gerade“, Notiz.
 */
export function SupplementSheet({ supplement, sex, onClose }: { supplement: Supplement | null; sex: Sex | null; onClose: () => void }) {
  const [open, setOpen] = useState(true);
  const [form, setForm] = useState<Form>(() => formFrom(supplement));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setRow = (key: number, patch: Partial<Row>) => setForm((f) => ({ ...f, rows: f.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));
  const err = (key: string) => errors[key]?.[0];

  const perDay = parseDecimal(form.servingsPerDay) ?? 0;
  const cost = supplementCost({ priceEur: parseDecimal(form.priceEur), servingsPerPack: parseDecimal(form.servingsPerPack), servingsPerDay: perDay });

  function close() {
    setOpen(false);
    setTimeout(onClose, 300);
  }

  function chooseNutrient(row: Row, value: string) {
    const n = nutrientOf(value);
    setRow(row.key, { nutrient: value, unit: n ? (n.unit as AmountUnit) : row.unit });
  }

  /** Freien Namen erkennen („D3“ → Vitamin D). */
  function nameBlur(row: Row) {
    const n = matchNutrient(row.name);
    if (n) {
      setRow(row.key, { nutrient: n.key, name: "", unit: row.amount ? row.unit : (n.unit as AmountUnit) });
      toast(`Als „${n.label}“ erkannt`);
    }
  }

  function save() {
    const num = (v: string) => (v.trim() === "" ? null : parseDecimal(v));
    const bad = (field: string, message = "Bitte eine Zahl eingeben.") => {
      setErrors({ [field]: [message] });
      toast.error(message);
    };
    for (const [field, value] of [
      ["servingsPerPack", form.servingsPerPack],
      ["priceEur", form.priceEur],
      ["servingsPerDay", form.servingsPerDay],
    ] as const) {
      if (value.trim() !== "" && num(value) == null) return bad(field);
    }
    const rows = form.rows.filter((r) => r.nutrient || r.name.trim() || r.amount.trim());
    const ingredients: Ingredient[] = [];
    for (const r of rows) {
      const n = nutrientOf(r.nutrient);
      const amount = num(r.amount);
      if (!n && !r.name.trim()) return bad(`row-${r.key}`, "Bitte einen Inhaltsstoff wählen oder eintragen.");
      if (amount == null) return bad(`row-${r.key}`, "Bitte eine Menge je Portion eintragen.");
      if (n && r.unit === "IE" && n.perIU == null) return bad(`row-${r.key}`, `${n.label} lässt sich nicht in IE angeben.`);
      ingredients.push({ nutrient: n?.key ?? null, name: n?.label ?? r.name.trim(), amount, unit: r.unit });
    }
    startTransition(async () => {
      const result = await saveSupplementAction(supplement?.id ?? null, {
        name: form.name,
        brand: form.brand || null,
        form: form.form,
        servingLabel: form.servingLabel || null,
        servingsPerPack: num(form.servingsPerPack),
        priceEur: num(form.priceEur),
        shop: form.shop || null,
        servingsPerDay: num(form.servingsPerDay) ?? 1,
        active: form.active,
        ingredients,
        note: form.note || null,
      });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message ?? "Bitte prüfe die Eingaben.");
        return;
      }
      toast.success(supplement ? "Supplement gespeichert" : "Supplement angelegt");
      close();
    });
  }

  function remove() {
    if (!supplement) return;
    startTransition(async () => {
      const result = await deleteSupplementAction(supplement.id);
      if (!result.ok) {
        toast.error(result.message ?? "Löschen ging nicht.");
        return;
      }
      toast.success("Supplement gelöscht");
      close();
    });
  }

  return (
    <EditorSheet
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : close())}
      title={supplement ? "Supplement bearbeiten" : "Neues Supplement"}
      description="Angaben je Portion stehen auf der Packung (Nährwerttabelle)."
      footer={
        <>
          {supplement ? (
            confirmDelete ? (
              <>
                <Button type="button" variant="destructive" size="lg" onClick={remove} disabled={pending} className="flex-1">
                  Wirklich löschen
                </Button>
                <Button type="button" variant="outline" size="lg" onClick={() => setConfirmDelete(false)}>
                  Abbrechen
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" size="icon-lg" onClick={() => setConfirmDelete(true)} aria-label="Supplement löschen">
                <Trash2 aria-hidden />
              </Button>
            )
          ) : null}
          {!confirmDelete ? (
            <Button type="button" size="lg" onClick={save} disabled={pending} className="flex-1">
              Speichern
            </Button>
          ) : null}
        </>
      }
    >
      <div className="grid gap-3">
        <Field id="supp-name" label="Name" error={err("name")}>
          <Input id="supp-name" value={form.name} maxLength={80} onChange={(e) => set("name", e.target.value)} placeholder="z. B. Vitamin D3 + K2" className="h-12 text-base" aria-invalid={Boolean(err("name"))} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="supp-brand" label="Marke · optional" error={err("brand")}>
            <Input id="supp-brand" value={form.brand} maxLength={80} onChange={(e) => set("brand", e.target.value)} placeholder="z. B. Sunday" className="h-12 text-base" />
          </Field>
          <Field id="supp-shop" label="Gekauft bei · optional" error={err("shop")}>
            <Input id="supp-shop" value={form.shop} maxLength={80} onChange={(e) => set("shop", e.target.value)} placeholder="z. B. dm" className="h-12 text-base" />
          </Field>
        </div>
      </div>

      <div>
        <FieldHeading>Form</FieldHeading>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Form">
          {SUPPLEMENT_FORMS.map((f) => (
            <button key={f.value} type="button" role="radio" aria-checked={form.form === f.value} onClick={() => set("form", f.value)} className={choiceChipClass(form.form === f.value)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field id="supp-serving" label="Eine Portion" error={err("servingLabel")}>
          <Input id="supp-serving" value={form.servingLabel} maxLength={40} onChange={(e) => set("servingLabel", e.target.value)} placeholder="z. B. 1 Kapsel" className="h-12 text-base" />
        </Field>
        <Field id="supp-perday" label="Portionen pro Tag" error={err("servingsPerDay")}>
          <UnitInput id="supp-perday" unit="× tägl." inputMode="decimal" value={form.servingsPerDay} onChange={(e) => set("servingsPerDay", e.target.value)} className="pr-16" aria-invalid={Boolean(err("servingsPerDay"))} />
        </Field>
        <Field id="supp-pack" label="Portionen je Packung" error={err("servingsPerPack")}>
          <Input id="supp-pack" inputMode="decimal" value={form.servingsPerPack} onChange={(e) => set("servingsPerPack", e.target.value)} placeholder="z. B. 90" className="h-12 text-base tabular-nums" aria-invalid={Boolean(err("servingsPerPack"))} />
        </Field>
        <Field id="supp-price" label="Preis je Packung" error={err("priceEur")}>
          <UnitInput id="supp-price" unit="€" inputMode="decimal" value={form.priceEur} onChange={(e) => set("priceEur", e.target.value)} placeholder="z. B. 14,90" aria-invalid={Boolean(err("priceEur"))} />
        </Field>
      </div>
      {cost.perServing != null ? (
        <p className="-mt-3 text-sm text-muted-foreground tabular-nums">
          {euro(cost.perServing)} je Portion · {cost.perMonth != null ? `${euro(cost.perMonth)} im Monat` : ""}
          {cost.packDays != null ? ` · Packung reicht ${Math.floor(cost.packDays)} Tage` : ""}
        </p>
      ) : null}

      <div>
        <FieldHeading aside="je Portion">Inhaltsstoffe</FieldHeading>
        <ul className="grid gap-3">
          {form.rows.map((row) => {
            const n = nutrientOf(row.nutrient);
            const amount = parseDecimal(row.amount);
            const converted = n && amount != null ? toNutrientUnit(amount * perDay, row.unit, n) : null;
            const check = n && converted != null ? checkNutrient(n, converted, sex) : null;
            return (
              <li key={row.key} className="grid gap-2 rounded-2xl border bg-card p-3">
                <div className="flex items-center gap-2">
                  <NativeSelect
                    className="min-w-0 flex-1"
                    value={row.nutrient}
                    onChange={(e) => chooseNutrient(row, e.target.value)}
                    aria-label="Inhaltsstoff"
                  >
                    <option value="" disabled>
                      Inhaltsstoff wählen …
                    </option>
                    {NUTRIENTS.map((x) => (
                      <option key={x.key} value={x.key}>
                        {x.label}
                      </option>
                    ))}
                    <option value={OTHER}>Anderer Stoff …</option>
                  </NativeSelect>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, rows: f.rows.filter((r) => r.key !== row.key) }))}
                    className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    aria-label="Inhaltsstoff entfernen"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
                {row.nutrient === OTHER ? (
                  <Input value={row.name} maxLength={60} onChange={(e) => setRow(row.key, { name: e.target.value })} onBlur={() => nameBlur(row)} placeholder="z. B. Ashwagandha-Extrakt" className="h-12 text-base" aria-label="Name des Inhaltsstoffs" />
                ) : null}
                <div className="flex gap-2">
                  <Input inputMode="decimal" value={row.amount} onChange={(e) => setRow(row.key, { amount: e.target.value })} placeholder="Menge" className="h-11 min-w-0 flex-1 text-base tabular-nums" aria-label="Menge je Portion" />
                  <NativeSelect className="w-24" value={row.unit} onChange={(e) => setRow(row.key, { unit: e.target.value as AmountUnit })} aria-label="Einheit">
                    {AMOUNT_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                {check ? (
                  <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground tabular-nums">
                    <ToneBadge tone={verdictTone(check.verdict)}>{VERDICT_LABEL[check.verdict]}</ToneBadge>
                    {formatAmount(check.amount)} {n!.unit} am Tag
                    {check.percentOfRec != null ? ` · ${Math.round(check.percentOfRec)} % der Empfehlung` : ""}
                  </p>
                ) : null}
                {err(`row-${row.key}`) ? <p className="text-sm text-destructive">{err(`row-${row.key}`)}</p> : null}
              </li>
            );
          })}
        </ul>
        <Button type="button" variant="outline" className="mt-3 h-11 w-full rounded-full" onClick={() => setForm((f) => ({ ...f, rows: [...f.rows, emptyRow()] }))}>
          <Plus aria-hidden />
          Inhaltsstoff hinzufügen
        </Button>
        {err("ingredients") ? <p className="mt-1 text-sm text-destructive">{err("ingredients")}</p> : null}
      </div>

      <label className="flex min-h-12 items-center justify-between gap-4 rounded-2xl border bg-card px-4 py-3">
        <span>
          <span className="block font-medium">Nehme ich gerade</span>
          <span className="block text-sm text-muted-foreground">Zählt in die Tagessumme und die Kosten.</span>
        </span>
        <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />
      </label>

      <Field id="supp-note" label="Notiz · optional" error={err("note")}>
        <Textarea id="supp-note" value={form.note} maxLength={500} onChange={(e) => set("note", e.target.value)} placeholder="z. B. morgens zum Essen, im Winter" className="min-h-20" />
      </Field>
    </EditorSheet>
  );
}
