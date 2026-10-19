"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { formatDecimalInput, parseDecimal } from "@/lib/domain/decimal";
import type { Goals } from "@/lib/domain/plan";
import { formatNumber } from "@/lib/format";
import { goalsSchema, type GoalsInput } from "@/lib/validation/plan";
import { flattenIssues } from "@/lib/validation/recipe";
import { saveGoalsAction } from "./actions";

const FIELDS = [
  { key: "kcal", label: "Kalorien (kcal)", placeholder: "z. B. 2200" },
  { key: "protein", label: "Protein (g)", placeholder: "z. B. 140" },
  { key: "carbs", label: "Kohlenhydrate (g)", placeholder: "z. B. 250" },
  { key: "fat", label: "Fett (g)", placeholder: "z. B. 70" },
] as const;

type Key = (typeof FIELDS)[number]["key"];

function toNumberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  return parseDecimal(value) ?? Number.NaN;
}

/** Tagesziele. Leere Felder bedeuten: für diesen Wert kein Ziel. „training“: Ziel für Trainingstage. */
export function GoalsForm({ initial, goalType = "default" }: { initial: Goals; goalType?: "default" | "training" }) {
  const [values, setValues] = useState<Record<Key, string>>({
    kcal: formatDecimalInput(initial.kcal, 0),
    protein: formatDecimalInput(initial.protein, 1),
    carbs: formatDecimalInput(initial.carbs, 1),
    fat: formatDecimalInput(initial.fat, 1),
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  const protein = parseDecimal(values.protein) ?? 0;
  const carbs = parseDecimal(values.carbs) ?? 0;
  const fat = parseDecimal(values.fat) ?? 0;
  const kcalFromMacros = protein * 4 + carbs * 4 + fat * 9;

  function save() {
    const input: GoalsInput = {
      kcal: toNumberOrNull(values.kcal),
      protein: toNumberOrNull(values.protein),
      carbs: toNumberOrNull(values.carbs),
      fat: toNumberOrNull(values.fat),
    };
    const parsed = goalsSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(flattenIssues(parsed.error));
      return;
    }
    setErrors({});
    setMessage(undefined);
    startTransition(async () => {
      const result = await saveGoalsAction(input, goalType);
      if (result.ok) toast.success(goalType === "training" ? "Ziele für Trainingstage gespeichert." : "Tagesziele gespeichert.");
      else {
        setErrors(result.fieldErrors ?? {});
        setMessage(result.message);
      }
    });
  }

  return (
    <div className="grid gap-4">
      <FormMessage message={message} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {FIELDS.map((f) => (
          <FormField
            key={f.key}
            label={f.label}
            name={`goal-${goalType}-${f.key}`}
            inputMode="decimal"
            placeholder={f.placeholder}
            value={values[f.key]}
            onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
            errors={errors[f.key]}
          />
        ))}
      </div>
      {kcalFromMacros > 0 ? (
        <p className="text-sm text-muted-foreground">
          Aus Protein, Kohlenhydraten und Fett ergeben sich rund {formatNumber(Math.round(kcalFromMacros), 0)} kcal.
          {!values.kcal.trim() ? (
            <>
              {" "}
              <button
                type="button"
                className="font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => setValues((prev) => ({ ...prev, kcal: String(Math.round(kcalFromMacros)) }))}
              >
                Als kcal-Ziel übernehmen
              </button>
            </>
          ) : null}
        </p>
      ) : null}
      <div>
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "Wird gespeichert …" : "Ziele speichern"}
        </Button>
      </div>
    </div>
  );
}
