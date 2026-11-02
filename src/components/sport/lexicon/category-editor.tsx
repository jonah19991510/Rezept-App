"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, ChevronDown, ChevronRight, ChevronUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCategoryAction, reorderCategoriesAction, saveCategoryAction } from "@/app/(app)/sport/lexikon/actions";
import { EditorSheet, FieldHeading } from "@/components/recipes/editor/editor-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DRINK_COLOR_KEYS, DRINK_COLORS, type DrinkColor } from "@/lib/domain/drinks";
import { categoryTree, LEXICON_LIMITS, type LexiconCategory } from "@/lib/domain/lexicon";
import { cn } from "@/lib/utils";
import { CategoryDot } from "./lexicon-parts";

type Editing = { id: string | null; parentId: string | null; name: string; color: string };

const rowButton =
  "grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-30";

/**
 * Kategorien bearbeiten: Liste der Haupt- und Unterkategorien mit Pfeilen zum Sortieren; Antippen öffnet Name und
 * Farbe (dort auch Löschen). Neue Haupt- oder Unterkategorie über die Plus-Knöpfe.
 */
export function CategoryEditor({ categories, counts, onClose }: { categories: LexiconCategory[]; counts: Map<string, number>; onClose: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const tree = categoryTree(categories);
  const current = editing?.id ? categories.find((c) => c.id === editing.id) : null;
  const parent = editing?.parentId ? categories.find((c) => c.id === editing.parentId) : null;

  function close() {
    setOpen(false);
    setTimeout(onClose, 300);
  }

  function edit(next: Editing | null) {
    setEditing(next);
    setConfirmDelete(false);
    setError(null);
  }

  function reorder(siblings: LexiconCategory[], index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= siblings.length) return;
    const ids = siblings.map((s) => s.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    startTransition(async () => {
      const result = await reorderCategoriesAction(ids);
      if (!result.ok) toast.error(result.message);
      router.refresh();
    });
  }

  function save() {
    if (!editing) return;
    startTransition(async () => {
      const result = await saveCategoryAction(editing.id, { name: editing.name, color: editing.color as DrinkColor, parentId: editing.parentId });
      if (!result.ok) {
        setError(result.fieldErrors?.name?.[0] ?? result.message ?? "Bitte die Angaben prüfen.");
        return;
      }
      toast.success(editing.id ? "Gespeichert" : `${editing.name.trim()} angelegt`);
      edit(null);
      router.refresh();
    });
  }

  function remove() {
    if (!current) return;
    startTransition(async () => {
      const result = await deleteCategoryAction(current.id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(`${current.name} gelöscht`);
      edit(null);
      router.refresh();
    });
  }

  const row = (c: LexiconCategory, siblings: LexiconCategory[], index: number, sub: boolean) => (
    <li key={c.id} className={cn("flex items-center gap-1 py-1 pr-1", sub ? "pl-8" : "pl-3")}>
      <button
        type="button"
        onClick={() => edit({ id: c.id, parentId: c.parentId, name: c.name, color: c.color })}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1 text-left transition hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {sub ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : <CategoryDot color={c.color} className="size-3" />}
        <span className={cn("truncate", !sub && "font-medium")}>{c.name}</span>
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{counts.get(c.id) ?? 0}</span>
      </button>
      <button type="button" className={rowButton} onClick={() => reorder(siblings, index, -1)} disabled={pending || index === 0} aria-label={`${c.name} nach oben`}>
        <ChevronUp className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        className={rowButton}
        onClick={() => reorder(siblings, index, 1)}
        disabled={pending || index === siblings.length - 1}
        aria-label={`${c.name} nach unten`}
      >
        <ChevronDown className="size-4" aria-hidden />
      </button>
    </li>
  );

  return (
    <EditorSheet
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : close())}
      title={editing ? (editing.id ? "Kategorie bearbeiten" : parent ? `Unterkategorie von ${parent.name}` : "Neue Kategorie") : "Kategorien"}
      description={editing ? undefined : "Antippen zum Umbenennen oder Umfärben; Pfeile ändern die Reihenfolge."}
      footer={
        editing ? (
          confirmDelete ? (
            <>
              <Button type="button" variant="destructive" size="lg" onClick={remove} disabled={pending} className="flex-1">
                Wirklich löschen
              </Button>
              <Button type="button" variant="outline" size="lg" onClick={() => setConfirmDelete(false)}>
                Abbrechen
              </Button>
            </>
          ) : (
            <>
              {current ? (
                <Button type="button" variant="outline" size="icon-lg" onClick={() => setConfirmDelete(true)} aria-label="Kategorie löschen">
                  <Trash2 aria-hidden />
                </Button>
              ) : null}
              <Button type="button" variant="outline" size="lg" onClick={() => edit(null)}>
                Zurück
              </Button>
              <Button type="button" size="lg" onClick={save} disabled={pending || editing.name.trim() === ""} className="flex-1">
                Speichern
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
      {editing ? (
        <>
          {confirmDelete && current ? (
            <p className="rounded-2xl bg-destructive/10 p-3 text-sm">
              Die Einträge bleiben erhalten, nur die Zuordnung zu „{current.name}“ fällt weg
              {current.parentId == null && categories.some((c) => c.parentId === current.id) ? ". Die Unterkategorien werden mit gelöscht." : "."}
            </p>
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor="lex-cat-name">Name</Label>
            <Input
              id="lex-cat-name"
              value={editing.name}
              maxLength={LEXICON_LIMITS.categoryName}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              className="h-12 text-base"
              aria-invalid={Boolean(error)}
              placeholder={parent ? "z. B. Aminosäuren" : "z. B. Ernährung"}
              autoFocus={!editing.id}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          {editing.parentId == null ? (
            <section>
              <FieldHeading>Farbe</FieldHeading>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Farbe">
                {DRINK_COLOR_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={editing.color === key}
                    aria-label={DRINK_COLORS[key].label}
                    title={DRINK_COLORS[key].label}
                    onClick={() => setEditing({ ...editing, color: key })}
                    className={cn(
                      "grid size-11 place-items-center rounded-full ring-offset-2 ring-offset-popover transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                      editing.color === key && "ring-2 ring-foreground",
                    )}
                    style={{ background: DRINK_COLORS[key].value }}
                  >
                    {editing.color === key ? <Check className="size-5 text-white drop-shadow" aria-hidden /> : null}
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <p className="text-sm text-muted-foreground">Unterkategorien haben die Farbe ihrer Kategorie.</p>
          )}
        </>
      ) : (
        <>
          {tree.length ? (
            <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
              {tree.map((node, i) => (
                <li key={node.id}>
                  <ul>
                    {row(node, tree, i, false)}
                    {node.children.map((s, j) => row(s, node.children, j, true))}
                    <li className="pb-1 pl-8">
                      <button
                        type="button"
                        onClick={() => edit({ id: null, parentId: node.id, name: "", color: node.color })}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-1 text-sm text-muted-foreground transition hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        <Plus className="size-4" aria-hidden />
                        Unterkategorie
                      </button>
                    </li>
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Noch keine Kategorien.</p>
          )}
          <Button
            type="button"
            variant="outline"
            className="h-12"
            onClick={() => edit({ id: null, parentId: null, name: "", color: DRINK_COLOR_KEYS.find((k) => !categories.some((c) => c.color === k)) ?? "grau" })}
          >
            <Plus aria-hidden />
            Neue Kategorie
          </Button>
        </>
      )}
    </EditorSheet>
  );
}
