"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { parseDecimal } from "@/lib/domain/decimal";
import { convertUsAmount, fahrenheitToCelsius, US_UNITS, type UsUnit } from "@/lib/domain/us-units";
import { formatNumber } from "@/lib/format";
import { UNIT_LABELS } from "@/lib/labels";

const UNIT_OPTIONS: { value: UsUnit; label: string }[] = [
  { value: "cup", label: "cup (Tasse, 240 ml)" },
  { value: "tbsp", label: "tbsp (Esslöffel)" },
  { value: "tsp", label: "tsp (Teelöffel)" },
  { value: "fl_oz", label: "fl oz (Flüssigunze)" },
  { value: "pint", label: "pint" },
  { value: "quart", label: "quart" },
  { value: "oz", label: "oz (Unze)" },
  { value: "lb", label: "lb (Pfund)" },
  { value: "stick", label: "stick Butter" },
];

/** Umrechner für amerikanische Mengen (cup über die Dichte der Zutat) und Temperaturen. */
export function UnitConverter({ ingredients }: { ingredients: { id: string; name: string; density: number }[] }) {
  const [amount, setAmount] = useState("1");
  const [unit, setUnit] = useState<UsUnit>("cup");
  const [ingredientId, setIngredientId] = useState("");
  const [fahrenheit, setFahrenheit] = useState("350");
  const [celsius, setCelsius] = useState("180");

  const value = parseDecimal(amount);
  const density = ingredients.find((i) => i.id === ingredientId)?.density ?? null;
  const result = value != null && value > 0 ? convertUsAmount(value, unit, density) : null;
  const isVolume = US_UNITS[unit].kind === "volume" && unit !== "tbsp" && unit !== "tsp";
  const ml = value != null && isVolume ? value * US_UNITS[unit].ml! : null;

  const f = parseDecimal(fahrenheit);
  const c = parseDecimal(celsius);

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 rounded-3xl border bg-card p-4 md:p-5" aria-labelledby="sec-menge">
        <h2 id="sec-menge" className="text-xl font-semibold">
          Menge
        </h2>
        <div className="grid grid-cols-[6rem_1fr] gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor="conv-amount">Menge</Label>
            <Input id="conv-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="conv-unit">Einheit</Label>
            <NativeSelect id="conv-unit" value={unit} onChange={(e) => setUnit(e.target.value as UsUnit)}>
              {UNIT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        {isVolume ? (
          <div className="grid gap-1.5">
            <Label htmlFor="conv-ingredient">Zutat (für das Gewicht)</Label>
            <NativeSelect id="conv-ingredient" value={ingredientId} onChange={(e) => setIngredientId(e.target.value)}>
              <option value="">Flüssigkeit / unbekannt (Milliliter)</option>
              {ingredients.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </NativeSelect>
            <p className="text-xs text-muted-foreground">
              Ein cup Mehl wiegt viel weniger als ein cup Zucker. Mit der Zutat rechnet der Umrechner in Gramm um.
            </p>
          </div>
        ) : null}
        <output className="rounded-2xl bg-muted/60 px-4 py-3" aria-live="polite">
          {result ? (
            <>
              <span className="font-heading text-3xl font-semibold">
                ≈ {formatNumber(result.amount, result.amount < 10 ? 1 : 0)} {UNIT_LABELS[result.unit]}
              </span>
              {ml != null && result.unit === "g" ? (
                <span className="mt-1 block text-sm text-muted-foreground">entspricht {formatNumber(Math.round(ml), 0)} ml</span>
              ) : null}
            </>
          ) : (
            <span className="text-muted-foreground">Bitte eine Menge eingeben.</span>
          )}
        </output>
      </section>

      <section className="grid gap-4 rounded-3xl border bg-card p-4 md:p-5" aria-labelledby="sec-temp">
        <h2 id="sec-temp" className="text-xl font-semibold">
          Temperatur
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="conv-f">°F → °C</Label>
            <Input id="conv-f" inputMode="decimal" value={fahrenheit} onChange={(e) => setFahrenheit(e.target.value)} />
            <output className="font-heading text-2xl font-semibold" aria-live="polite">
              {f != null ? `≈ ${fahrenheitToCelsius(f)} °C` : "–"}
            </output>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="conv-c">°C → °F</Label>
            <Input id="conv-c" inputMode="decimal" value={celsius} onChange={(e) => setCelsius(e.target.value)} />
            <output className="font-heading text-2xl font-semibold" aria-live="polite">
              {c != null ? `≈ ${Math.round((c * 9) / 5 + 32)} °F` : "–"}
            </output>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Backofentemperaturen werden auf 5 °C gerundet. Umluft: etwa 20 °C weniger.</p>
      </section>
    </div>
  );
}
