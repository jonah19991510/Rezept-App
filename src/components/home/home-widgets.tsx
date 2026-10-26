"use client";

import { useState, useTransition, type ReactNode } from "react";
import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Eye, EyeOff, RotateCcw, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { saveHomeLayoutAction } from "@/app/(app)/home-actions";
import {
  announcements,
  screenReaderInstructions,
  SortableRow,
  useEditorSensors,
  verticalOnly,
} from "@/components/recipes/editor/sortable";
import { Button } from "@/components/ui/button";
import { defaultHomeLayout, HOME_WIDGETS, type HomeWidget, type HomeWidgetId } from "@/lib/domain/home";
import { cn } from "@/lib/utils";

const META = new Map(HOME_WIDGETS.map((w) => [w.id, w]));

/**
 * Widgets der Startseite in der gespeicherten Reihenfolge. „Startseite anpassen“ zeigt eine Liste zum Sortieren
 * (Ziehen am Griff, auch per Tastatur) und Ein-/Ausblenden; „Fertig“ speichert im Konto.
 * `widgets` enthält nur die sichtbaren Widgets (die Seite lädt nur deren Daten); nach dem Speichern lädt sie neu.
 */
export function HomeWidgets({ layout, widgets }: { layout: HomeWidget[]; widgets: Partial<Record<HomeWidgetId, ReactNode>> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(layout);
  const [pending, startTransition] = useTransition();
  const sensors = useEditorSensors();

  const shown = layout.filter((w) => w.visible && widgets[w.id] != null);

  function startEditing() {
    setDraft(layout);
    setEditing(true);
  }

  function save(next: HomeWidget[]) {
    startTransition(async () => {
      const result = await saveHomeLayoutAction(next);
      if (result.ok) setEditing(false);
      else toast.error("Die Startseite konnte nicht gespeichert werden. Bitte versuch es noch einmal.");
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    setDraft((prev) => arrayMove(prev, prev.findIndex((w) => w.id === active.id), prev.findIndex((w) => w.id === over.id)));
  }

  const label = (id: string | number) => META.get(id as HomeWidgetId)?.label ?? "Widget";

  if (!editing) {
    return (
      <>
        {shown.length > 0 ? (
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
            {shown.map((w) => (
              <div key={w.id} className="min-w-0">
                {widgets[w.id]}
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-3xl border border-dashed p-6 text-center text-muted-foreground">
            Alle Widgets sind ausgeblendet. Über „Startseite anpassen“ holst du sie zurück.
          </p>
        )}
        <div className="mt-6 flex justify-center">
          <Button variant="ghost" onClick={startEditing} className="text-muted-foreground">
            <SlidersHorizontal aria-hidden />
            Startseite anpassen
          </Button>
        </div>
      </>
    );
  }

  return (
    <section aria-labelledby="home-anpassen" className="mx-auto max-w-xl">
      <h2 id="home-anpassen" className="text-2xl font-semibold">
        Startseite anpassen
      </h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">Am Griff ziehen zum Sortieren, mit dem Auge ein- und ausblenden.</p>

      <div className="rounded-3xl border bg-card">
        <DndContext
          id="dnd-startseite"
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[verticalOnly]}
          onDragEnd={onDragEnd}
          accessibility={{ announcements: announcements(label), screenReaderInstructions }}
        >
          <SortableContext items={draft.map((w) => w.id)} strategy={verticalListSortingStrategy}>
            <ol className="divide-y" aria-label="Widgets">
              {draft.map((w) => {
                const meta = META.get(w.id)!;
                return (
                  <SortableRow key={w.id} id={w.id} handleLabel={`${meta.label} verschieben`}>
                    <div className={cn("flex min-w-0 flex-1 items-center gap-3 py-3 pr-2", !w.visible && "opacity-55")}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{meta.label}</span>
                        <span className="block truncate text-sm text-muted-foreground">{meta.description}</span>
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-pressed={w.visible}
                        aria-label={`${meta.label} ${w.visible ? "ausblenden" : "einblenden"}`}
                        onClick={() => setDraft((prev) => prev.map((x) => (x.id === w.id ? { ...x, visible: !x.visible } : x)))}
                        className={w.visible ? "text-foreground" : "text-muted-foreground"}
                      >
                        {w.visible ? <Eye className="size-5" aria-hidden /> : <EyeOff className="size-5" aria-hidden />}
                      </Button>
                    </div>
                  </SortableRow>
                );
              })}
            </ol>
          </SortableContext>
        </DndContext>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => setDraft(defaultHomeLayout())} disabled={pending} className="text-muted-foreground">
          <RotateCcw aria-hidden />
          Standard
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditing(false)} disabled={pending}>
            Abbrechen
          </Button>
          <Button onClick={() => save(draft)} disabled={pending}>
            {pending ? "Speichert …" : "Fertig"}
          </Button>
        </div>
      </div>
    </section>
  );
}
