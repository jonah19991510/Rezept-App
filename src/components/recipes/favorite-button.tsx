"use client";

import { useOptimistic, useTransition } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { setFavoriteAction } from "@/app/(app)/rezepte/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Herz zum Merken. „overlay“: runder Knopf auf der Rezeptkarte (Liste), damit man Favoriten setzen kann,
 * ohne das Rezept zu öffnen.
 */
export function FavoriteButton({
  recipeId,
  isFavorite,
  variant = "outline",
  title,
  className,
}: {
  recipeId: string;
  isFavorite: boolean;
  variant?: "outline" | "overlay";
  /** Rezepttitel für die Ansage im Screenreader (auf der Karte) */
  title?: string;
  className?: string;
}) {
  const [optimistic, setOptimistic] = useOptimistic(isFavorite);
  const [, startTransition] = useTransition();

  function toggle() {
    const next = !optimistic;
    startTransition(async () => {
      setOptimistic(next);
      const result = await setFavoriteAction(recipeId, next);
      if (!result.ok) toast.error("Das hat nicht geklappt. Bitte versuche es noch einmal.");
    });
  }

  const action = optimistic ? "Aus den Favoriten entfernen" : "Zu den Favoriten";
  const label = title ? `${title}: ${action}` : action;

  if (variant === "overlay") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={optimistic}
        aria-label={label}
        className={cn(
          "grid size-11 place-items-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur transition hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95",
          className,
        )}
      >
        <Heart className={cn("size-5", optimistic && "fill-primary text-primary")} aria-hidden />
      </button>
    );
  }

  return (
    <Button type="button" variant="outline" size="icon" onClick={toggle} aria-pressed={optimistic} aria-label={label} className={className}>
      <Heart className={cn("size-5", optimistic && "fill-primary text-primary")} aria-hidden />
    </Button>
  );
}
