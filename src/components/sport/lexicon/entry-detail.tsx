"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteEntryAction, setEntryPublicAction } from "@/app/(app)/sport/lexikon/actions";
import { TagLabel } from "@/components/layout/list-blocks";
import { EditorSheet, FieldHeading } from "@/components/recipes/editor/editor-parts";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { backlinks, entryCategories, type LexiconCategory, type LexiconEntry } from "@/lib/domain/lexicon";
import { formatDate } from "@/lib/format";
import { CategoryLabel, FactsTable, RichText, SourceText, TableView, type LinkHandler } from "./lexicon-parts";

/**
 * Eintrag ansehen: Kategorien, Fakten, Text und Tabellen, Stichworte, Quelle, Verweise hierher. [[Links]] öffnen den
 * anderen Eintrag im selben Sheet (mit Zurück). Schreibende: veröffentlichen, bearbeiten, löschen.
 */
export function EntryDetail({
  entry,
  entries,
  categories,
  canWrite,
  links,
  canGoBack,
  onBack,
  onEdit,
  onClose,
}: {
  entry: LexiconEntry;
  entries: LexiconEntry[];
  categories: LexiconCategory[];
  canWrite: boolean;
  links: LinkHandler;
  canGoBack: boolean;
  onBack: () => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const shownCategories = entryCategories(entry, categories);
  const refs = backlinks(entry, entries);
  const empty = !entry.facts.length && !entry.blocks.length;

  function close() {
    setOpen(false);
    setTimeout(onClose, 300);
  }

  function setPublic(isPublic: boolean) {
    startTransition(async () => {
      const result = await setEntryPublicAction(entry.id, isPublic);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(isPublic ? "Veröffentlicht: alle sehen den Eintrag." : "Zurück zum Entwurf: nur du siehst ihn.");
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteEntryAction(entry.id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(`${entry.term} gelöscht`);
      router.refresh();
      close();
    });
  }

  const deleting = confirmDelete === entry.id;

  return (
    <EditorSheet
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : close())}
      title={entry.term}
      description={`Zuletzt bearbeitet am ${formatDate(entry.updatedAt)}`}
      leading={
        canGoBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Zurück zum vorigen Eintrag"
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted transition hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </button>
        ) : null
      }
      footer={
        canWrite ? (
          deleting ? (
            <>
              <Button type="button" variant="destructive" size="lg" onClick={remove} disabled={pending} className="flex-1">
                Wirklich löschen
              </Button>
              <Button type="button" variant="outline" size="lg" onClick={() => setConfirmDelete(null)}>
                Abbrechen
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" size="icon-lg" onClick={() => setConfirmDelete(entry.id)} aria-label="Eintrag löschen">
                <Trash2 aria-hidden />
              </Button>
              <Button type="button" size="lg" onClick={onEdit} className="flex-1">
                <Pencil aria-hidden />
                Bearbeiten
              </Button>
            </>
          )
        ) : (
          <Button type="button" size="lg" onClick={close} className="flex-1">
            Fertig
          </Button>
        )
      }
    >
      {deleting ? <p className="rounded-2xl bg-destructive/10 p-3 text-sm">„{entry.term}“ wird für alle gelöscht. Links darauf bleiben als Text stehen.</p> : null}

      {shownCategories.length || !entry.isPublic ? (
        <div className="flex flex-wrap gap-1.5">
          {!entry.isPublic ? <TagLabel>Entwurf</TagLabel> : null}
          {shownCategories.map(({ category, parent }) => (
            <CategoryLabel key={category.id} category={category} parent={parent} />
          ))}
        </div>
      ) : null}

      {canWrite ? (
        <label className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border px-4 py-2">
          <span>
            <span className="block font-medium">Öffentlich</span>
            <span className="block text-sm text-muted-foreground">
              {entry.isPublic ? "Alle aus der Runde sehen den Eintrag." : "Entwurf: nur du siehst ihn."}
            </span>
          </span>
          <Switch checked={entry.isPublic} onCheckedChange={setPublic} disabled={pending} />
        </label>
      ) : null}

      {entry.facts.length ? <FactsTable facts={entry.facts} links={links} /> : null}

      {entry.blocks.map((b, i) =>
        b.type === "text" ? <RichText key={i} text={b.text} links={links} /> : <TableView key={i} rows={b.rows} links={links} />,
      )}

      {empty ? <p className="text-muted-foreground">Zu diesem Begriff gibt es noch keinen Text.</p> : null}

      {entry.keywords.length ? (
        <section>
          <FieldHeading>Stichworte</FieldHeading>
          <div className="flex flex-wrap gap-1.5">
            {entry.keywords.map((k) => (
              <span key={k} className="rounded-full border px-2.5 py-0.5 text-sm text-muted-foreground">
                {k}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {entry.source ? (
        <section>
          <FieldHeading>Quelle</FieldHeading>
          <p className="text-sm">
            <SourceText text={entry.source} />
          </p>
        </section>
      ) : null}

      {refs.length ? (
        <section>
          <FieldHeading>Verweise hierher</FieldHeading>
          <div className="flex flex-wrap gap-2">
            {refs.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => links.open(r.id)}
                className="inline-flex min-h-11 items-center rounded-full border bg-card px-4 text-sm font-medium transition hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {r.term}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </EditorSheet>
  );
}
