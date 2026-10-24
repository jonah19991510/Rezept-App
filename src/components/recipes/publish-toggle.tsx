"use client";

import { useOptimistic, useTransition } from "react";
import { Globe, Lock } from "lucide-react";
import { toast } from "sonner";
import { setRecipePublicAction } from "@/app/(app)/rezepte/actions";
import { cn } from "@/lib/utils";
import { setRecipePublicSchema } from "@/lib/validation/community";

const OPTIONS = [
  { value: false, label: "Privat", icon: Lock },
  { value: true, label: "Öffentlich", icon: Globe },
] as const;

/** Umschalter Privat | Öffentlich oben auf der eigenen Rezeptseite, mit einer Zeile Erklärung. Wirkt sofort. */
export function PublishToggle({ recipeId, isPublic }: { recipeId: string; isPublic: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(isPublic);
  const [pending, startTransition] = useTransition();

  function select(next: boolean) {
    if (next === optimistic) return;
    const parsed = setRecipePublicSchema.safeParse({ recipeId, isPublic: next });
    if (!parsed.success) return;
    startTransition(async () => {
      setOptimistic(next);
      const result = await setRecipePublicAction(parsed.data);
      if (!result.ok) toast.error(result.message ?? "Das hat nicht geklappt.");
      else toast.success(next ? "Veröffentlicht. Das Rezept steht jetzt unter Entdecken." : "Das Rezept ist wieder privat.");
    });
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1 rounded-full border bg-card p-1" role="group" aria-label="Sichtbarkeit">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            aria-pressed={optimistic === value}
            aria-describedby="sichtbarkeit-hinweis"
            disabled={pending}
            onClick={() => select(value)}
            className={cn(
              "flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-transparent px-4 text-sm font-medium text-muted-foreground transition hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              optimistic === value && "border-primary/60 bg-primary/15 text-primary hover:text-primary",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>
      <p id="sichtbarkeit-hinweis" className="px-1 text-sm text-muted-foreground">
        {optimistic
          ? "Für alle unter „Entdecken“ sichtbar – nur mit deinem Anzeigenamen."
          : "Nur du siehst dieses Rezept."}
      </p>
    </div>
  );
}
