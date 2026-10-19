"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseDecimal } from "@/lib/domain/decimal";
import { longNotCookedSchema } from "@/lib/validation/kitchen-log";
import { saveLongNotCookedWeeksAction } from "./actions";

/** Ab wie vielen Wochen ein gut bewertetes Rezept im Wochenplan als „lange nicht gekocht“ vorgeschlagen wird. */
export function LongNotCookedForm({ initial }: { initial: number }) {
  const [value, setValue] = useState(String(initial));
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function save() {
    const parsed = longNotCookedSchema.safeParse({ weeks: parseDecimal(value) ?? Number.NaN });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    setError(undefined);
    startTransition(async () => {
      const result = await saveLongNotCookedWeeksAction(parsed.data);
      if (result.ok) toast.success("Gespeichert.");
      else setError(result.message);
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="long-weeks">Nach wie vielen Wochen?</Label>
        <Input id="long-weeks" inputMode="numeric" className="w-28" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <Button type="button" onClick={save} disabled={pending || value === String(initial)}>
        {pending ? "Wird gespeichert …" : "Speichern"}
      </Button>
      {error ? <p className="w-full text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
