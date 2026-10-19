"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { Globe, Lock } from "lucide-react";
import { toast } from "sonner";
import { setRecipePublicAction } from "@/app/(app)/rezepte/actions";
import { Switch } from "@/components/ui/switch";
import { setRecipePublicSchema } from "@/lib/validation/community";

/** Schalter „Veröffentlichen“ auf der eigenen Rezeptseite. Wirkt sofort. */
export function PublishToggle({
  recipeId,
  isPublic,
  displayName,
}: {
  recipeId: string;
  isPublic: boolean;
  displayName: string;
}) {
  const [optimistic, setOptimistic] = useOptimistic(isPublic);
  const [pending, startTransition] = useTransition();

  function toggle(next: boolean) {
    const parsed = setRecipePublicSchema.safeParse({ recipeId, isPublic: next });
    if (!parsed.success) return;
    startTransition(async () => {
      setOptimistic(next);
      const result = await setRecipePublicAction(parsed.data);
      if (!result.ok) toast.error(result.message ?? "Das hat nicht geklappt.");
      else toast.success(next ? "Veröffentlicht. Das Rezept steht jetzt unter Entdecken." : "Das Rezept ist wieder privat.");
    });
  }

  const Icon = optimistic ? Globe : Lock;

  return (
    <section aria-labelledby="sichtbarkeit" className="rounded-3xl border bg-card p-4 md:p-5">
      <div className="flex items-start justify-between gap-4">
        <span className="space-y-1">
          <span id="sichtbarkeit" className="flex items-center gap-2 font-semibold">
            <Icon className="size-4 text-primary" aria-hidden />
            {optimistic ? "Öffentlich" : "Privat"}
          </span>
          <span id="sichtbarkeit-hinweis" className="block text-sm text-muted-foreground">
            {optimistic ? (
              <>
                Alle aus der Runde sehen das Rezept unter{" "}
                <Link href="/entdecken" className="text-primary underline-offset-4 hover:underline">
                  Entdecken
                </Link>
                , mit deinem Anzeigenamen „{displayName}“. Sie können es einplanen und eine eigene Kopie übernehmen.
              </>
            ) : (
              "Nur du siehst dieses Rezept. Veröffentlichen zeigt es allen aus der Runde mit deinem Anzeigenamen, nie mit deiner E-Mail-Adresse."
            )}
          </span>
          {optimistic ? (
            <span className="block text-xs text-muted-foreground">
              Machst du es wieder privat, verschwindet es aus Entdecken und aus fremden Wochenplänen. Kopien, die andere
              schon übernommen haben, bleiben bei ihnen.
            </span>
          ) : null}
        </span>
        <span className="flex min-h-11 items-center">
          <Switch
            checked={optimistic}
            onCheckedChange={toggle}
            disabled={pending}
            aria-label="Rezept veröffentlichen"
            aria-describedby="sichtbarkeit-hinweis"
          />
        </span>
      </div>
    </section>
  );
}
