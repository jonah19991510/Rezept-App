"use client";

import { useOptimistic, useTransition } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { setFavoriteAction } from "@/app/(app)/rezepte/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FavoriteButton({ recipeId, isFavorite }: { recipeId: string; isFavorite: boolean }) {
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

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={toggle}
      aria-pressed={optimistic}
      aria-label={optimistic ? "Aus den Favoriten entfernen" : "Zu den Favoriten"}
    >
      <Heart className={cn("size-5", optimistic && "fill-primary text-primary")} aria-hidden />
    </Button>
  );
}
