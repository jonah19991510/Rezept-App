"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CalendarClock, CircleCheck, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { addMissingToShoppingAction } from "@/app/(app)/einkauf/pantry-actions";
import { Button } from "@/components/ui/button";
import type { CookOption } from "@/lib/domain/pantry";
import { cn } from "@/lib/utils";

const SECTIONS: { status: CookOption["status"]; title: string }[] = [
  { status: "all", title: "Alles da" },
  { status: "one", title: "Fehlt 1 Zutat" },
  { status: "few", title: "Fehlen 2–3 Zutaten" },
];

/** Rezepte nach Abdeckung durch den Vorrat; fehlende Zutaten mit einem Tipp auf die Einkaufsliste. */
export function CookOptions({ options }: { options: CookOption[] }) {
  const [showMany, setShowMany] = useState(false);
  const many = options.filter((o) => o.status === "many");

  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">Du hast noch keine Rezepte mit Zutaten.</p>;
  }

  return (
    <div className="space-y-8">
      {SECTIONS.map(({ status, title }) => {
        const list = options.filter((o) => o.status === status);
        return (
          <section key={status} aria-labelledby={`koch-${status}`} className="space-y-3">
            <h2 id={`koch-${status}`} className="flex items-center gap-2 text-lg font-semibold">
              {status === "all" ? <CircleCheck className="size-5 text-sage" aria-hidden /> : null}
              {title} <span className="text-sm font-normal text-muted-foreground">({list.length})</span>
            </h2>
            {list.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Rezepte.</p>
            ) : (
              <ul className="grid gap-3">
                {list.map((o) => (
                  <OptionCard key={o.id} option={o} />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {many.length > 0 ? (
        <section className="space-y-3">
          <Button type="button" variant="ghost" onClick={() => setShowMany((v) => !v)} aria-expanded={showMany}>
            {showMany ? "Ausblenden" : `${many.length} weitere Rezepte, bei denen mehr fehlt`}
          </Button>
          {showMany ? (
            <ul className="grid gap-3">
              {many.map((o) => (
                <OptionCard key={o.id} option={o} />
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function OptionCard({ option }: { option: CookOption }) {
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);

  function addMissing() {
    startTransition(async () => {
      const result = await addMissingToShoppingAction({ recipeId: option.id });
      if (result.ok) {
        setAdded(true);
        toast.success(result.message ?? "Auf die Einkaufsliste gesetzt.");
      } else toast.error(result.message);
    });
  }

  return (
    <li className={cn("rounded-2xl border bg-card p-4", option.status === "all" && "border-sage/50")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <Link href={`/rezepte/${option.id}`} className="font-medium hover:text-primary">
            {option.title}
          </Link>
          {option.missing.length > 0 ? (
            <p className="text-sm text-muted-foreground">Es fehlt: {option.missing.map((m) => m.name).join(", ")}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {option.required > 0 ? `Alle ${option.required} Zutaten im Vorrat` : "Nur Grundzutaten"}
            </p>
          )}
          {option.usesExpiring > 0 ? (
            <p className="flex items-center gap-1 text-xs font-medium text-primary">
              <CalendarClock className="size-3.5" aria-hidden />
              verbraucht {option.usesExpiring === 1 ? "eine Zutat, die bald abläuft" : `${option.usesExpiring} Zutaten, die bald ablaufen`}
            </p>
          ) : null}
        </div>
        {option.missing.length > 0 ? (
          <Button type="button" variant="outline" size="sm" onClick={addMissing} disabled={pending || added}>
            <ShoppingCart aria-hidden />
            {added ? "Auf der Liste" : "Fehlendes auf die Liste"}
          </Button>
        ) : null}
      </div>
    </li>
  );
}
