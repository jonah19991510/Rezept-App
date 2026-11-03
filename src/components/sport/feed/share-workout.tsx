"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { MessageCircle, Send, Share2, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { deletePostAction, shareWorkoutAction } from "@/app/(app)/sport/feed/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Post = { id: string; body: string | null; kudos: number; comments: number };

/**
 * „Training teilen“ unter einem beendeten Training: noch nicht geteilt → Text und „Teilen“ (direkt nach dem Training
 * hervorgehoben); geteilt → Kudos/Kommentare, „Im Feed ansehen“, Text ändern, nicht mehr teilen.
 */
export function ShareWorkout({ workoutId, post, highlight }: { workoutId: string; post: Post | null; highlight: boolean }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(post?.body ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  function share() {
    startTransition(async () => {
      const result = await shareWorkoutAction(workoutId, text);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setEditing(false);
      toast.success(post ? "Gespeichert" : "Geteilt! Die anderen sehen es jetzt im Feed.");
    });
  }

  function remove() {
    if (!post) return;
    startTransition(async () => {
      const result = await deletePostAction(post.id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setConfirmDelete(false);
      setText("");
      toast.success("Nicht mehr geteilt");
    });
  }

  const form = (
    <div className="space-y-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={1000}
        placeholder="Wie lief es? z. B. „Endlich 80 kg auf der Bank!“"
        className="min-h-20 bg-card text-base"
        aria-label="Text zum Training"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={share} disabled={pending} className="h-11 rounded-full px-5">
          <Send aria-hidden />
          {post ? "Speichern" : "Teilen"}
        </Button>
        {post ? (
          <Button type="button" variant="outline" onClick={() => setEditing(false)} className="h-11 rounded-full px-5">
            Abbrechen
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">Alle aus der Runde sehen das Training mit deinem Anzeigenamen: Dauer, Übungen mit bestem Satz, Volumen und neue Bestwerte.</p>
    </div>
  );

  if (!post) {
    return (
      <section className={cn("space-y-3 rounded-3xl border p-4 md:p-5", highlight ? "border-sport/40 bg-sport-soft/60" : "bg-card")} aria-labelledby="teilen">
        <h2 id="teilen" className="flex items-center gap-2 text-xl font-semibold">
          <Share2 className="size-5 text-sport" aria-hidden />
          Training teilen
        </h2>
        <p className="text-sm text-muted-foreground">Zeig den anderen im Feed, was du geschafft hast, und motiviere sie mitzuziehen.</p>
        {form}
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-3xl border bg-card p-4 md:p-5" aria-labelledby="geteilt">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="geteilt" className="flex items-center gap-2 text-xl font-semibold">
          <Share2 className="size-5 text-sport" aria-hidden />
          Geteilt
        </h2>
        <p className="flex items-center gap-3 text-sm text-muted-foreground tabular-nums">
          <span className="inline-flex items-center gap-1">
            <ThumbsUp className="size-4" aria-hidden />
            {post.kudos} Kudos
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="size-4" aria-hidden />
            {post.comments} {post.comments === 1 ? "Kommentar" : "Kommentare"}
          </span>
        </p>
      </div>
      {editing ? form : post.body ? <p className="whitespace-pre-line">{post.body}</p> : null}
      {!editing ? (
        <div className="flex flex-wrap gap-2">
          <Link href={`/sport/entdecken/feed#post-${post.id}`} className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground">
            Im Feed ansehen
          </Link>
          <Button type="button" variant="outline" onClick={() => setEditing(true)} className="h-11 rounded-full px-5">
            Text ändern
          </Button>
          <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)} className="h-11 rounded-full px-4 text-destructive">
            Nicht mehr teilen
          </Button>
        </div>
      ) : null}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nicht mehr teilen?</DialogTitle>
            <DialogDescription>Der Post verschwindet aus dem Feed, mit allen Kudos und Kommentaren. Dein Training bleibt.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>
              Behalten
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={remove}>
              Nicht mehr teilen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
