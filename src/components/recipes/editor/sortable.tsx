"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type Modifier,
  type ScreenReaderInstructions,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

// Drag & Drop im Editor (dnd-kit): gezogen wird nur am Griff, damit das Scrollen am Handy frei bleibt.
// Tastatur: Griff fokussieren, Leertaste nimmt auf, Pfeiltasten verschieben, Leertaste legt ab, Escape bricht ab.

export function useEditorSensors() {
  return useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

/** Nur senkrecht ziehen. */
export const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

export const screenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    "Zum Verschieben Leertaste oder Enter drücken. Mit den Pfeiltasten verschieben, mit Leertaste oder Enter ablegen, mit Escape abbrechen.",
};

/** Ansagen für Screenreader; `name` liefert den lesbaren Namen zu einer ID. */
export function announcements(name: (id: string | number) => string): Announcements {
  return {
    onDragStart: ({ active }) => `${name(active.id)} aufgenommen.`,
    onDragOver: ({ active, over }) => (over ? `${name(active.id)} ist jetzt bei ${name(over.id)}.` : `${name(active.id)} ist außerhalb der Liste.`),
    onDragEnd: ({ active, over }) => (over ? `${name(active.id)} abgelegt bei ${name(over.id)}.` : `${name(active.id)} abgelegt.`),
    onDragCancel: ({ active }) => `Verschieben abgebrochen. ${name(active.id)} ist zurück an seinem Platz.`,
  };
}

/** Listenzeile mit Ziehgriff links. `children` ist der restliche Inhalt der Zeile. */
export function SortableRow({
  id,
  handleLabel,
  children,
  className,
}: {
  id: string;
  /** z. B. „Olivenöl verschieben“ */
  handleLabel: string;
  children: ReactNode;
  className?: string;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn("relative flex items-stretch", isDragging && "z-10 rounded-2xl bg-card shadow-xl ring-1 ring-primary/40", className)}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={handleLabel}
        className="grid w-11 shrink-0 cursor-grab touch-none place-items-center self-stretch text-muted-foreground/60 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing"
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      {children}
    </li>
  );
}
