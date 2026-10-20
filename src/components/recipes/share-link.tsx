"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { Copy, ExternalLink, Link2, Link2Off, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { setRecipeShareAction } from "@/app/(app)/rezepte/share-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { shareUrl } from "@/lib/domain/shared-recipe";

const noopSubscribe = () => () => {};

/**
 * „Teilen per Link“ auf der eigenen Rezeptseite: Link erzeugen, kopieren/teilen, widerrufen.
 * Wer den Link hat, sieht die Rezeptkarte ohne Account – auch bei privaten Rezepten.
 */
export function ShareLink({
  recipeId,
  title,
  initialToken,
  siteOrigin,
}: {
  recipeId: string;
  title: string;
  initialToken: string | null;
  /** Adresse der App vom Server (SITE_URL); im Browser gilt die tatsächliche Adresse (z. B. die WLAN-IP) */
  siteOrigin: string;
}) {
  const [token, setToken] = useState(initialToken);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [pending, startTransition] = useTransition();
  const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => siteOrigin);
  const canShare = useSyncExternalStore(noopSubscribe, () => typeof navigator.share === "function", () => false);
  const url = token ? shareUrl(origin, token) : null;

  function setShared(enabled: boolean) {
    startTransition(async () => {
      const result = await setRecipeShareAction({ recipeId, enabled });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setToken(result.token);
      setConfirmRevoke(false);
      toast.success(enabled ? "Link erstellt." : "Link widerrufen. Die alte Adresse zeigt nichts mehr.");
    });
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link kopiert.");
    } catch {
      // Ohne HTTPS (z. B. im WLAN über http://192…) gibt es keine Zwischenablage
      window.prompt("Link markieren und kopieren:", url);
    }
  }

  async function share() {
    if (!url) return;
    try {
      await navigator.share({ title, url });
    } catch (e) {
      if (e instanceof Error && e.name !== "AbortError") void copy();
    }
  }

  return (
    <section aria-labelledby="teilen" className="space-y-3 rounded-3xl border bg-card p-4 md:p-5">
      <div className="space-y-1">
        <h2 id="teilen" className="flex items-center gap-2 font-semibold">
          <Link2 className="size-4 text-primary" aria-hidden />
          Teilen per Link
        </h2>
        <p className="text-sm text-muted-foreground">
          {url
            ? "Wer diesen Link hat, sieht die Rezeptkarte ohne Account – auch wenn das Rezept privat ist. Als Autor steht dein Anzeigename dabei."
            : "Erstell einen Link, den du z. B. per WhatsApp schickst. Er zeigt eine Rezeptkarte, auch ohne Account und auch für private Rezepte. Du kannst ihn jederzeit widerrufen."}
        </p>
      </div>

      {url ? (
        <>
          <Input
            readOnly
            value={url}
            aria-label="Link zur Rezeptkarte"
            onFocus={(e) => e.currentTarget.select()}
            className="font-mono text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={copy}>
              <Copy aria-hidden />
              Kopieren
            </Button>
            {canShare ? (
              <Button type="button" variant="outline" onClick={share}>
                <Share2 aria-hidden />
                Teilen
              </Button>
            ) : null}
            <a href={url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline" })}>
              <ExternalLink aria-hidden />
              Ansehen
            </a>
            <Button type="button" variant="ghost" onClick={() => setConfirmRevoke(true)} disabled={pending}>
              <Link2Off aria-hidden />
              Widerrufen
            </Button>
          </div>
        </>
      ) : (
        <Button type="button" onClick={() => setShared(true)} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Link2 aria-hidden />}
          {pending ? "Wird erstellt …" : "Link erstellen"}
        </Button>
      )}

      <Dialog open={confirmRevoke} onOpenChange={setConfirmRevoke}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link widerrufen?</DialogTitle>
            <DialogDescription>
              Wer den Link schon hat, sieht danach nur noch „Link ungültig“. Kopien, die andere schon übernommen haben,
              bleiben bei ihnen. Ein neuer Link bekommt eine andere Adresse.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Abbrechen</DialogClose>
            <Button type="button" variant="destructive" onClick={() => setShared(false)} disabled={pending}>
              {pending ? "Wird widerrufen …" : "Widerrufen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
