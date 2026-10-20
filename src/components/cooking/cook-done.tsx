"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ChevronLeft, PartyPopper } from "lucide-react";
import { saveCookLogAction } from "@/app/kochen/actions";
import { FormMessage } from "@/components/forms/form-message";
import { StarRatingInput } from "@/components/recipes/star-rating";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cookLogSchema } from "@/lib/validation/cooking";

/** Abschluss: Bewertung und Notiz fürs Koch-Log (beides freiwillig). */
export function CookDone({
  recipeId,
  servings,
  onBack,
  kind = "dish",
}: {
  recipeId: string;
  servings: number;
  onBack: () => void;
  /** Phase 15: „Gemixt!“ im Mix-Modus */
  kind?: "dish" | "cocktail";
}) {
  const [rating, setRating] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    const parsed = cookLogSchema.safeParse({ recipeId, rating, note, servings });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message);
      return;
    }
    startTransition(async () => {
      const result = await saveCookLogAction(parsed.data);
      if (result.ok) setSaved(true);
      else setMessage(result.message);
    });
  }

  if (saved) {
    return (
      <div className="mx-auto max-w-xl space-y-6 p-4 text-center md:p-8">
        <PartyPopper className="mx-auto size-12 text-primary" aria-hidden />
        <h1 className="text-3xl font-semibold">Guten Appetit!</h1>
        <p className="text-muted-foreground">Dein Eintrag ist gespeichert.</p>
        <Link href={`/rezepte/${recipeId}`} className={buttonVariants({ size: "lg", className: "h-14 w-full text-lg" })}>
          Zum Rezept
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 p-4 md:p-8">
      <div className="space-y-2 text-center">
        <PartyPopper className="mx-auto size-12 text-primary" aria-hidden />
        <h1 className="text-3xl font-semibold">{kind === "cocktail" ? "Gemixt!" : "Gekocht!"}</h1>
        <p className="text-muted-foreground">Wie war&apos;s? Bewertung und Notiz helfen dir beim nächsten Mal.</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 font-medium">Bewertung</legend>
        <StarRatingInput value={rating} onChange={setRating} size="lg" />
      </fieldset>

      <div className="grid gap-1.5">
        <Label htmlFor="cook-note">Notiz (optional)</Label>
        <Textarea
          id="cook-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder={kind === "cocktail" ? "z. B. nächstes Mal weniger Sirup" : "z. B. nächstes Mal mehr Chili"}
        />
      </div>

      <FormMessage message={message} />

      <div className="grid gap-3">
        <Button type="button" className="h-14 text-lg" onClick={save} disabled={pending}>
          {pending ? "Wird gespeichert …" : "Speichern"}
        </Button>
        <Link href={`/rezepte/${recipeId}`} className={buttonVariants({ variant: "outline", className: "h-12" })}>
          Ohne Eintrag beenden
        </Link>
        <Button type="button" variant="ghost" onClick={onBack}>
          <ChevronLeft aria-hidden />
          Zurück zu den Schritten
        </Button>
      </div>
    </div>
  );
}
