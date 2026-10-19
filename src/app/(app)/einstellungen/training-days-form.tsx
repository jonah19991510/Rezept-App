"use client";

import { useState, useTransition } from "react";
import { Dumbbell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { saveTrainingWeekdaysAction } from "./actions";

const WEEKDAYS = [
  { value: 1, label: "Mo" },
  { value: 2, label: "Di" },
  { value: 3, label: "Mi" },
  { value: 4, label: "Do" },
  { value: 5, label: "Fr" },
  { value: 6, label: "Sa" },
  { value: 7, label: "So" },
];

/** Standard-Trainingstage pro Wochentag; im Wochenplan pro Tag umschaltbar. */
export function TrainingDaysForm({ initial }: { initial: number[] }) {
  const [selected, setSelected] = useState<number[]>(initial);
  const [pending, startTransition] = useTransition();
  const changed = [...selected].sort().join() !== [...initial].sort().join();

  function toggle(day: number) {
    setSelected((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function save() {
    startTransition(async () => {
      const result = await saveTrainingWeekdaysAction({ weekdays: selected });
      if (result.ok) toast.success("Trainingstage gespeichert.");
      else toast.error(result.message);
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Standard-Trainingstage">
        {WEEKDAYS.map(({ value, label }) => {
          const on = selected.includes(value);
          return (
            <button
              key={value}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(value)}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl border text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
              <Dumbbell className={cn("size-3.5", !on && "opacity-30")} aria-hidden />
            </button>
          );
        })}
      </div>
      <div>
        <Button type="button" onClick={save} disabled={pending || !changed}>
          {pending ? "Wird gespeichert …" : "Trainingstage speichern"}
        </Button>
      </div>
    </div>
  );
}
