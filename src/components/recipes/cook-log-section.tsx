"use client";

import { useState, useTransition } from "react";
import { CalendarCheck, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addCookLogAction, deleteCookLogAction } from "@/app/kochen/actions";
import { StarRatingInput, StarValue } from "@/components/recipes/star-rating";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cookSummary, sinceText, type CookLog } from "@/lib/domain/cooklog";
import { formatDate, formatNumber } from "@/lib/format";
import { KIND_WORDS, servingsLabel } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/database.types";
import { manualCookLogSchema } from "@/lib/validation/kitchen-log";

/** Koch-Log auf der Rezeptseite: zuletzt gekocht, Anzahl, Ø-Bewertung, Notizen, Eintrag von Hand. */
export function CookLogSection({
  recipeId,
  logs,
  today,
  servings,
  kind = "dish",
}: {
  recipeId: string;
  /** neueste zuerst */
  logs: CookLog[];
  today: string;
  servings: number;
  /** Phase 15: bei Cocktails „Gemixt“ und Drinks */
  kind?: Enums<"recipe_type">;
}) {
  const [open, setOpen] = useState(false);
  const summary = cookSummary(logs);
  const w = KIND_WORDS[kind];

  return (
    <section aria-labelledby="koch-log" className="space-y-4 rounded-3xl border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="koch-log" className="flex items-center gap-2 text-xl font-semibold">
          <CalendarCheck className="size-5 text-primary" aria-hidden />
          {w.done}
        </h2>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Plus aria-hidden />
          {w.done} eintragen
        </Button>
      </div>

      {summary.count === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch nie {w.past}. Am Ende des {w.mode} („{w.done}!“) oder hier kannst du Datum, Bewertung und eine Notiz festhalten.
        </p>
      ) : (
        <>
          <p className="text-sm">
            Zuletzt {w.past} <span className="font-medium">{sinceText(summary.lastDate!, today)}</span> ·{" "}
            {summary.count === 1 ? "einmal" : `${summary.count}-mal`}
            {summary.avgRating != null ? (
              <>
                {" "}
                · Ø <StarValue value={summary.avgRating} className="font-medium" />
              </>
            ) : null}
          </p>
          <ol className="divide-y rounded-2xl border">
            {logs.map((log) => (
              <LogRow key={log.id} log={log} kind={kind} />
            ))}
          </ol>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          {open ? <CookLogForm recipeId={recipeId} today={today} servings={servings} kind={kind} onDone={() => setOpen(false)} /> : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function LogRow({ log, kind }: { log: CookLog; kind: Enums<"recipe_type"> }) {
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!window.confirm("Diesen Eintrag löschen?")) return;
    startTransition(async () => {
      const result = await deleteCookLogAction(log.id);
      if (!result.ok) toast.error(result.message);
    });
  }

  return (
    <li className="flex items-start justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0 space-y-0.5">
        <p className="flex flex-wrap items-center gap-x-2 text-sm">
          <span className="font-medium">{formatDate(`${log.date}T12:00:00Z`)}</span>
          {log.rating != null ? <StarValue value={log.rating} /> : null}
          {log.servings != null ? (
            <span className="text-muted-foreground">
              {formatNumber(log.servings, 2)} {servingsLabel(log.servings, kind)}
            </span>
          ) : null}
          {log.version != null ? <span className="text-xs text-muted-foreground">Version {log.version}</span> : null}
        </p>
        {log.note ? <p className="text-sm whitespace-pre-line text-muted-foreground">{log.note}</p> : null}
      </div>
      <Button type="button" variant="ghost" size="icon" onClick={remove} disabled={pending} aria-label="Eintrag löschen">
        <Trash2 aria-hidden />
      </Button>
    </li>
  );
}

function CookLogForm({
  recipeId,
  today,
  servings,
  kind,
  onDone,
}: {
  recipeId: string;
  today: string;
  servings: number;
  kind: Enums<"recipe_type">;
  onDone: () => void;
}) {
  const w = KIND_WORDS[kind];
  const [date, setDate] = useState(today);
  const [rating, setRating] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function save() {
    const parsed = manualCookLogSchema.safeParse({ recipeId, date, rating, note, servings });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    startTransition(async () => {
      const result = await addCookLogAction(parsed.data);
      if (result.ok) {
        toast.success("Eingetragen.");
        onDone();
      } else setError(result.message);
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{w.done} eintragen</DialogTitle>
        <DialogDescription>Bewertung und Notiz sind freiwillig. Die Notiz siehst du beim nächsten {kind === "cocktail" ? "Mixen" : "Kochen"}.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="log-date">Wann?</Label>
          <Input id="log-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </div>
        <fieldset className="grid gap-1.5">
          <legend className="mb-1 text-sm font-medium">Bewertung</legend>
          <StarRatingInput value={rating} onChange={setRating} />
        </fieldset>
        <div className="grid gap-1.5">
          <Label htmlFor="log-note">Notiz</Label>
          <Textarea id="log-note" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. nächstes Mal mehr Chili" />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
      <DialogFooter>
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "Wird gespeichert …" : "Speichern"}
        </Button>
      </DialogFooter>
    </>
  );
}
