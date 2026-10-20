"use client";

import Link from "next/link";
import { useTransition } from "react";
import { BookCheck, Copy, ImageDown, Loader2, LogIn, Printer } from "lucide-react";
import { toast } from "sonner";
import { forkSharedRecipeAction } from "@/app/r/[token]/actions";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * Knöpfe auf der geteilten Rezeptkarte. Übernehmen nur mit Account (sonst Anmelden und zurück);
 * Drucken und Bild gehen für alle. Beim Drucken ist die Leiste ausgeblendet.
 */
export function SharedActions({
  token,
  viewer,
}: {
  token: string;
  /** guest: nicht angemeldet · owner: eigenes Rezept (ownRecipeId) · user: angemeldet, fremdes Rezept */
  viewer: { kind: "guest" } | { kind: "owner"; ownRecipeId: string } | { kind: "user" };
}) {
  const [pending, startTransition] = useTransition();

  function fork() {
    startTransition(async () => {
      const result = await forkSharedRecipeAction(token);
      if (result && !result.ok) toast.error(result.message);
    });
  }

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      {viewer.kind === "user" ? (
        <Button type="button" onClick={fork} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Copy aria-hidden />}
          {pending ? "Wird übernommen …" : "In mein Rezeptbuch übernehmen"}
        </Button>
      ) : viewer.kind === "owner" ? (
        <Link href={`/rezepte/${viewer.ownRecipeId}`} className={buttonVariants()}>
          <BookCheck aria-hidden />
          Dein Rezept öffnen
        </Link>
      ) : (
        <Link
          href={`/login?weiter=${encodeURIComponent(`/r/${token}`)}`}
          className={buttonVariants({ variant: "outline" })}
        >
          <LogIn aria-hidden />
          Anmelden zum Übernehmen
        </Link>
      )}
      <Button type="button" variant="outline" onClick={() => window.print()}>
        <Printer aria-hidden />
        Drucken
      </Button>
      <a href={`/r/${token}/bild`} download className={buttonVariants({ variant: "outline" })}>
        <ImageDown aria-hidden />
        Als Bild
      </a>
    </div>
  );
}
