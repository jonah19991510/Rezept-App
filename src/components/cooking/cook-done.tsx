"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ChevronLeft, PartyPopper, Star } from "lucide-react";
import { saveCookLogAction } from "@/app/kochen/actions";
import { FormMessage } from "@/components/forms/form-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { cookLogSchema } from "@/lib/validation/cooking";

/** Abschluss: Bewertung und Notiz fürs Koch-Log (beides freiwillig). */
export function CookDone({ recipeId, servings, onBack }: { recipeId: string; servings: number; onBack: () => void }) {
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
        <h1 className="text-3xl font-semibold">Gekocht!</h1>
        <p className="text-muted-foreground">Wie war&apos;s? Bewertung und Notiz helfen dir beim nächsten Mal.</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 font-medium">Bewertung</legend>
        <div className="flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(rating === n ? null : n)}
              aria-pressed={rating != null && n <= rating}
              aria-label={`${n} von 5 Sternen`}
              className="grid size-14 place-items-center rounded-2xl hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Star className={cn("size-9", rating != null && n <= rating ? "fill-primary text-primary" : "text-muted-foreground")} aria-hidden />
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-1.5">
        <Label htmlFor="cook-note">Notiz (optional)</Label>
        <Textarea
          id="cook-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="z. B. nächstes Mal mehr Chili"
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
