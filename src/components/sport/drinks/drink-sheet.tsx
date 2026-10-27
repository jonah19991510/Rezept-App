"use client";

import { useState, useTransition } from "react";
import { Blend, Check, GlassWater, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteDrinkAction, saveDrinkAction } from "@/app/(app)/sport/getraenke/actions";
import { SegmentToggle } from "@/components/layout/list-blocks";
import { EditorSheet, FieldHeading } from "@/components/recipes/editor/editor-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { formatDecimalInput, parseDecimal } from "@/lib/domain/decimal";
import { DRINK_COLOR_KEYS, DRINK_COLORS, drinkFacts, formatLiters, mixValues, type Drink, type DrinkColor } from "@/lib/domain/drinks";
import { cn } from "@/lib/utils";

type IngredientForm = { key: number; name: string; ml: string; caffeine: string; sugar: string; water: boolean };
type Form = {
  name: string;
  color: string;
  kind: "einfach" | "mix";
  caffeine: string;
  sugar: string;
  isWater: boolean;
  ingredients: IngredientForm[];
};

let nextKey = 1;
const emptyIngredient = (): IngredientForm => ({ key: nextKey++, name: "", ml: "", caffeine: "0", sugar: "0", water: false });

function initialForm(drink: Drink | null, usedColors: string[]): Form {
  if (!drink) {
    const color = DRINK_COLOR_KEYS.find((c) => !usedColors.includes(c)) ?? "blau";
    return { name: "", color, kind: "einfach", caffeine: "0", sugar: "0", isWater: false, ingredients: [emptyIngredient(), emptyIngredient()] };
  }
  return {
    name: drink.name,
    color: drink.color,
    kind: drink.ingredients ? "mix" : "einfach",
    caffeine: formatDecimalInput(drink.caffeinePer100, 1),
    sugar: formatDecimalInput(drink.sugarPer100, 1),
    isWater: drink.waterPercent >= 100,
    ingredients: drink.ingredients
      ? drink.ingredients.map((i) => ({ key: nextKey++, name: i.name, ml: String(i.ml), caffeine: formatDecimalInput(i.caffeine, 1), sugar: formatDecimalInput(i.sugar, 1), water: i.water }))
      : [emptyIngredient(), emptyIngredient()],
  };
}

/** Zutaten mit Zahlen; unvollständige Zeilen (ohne Name oder Menge) fallen weg. */
function parsedIngredients(list: IngredientForm[]) {
  return list
    .map((i) => ({ name: i.name.trim(), ml: Number.parseInt(i.ml, 10), caffeine: parseDecimal(i.caffeine) ?? 0, sugar: parseDecimal(i.sugar) ?? 0, water: i.water }))
    .filter((i) => i.name !== "" && i.ml > 0);
}

/**
 * Getränk anlegen oder bearbeiten: Name, Farbe, Koffein und Zucker pro 100 ml, „zählt als Wasser“; oder als
 * Mischgetränk aus Zutaten (z. B. Flexpresso = 300 ml Milch 1,5 % + 200 ml Wasser), dann rechnet die App Koffein,
 * Zucker und Wasseranteil.
 */
export function DrinkSheet({ drink, drinks, onClose }: { drink: Drink | null; drinks: Drink[]; onClose: () => void }) {
  const [open, setOpen] = useState(true);
  const [form, setForm] = useState<Form>(() => initialForm(drink, drinks.map((d) => d.color)));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const ingredients = parsedIngredients(form.ingredients);
  const mix = form.kind === "mix" ? mixValues(ingredients) : null;
  const caffeine = parseDecimal(form.caffeine);
  const sugar = parseDecimal(form.sugar);

  function close() {
    setOpen(false);
    setTimeout(onClose, 300);
  }

  function patchIngredient(key: number, patch: Partial<IngredientForm>) {
    setForm((f) => ({ ...f, ingredients: f.ingredients.map((i) => (i.key === key ? { ...i, ...patch } : i)) }));
  }

  /** Zutat aus einem vorhandenen Getränk übernehmen (Werte kopiert, keine Verknüpfung). */
  function addFromDrink(id: string) {
    const d = drinks.find((x) => x.id === id);
    if (!d) return;
    const row = { key: nextKey++, name: d.name, ml: "", caffeine: formatDecimalInput(d.caffeinePer100, 1), sugar: formatDecimalInput(d.sugarPer100, 1), water: d.waterPercent >= 100 };
    setForm((f) => {
      // erste leere Zeile ersetzen, sonst anhängen
      const empty = f.ingredients.findIndex((i) => i.name.trim() === "" && i.ml === "");
      const list = [...f.ingredients];
      if (empty >= 0) list[empty] = row;
      else list.push(row);
      return { ...f, ingredients: list };
    });
  }

  function save() {
    const input = {
      name: form.name,
      color: form.color as DrinkColor,
      // Mischgetränke: Werte kommen aus den Zutaten
      caffeinePer100: form.kind === "mix" ? 0 : (caffeine ?? -1),
      sugarPer100: form.kind === "mix" ? 0 : (sugar ?? -1),
      isWater: form.isWater,
      ingredients: form.kind === "mix" ? ingredients : null,
    };
    if (form.kind === "mix" && ingredients.length === 0) {
      setErrors({ ingredients: ["Mindestens eine Zutat mit Name und Menge."] });
      return;
    }
    startTransition(async () => {
      const result = await saveDrinkAction(drink?.id ?? null, input);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message ?? "Bitte die markierten Felder prüfen.");
        return;
      }
      toast.success(drink ? "Getränk gespeichert" : `${form.name.trim()} hinzugefügt`);
      close();
    });
  }

  function remove() {
    if (!drink) return;
    startTransition(async () => {
      const result = await deleteDrinkAction(drink.id);
      if (!result.ok) {
        toast.error(result.message ?? "Löschen ging nicht.");
        return;
      }
      toast.success(`${drink.name} gelöscht`);
      close();
    });
  }

  const err = (key: string) => errors[key]?.[0];

  return (
    <EditorSheet
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : close())}
      title={drink ? drink.name : "Getränk hinzufügen"}
      description={mix ? `${formatLiters(mix.totalMl)} · ${drinkFacts(mix)} pro 100 ml · ${mix.waterPercent.toLocaleString("de-DE")} % Wasser` : "Werte pro 100 ml"}
      footer={
        <>
          {drink ? (
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
              <Button type="button" variant="outline" size="icon-lg" onClick={() => setConfirmDelete(true)} aria-label="Getränk löschen">
                <Trash2 aria-hidden />
              </Button>
            )
          ) : null}
          {!confirmDelete ? (
            <Button type="button" size="lg" onClick={save} disabled={pending || form.name.trim() === ""} className="flex-1">
              Speichern
            </Button>
          ) : null}
        </>
      }
    >
      {confirmDelete ? (
        <p className="rounded-2xl bg-destructive/10 p-3 text-sm">Frühere Einträge mit {drink?.name} bleiben mit Namen und Werten im Verlauf und in der Statistik.</p>
      ) : null}

      <div className="grid gap-1.5">
        <Label htmlFor="drink-name">Name</Label>
        <Input
          id="drink-name"
          value={form.name}
          maxLength={60}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="h-12 text-base"
          aria-invalid={Boolean(err("name"))}
          placeholder="z. B. Flexpresso"
        />
        {err("name") ? <p className="text-sm text-destructive">{err("name")}</p> : null}
      </div>

      <section>
        <FieldHeading>Farbe</FieldHeading>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Farbe">
          {DRINK_COLOR_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={form.color === key}
              aria-label={DRINK_COLORS[key].label}
              title={DRINK_COLORS[key].label}
              onClick={() => setForm((f) => ({ ...f, color: key }))}
              className={cn(
                "grid size-11 place-items-center rounded-full ring-offset-2 ring-offset-popover transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                form.color === key && "ring-2 ring-foreground",
              )}
              style={{ background: DRINK_COLORS[key].value }}
            >
              {form.color === key ? <Check className="size-5 text-white drop-shadow" aria-hidden /> : null}
            </button>
          ))}
        </div>
      </section>

      <SegmentToggle
        label="Art"
        value={form.kind}
        onChange={(kind) => setForm((f) => ({ ...f, kind }))}
        options={[
          { value: "einfach", label: "Einfach", icon: GlassWater, showLabel: true },
          { value: "mix", label: "Mischgetränk", icon: Blend, showLabel: true },
        ]}
      />

      {form.kind === "einfach" ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="drink-caffeine">Koffein (mg/100 ml)</Label>
              <Input
                id="drink-caffeine"
                inputMode="decimal"
                value={form.caffeine}
                onChange={(e) => setForm((f) => ({ ...f, caffeine: e.target.value }))}
                className="h-12 text-base tabular-nums"
                aria-invalid={caffeine == null || Boolean(err("caffeinePer100"))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="drink-sugar">Zucker (g/100 ml)</Label>
              <Input
                id="drink-sugar"
                inputMode="decimal"
                value={form.sugar}
                onChange={(e) => setForm((f) => ({ ...f, sugar: e.target.value }))}
                className="h-12 text-base tabular-nums"
                aria-invalid={sugar == null || Boolean(err("sugarPer100"))}
              />
            </div>
          </div>
          <label className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border px-4">
            <span>
              <span className="block font-medium">Zählt als Wasser</span>
              <span className="block text-sm text-muted-foreground">Wasser, Sprudel, ungesüßter Kräutertee</span>
            </span>
            <Switch checked={form.isWater} onCheckedChange={(isWater) => setForm((f) => ({ ...f, isWater }))} />
          </label>
        </>
      ) : (
        <section className="space-y-3">
          <FieldHeading aside="Werte pro 100 ml">Zutaten</FieldHeading>
          {err("ingredients") ? <p className="text-sm text-destructive">{err("ingredients")}</p> : null}
          {form.ingredients.map((i, index) => (
            <div key={i.key} className="space-y-2 rounded-2xl border p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={i.name}
                  maxLength={60}
                  onChange={(e) => patchIngredient(i.key, { name: e.target.value })}
                  placeholder={index === 0 ? "z. B. Milch 1,5 %" : "z. B. Wasser"}
                  aria-label={`Zutat ${index + 1}: Name`}
                  className="h-11 text-base"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setForm((f) => ({ ...f, ingredients: f.ingredients.filter((x) => x.key !== i.key) }))}
                  aria-label={`Zutat ${index + 1} entfernen`}
                >
                  <X aria-hidden />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <NumberField label="ml" value={i.ml} onChange={(ml) => patchIngredient(i.key, { ml: ml.replace(/\D/g, "").slice(0, 4) })} numeric />
                <NumberField label="Koffein mg" value={i.caffeine} onChange={(caffeine) => patchIngredient(i.key, { caffeine })} />
                <NumberField label="Zucker g" value={i.sugar} onChange={(sugar) => patchIngredient(i.key, { sugar })} />
              </div>
              <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
                Zählt als Wasser
                <Switch checked={i.water} onCheckedChange={(water) => patchIngredient(i.key, { water })} />
              </label>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="h-11 rounded-full" onClick={() => setForm((f) => ({ ...f, ingredients: [...f.ingredients, emptyIngredient()] }))}>
              <Plus aria-hidden />
              Zutat
            </Button>
            {drinks.filter((d) => !d.ingredients && d.id !== drink?.id).length > 0 ? (
              <NativeSelect value="" onChange={(e) => addFromDrink(e.target.value)} aria-label="Zutat aus einem Getränk übernehmen" className="h-11 min-w-56 flex-1 rounded-full">
                <option value="">Aus Getränk übernehmen …</option>
                {drinks
                  .filter((d) => !d.ingredients && d.id !== drink?.id)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </NativeSelect>
            ) : null}
          </div>
          {mix && mix.totalMl > 0 ? (
            <p className="rounded-2xl bg-muted p-3 text-sm tabular-nums">
              {formatLiters(mix.totalMl)} ergeben pro 100 ml: {drinkFacts(mix)} · <span className="font-semibold">{mix.waterPercent.toLocaleString("de-DE")} % Wasseranteil</span>
            </p>
          ) : null}
        </section>
      )}
    </EditorSheet>
  );
}

function NumberField({ label, value, onChange, numeric }: { label: string; value: string; onChange: (v: string) => void; numeric?: boolean }) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      <Input inputMode={numeric ? "numeric" : "decimal"} value={value} onChange={(e) => onChange(e.target.value)} className="h-11 px-2 text-base text-foreground tabular-nums" />
    </label>
  );
}
