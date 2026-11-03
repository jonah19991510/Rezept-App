"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Copy, Dumbbell, EllipsisVertical, Footprints, MessageCircle, Pencil, Send, ThumbsUp, Trash2, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { addCommentAction, copyPostAsPlanAction, deleteCommentAction, deletePostAction, setKudosAction } from "@/app/(app)/sport/feed/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { kudosLabel, recordLabel, summaryStats, whenLabel } from "@/lib/domain/posts";
import { initials } from "@/lib/initials";
import type { FeedPost } from "@/lib/server/posts";
import { cn } from "@/lib/utils";

const EXERCISES_SHOWN = 5;
const COMMENTS_SHOWN = 2;
const ITEM = "min-h-11 gap-2.5 px-2.5";

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full bg-sport-soft font-semibold text-sport", size === "md" ? "size-11" : "size-8 text-xs")} aria-hidden>
      {initials(name)}
    </span>
  );
}

/**
 * Ein geteiltes Training im Feed (wie bei Strava): Person und Zeit, Titel und Text, Kennzahlen, neue Bestwerte,
 * Übungen mit bestem Satz; unten Kudos, Kommentare und „Nachmachen“.
 */
export function FeedCard({ post, today, meId, isAdmin }: { post: FeedPost; today: string; meId: string; isAdmin: boolean }) {
  const [kudoed, setKudoed] = useState(post.kudoedByMe);
  const [allExercises, setAllExercises] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [allComments, setAllComments] = useState(false);
  const [comment, setComment] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const s = post.summary;
  // Lokal angefeuert, bevor der Server antwortet: „Du“ vorn, dann die anderen
  const kudosNames = [...(kudoed ? ["Du"] : []), ...post.kudos.filter((k) => k.userId !== meId).map((k) => k.name)];
  const kudosCount = kudosNames.length;
  const exercises = allExercises ? s.exercises : s.exercises.slice(0, EXERCISES_SHOWN);
  const comments = allComments ? post.comments : post.comments.slice(-COMMENTS_SHOWN);
  const KindIcon = s.kind === "cardio" ? Footprints : Dumbbell;

  function toggleKudos() {
    const next = !kudoed;
    if (next) navigator.vibrate?.(12);
    setKudoed(next);
    startTransition(async () => {
      const result = await setKudosAction(post.id, next);
      if (!result.ok) {
        setKudoed(!next);
        toast.error(result.message);
      }
    });
  }

  function sendComment() {
    const text = comment.trim();
    if (!text) return;
    startTransition(async () => {
      const result = await addCommentAction(post.id, text);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setComment("");
      setAllComments(true);
    });
  }

  function removeComment(id: string) {
    startTransition(async () => {
      const result = await deleteCommentAction(id);
      if (!result.ok) toast.error(result.message);
    });
  }

  function copyAsPlan() {
    startTransition(async () => {
      const result = await copyPostAsPlanAction(post.id);
      if (result && !result.ok) toast.error(result.message);
    });
  }

  function removePost() {
    startTransition(async () => {
      const result = await deletePostAction(post.id);
      if (!result.ok) toast.error(result.message);
      else setConfirmDelete(false);
    });
  }

  return (
    <article id={`post-${post.id}`} className="scroll-mt-24 rounded-3xl border bg-card" aria-labelledby={`post-title-${post.id}`}>
      <header className="flex items-center gap-3 px-4 pt-4 md:px-5">
        <Avatar name={post.authorName} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {post.authorName}
            {post.isMine ? <span className="font-normal text-muted-foreground"> (du)</span> : null}
          </p>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <KindIcon className="size-3.5" aria-hidden />
            {whenLabel(post.trainedAt, post.trainedOn, today)}
          </p>
        </div>
        {post.isMine || isAdmin ? (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full" aria-label="Aktionen für diesen Post" disabled={pending} />}>
              <EllipsisVertical className="size-5" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5">
              {post.isMine ? (
                <DropdownMenuItem className={ITEM} render={<Link href={`/sport/verlauf/${post.workoutId}`} />}>
                  <Pencil aria-hidden />
                  Text ändern
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem className={ITEM} variant="destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 aria-hidden />
                {post.isMine ? "Nicht mehr teilen" : "Post löschen (Admin)"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </header>

      <div className="space-y-3 px-4 pt-3 pb-4 md:px-5">
        <h2 id={`post-title-${post.id}`} className="text-2xl leading-tight font-semibold wrap-anywhere">
          {s.title}
        </h2>
        {post.body ? <p className="whitespace-pre-line wrap-anywhere">{post.body}</p> : null}

        <dl className="flex flex-wrap gap-x-6 gap-y-2">
          {summaryStats(s).map((x) => (
            <div key={x.label}>
              <dt className="text-xs text-muted-foreground">{x.label}</dt>
              <dd className="text-lg font-semibold tabular-nums">{x.value}</dd>
            </div>
          ))}
        </dl>

        {s.records.length ? (
          <div className="rounded-2xl bg-sport-soft/70 p-3">
            <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-sport">
              <Trophy className="size-4" aria-hidden />
              {s.records.length === 1 ? "Neuer Bestwert" : `${s.records.length} neue Bestwerte`}
            </p>
            <ul className="space-y-0.5 text-sm">
              {s.records.slice(0, 4).map((r) => (
                <li key={`${r.exerciseId}-${r.kind}`}>{recordLabel(r)}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {s.exercises.length ? (
          <ul className="divide-y rounded-2xl border">
            {exercises.map((e) => (
              <li key={e.exerciseId} className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{e.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{e.sets === 1 ? "1 Satz" : `${e.sets} Sätze`}</span>
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  <span className="block text-xs text-muted-foreground">Bester Satz</span>
                  {e.best}
                </span>
              </li>
            ))}
            {s.exercises.length > EXERCISES_SHOWN ? (
              <li>
                <button type="button" onClick={() => setAllExercises((v) => !v)} className="min-h-11 w-full px-3 text-left text-sm font-medium text-primary hover:underline">
                  {allExercises ? "Weniger zeigen" : `+${s.exercises.length - EXERCISES_SHOWN} ${s.exercises.length - EXERCISES_SHOWN === 1 ? "weitere Übung" : "weitere Übungen"}`}
                </button>
              </li>
            ) : null}
          </ul>
        ) : null}

        {kudosCount > 0 ? (
          <p className="text-sm text-muted-foreground">
            <ThumbsUp className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />
            {kudosLabel(kudosNames)} {kudosCount > 1 ? "feuern an" : kudoed ? "feuerst an" : "feuert an"}
          </p>
        ) : null}
      </div>

      <div className="flex gap-1 border-t px-2 py-1.5">
        <Button
          type="button"
          variant="ghost"
          onClick={toggleKudos}
          disabled={post.isMine}
          aria-pressed={kudoed}
          className={cn("h-11 min-w-0 flex-1 rounded-full px-2", kudoed && "text-sport")}
          title={post.isMine ? "Eigene Trainings kannst du nicht anfeuern" : undefined}
        >
          <ThumbsUp className={cn(kudoed && "fill-current")} aria-hidden />
          Kudos{kudosCount ? <span className="tabular-nums"> {kudosCount}</span> : null}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setCommentsOpen((v) => !v)}
          aria-expanded={commentsOpen || post.comments.length > 0}
          aria-label={`Kommentieren${post.comments.length ? `, ${post.comments.length} Kommentare` : ""}`}
          className="h-11 min-w-0 flex-1 rounded-full px-2"
        >
          <MessageCircle aria-hidden />
          {/* Am Handy nur Symbol und Zahl, sonst passt „Nachmachen“ nicht daneben */}
          <span className="hidden sm:inline">Kommentieren</span>
          {post.comments.length ? <span className="tabular-nums">{post.comments.length}</span> : null}
        </Button>
        {!post.isMine && s.exercises.length ? (
          <Button type="button" variant="ghost" onClick={copyAsPlan} disabled={pending} className="h-11 min-w-0 flex-1 rounded-full px-2">
            <Copy aria-hidden />
            Nachmachen
          </Button>
        ) : null}
      </div>

      {post.comments.length || commentsOpen ? (
        <div className="space-y-3 border-t px-4 py-3 md:px-5">
          {post.comments.length > COMMENTS_SHOWN && !allComments ? (
            <button type="button" onClick={() => setAllComments(true)} className="min-h-9 text-sm font-medium text-primary hover:underline">
              Alle {post.comments.length} Kommentare
            </button>
          ) : null}
          {comments.length ? (
            <ul className="space-y-2.5">
              {comments.map((c) => (
                <li key={c.id} className="flex gap-2.5">
                  <Avatar name={c.name} size="sm" />
                  <div className="min-w-0 flex-1 rounded-2xl bg-muted/60 px-3 py-2">
                    <p className="text-sm">
                      <span className="font-semibold">{c.name}</span> <span className="whitespace-pre-line wrap-anywhere">{c.body}</span>
                    </p>
                  </div>
                  {c.isMine || post.isMine || isAdmin ? (
                    <Button type="button" variant="ghost" size="icon" className="shrink-0 rounded-full" onClick={() => removeComment(c.id)} disabled={pending} aria-label="Kommentar löschen">
                      <X className="size-4" aria-hidden />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              sendComment();
            }}
          >
            <Input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              placeholder={post.isMine ? "Antworten …" : "Anfeuern, fragen, gratulieren …"}
              aria-label="Kommentar schreiben"
              className="h-11 min-w-0 flex-1 rounded-full text-base"
            />
            <Button type="submit" size="icon-lg" className="shrink-0 rounded-full" disabled={pending || !comment.trim()} aria-label="Kommentar senden">
              <Send aria-hidden />
            </Button>
          </form>
        </div>
      ) : null}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{post.isMine ? "Nicht mehr teilen?" : "Post löschen?"}</DialogTitle>
            <DialogDescription>Der Post verschwindet aus dem Feed, mit allen Kudos und Kommentaren. Das Training selbst bleibt.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>
              Abbrechen
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={removePost}>
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
