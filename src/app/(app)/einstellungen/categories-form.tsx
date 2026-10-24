"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ListCard } from "@/components/layout/list-blocks";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { CATEGORY_MAX } from "@/lib/domain/categories";
import { addCategoryAction, deleteCategoryAction, renameCategoryAction } from "./category-actions";

export type CategoryItem = { id: string; name: string; count: number };

const iconButton =
  "grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50 [&_svg]:size-4";

const recipeCount = (n: number) => (n === 0 ? "kein Rezept" : n === 1 ? "1 Rezept" : `${n} Rezepte`);

/**
 * Einstellungen → Kategorien: eigene Liste für die Küche. Umbenennen nimmt die Rezepte mit; beim Löschen wählt man,
 * wohin die Rezepte der Kategorie wandern (oder „ohne Kategorie“).
 */
export function CategoriesForm({ items }: { items: CategoryItem[] }) {
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<CategoryItem | null>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function add() {
    setError(undefined);
    startTransition(async () => {
      const result = await addCategoryAction(newName);
      if (result.ok) {
        toast.success(`„${newName.trim()}“ angelegt.`);
        setNewName("");
      } else setError(result.message);
    });
  }

  function rename() {
    if (!editing) return;
    setError(undefined);
    startTransition(async () => {
      const result = await renameCategoryAction(editing);
      if (result.ok) setEditing(null);
      else setError(result.message);
    });
  }

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          Noch keine Kategorien. Leg unten deine erste an.
        </p>
      ) : (
        <ListCard>
          {items.map((item) =>
            editing?.id === item.id ? (
              <li key={item.id} className="flex min-h-14 items-center gap-1 py-1.5 pr-1.5 pl-3">
                <Input
                  value={editing.name}
                  maxLength={CATEGORY_MAX}
                  autoFocus
                  aria-label={`Neuer Name für ${item.name}`}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") rename();
                    if (e.key === "Escape") setEditing(null);
                  }}
                  className="min-w-0 flex-1"
                />
                <button type="button" onClick={rename} disabled={pending || !editing.name.trim()} aria-label="Namen speichern" className={iconButton}>
                  <Check aria-hidden />
                </button>
                <button type="button" onClick={() => setEditing(null)} aria-label="Abbrechen" className={iconButton}>
                  <X aria-hidden />
                </button>
              </li>
            ) : (
              <li key={item.id} className="flex min-h-14 items-center gap-1 py-1.5 pr-1.5 pl-4">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.name}</span>
                  <span className="block text-xs text-muted-foreground">{recipeCount(item.count)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setError(undefined);
                    setEditing({ id: item.id, name: item.name });
                  }}
                  aria-label={`${item.name} umbenennen`}
                  className={iconButton}
                >
                  <Pencil aria-hidden />
                </button>
                <button type="button" onClick={() => setDeleting(item)} aria-label={`${item.name} löschen`} className={iconButton}>
                  <Trash2 aria-hidden />
                </button>
              </li>
            ),
          )}
        </ListCard>
      )}

      <div className="flex gap-2">
        <div className="grid min-w-0 flex-1 gap-1.5">
          <Label htmlFor="new-category" className="sr-only">
            Neue Kategorie
          </Label>
          <Input
            id="new-category"
            value={newName}
            maxLength={CATEGORY_MAX}
            placeholder="Neue Kategorie, z. B. Ofengericht"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && newName.trim() && add()}
          />
        </div>
        <Button type="button" onClick={add} disabled={pending || !newName.trim()}>
          <Plus aria-hidden />
          Hinzufügen
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <DeleteCategoryDialog item={deleting} others={items.filter((i) => i.id !== deleting?.id).map((i) => i.name)} onClose={() => setDeleting(null)} />
    </div>
  );
}

function DeleteCategoryDialog({ item, others, onClose }: { item: CategoryItem | null; others: string[]; onClose: () => void }) {
  return (
    <Dialog open={item != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">{item ? <DeleteCategoryForm key={item.id} item={item} others={others} onDone={onClose} /> : null}</DialogContent>
    </Dialog>
  );
}

function DeleteCategoryForm({ item, others, onDone }: { item: CategoryItem; others: string[]; onDone: () => void }) {
  const [moveTo, setMoveTo] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const result = await deleteCategoryAction({ id: item.id, moveTo: moveTo || null });
      if (result.ok) {
        toast.success(result.message ?? "Gelöscht.");
        onDone();
      } else setError(result.message);
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="pr-8">„{item.name}“ löschen?</DialogTitle>
        <DialogDescription>
          {item.count === 0
            ? "In dieser Kategorie steht kein Rezept."
            : `${item.count === 1 ? "1 Rezept steht" : `${item.count} Rezepte stehen`} in dieser Kategorie. Wohin sollen ${item.count === 1 ? "es" : "sie"}?`}
        </DialogDescription>
      </DialogHeader>
      {item.count > 0 ? (
        <div className="grid gap-1.5">
          <Label htmlFor="move-to">Rezepte verschieben nach</Label>
          <NativeSelect id="move-to" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
            <option value="">Ohne Kategorie</option>
            {others.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Abbrechen
        </Button>
        <Button type="button" variant="destructive" onClick={remove} disabled={pending}>
          <Trash2 aria-hidden />
          {pending ? "Wird gelöscht …" : "Löschen"}
        </Button>
      </DialogFooter>
    </>
  );
}
