"use client";

import { useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Drawer, DrawerBody, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

// Kleine Bausteine des Rezept-Editors (Design vom 25.10.2026).

const DESKTOP_QUERY = "(min-width: 768px)";

function subscribeDesktop(onChange: () => void) {
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/** true ab Tablet-Breite (md). Auf dem Server false; die Sheets sind dort ohnehin zu. */
export function useIsDesktop() {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}

/**
 * Inhalt eines Sheets: scrollt selbst. `*:min-h-min`: Kinder schrumpfen nie unter ihre Inhaltshöhe. Sonst drückt das
 * Grid Kinder mit `overflow-hidden` (z. B. runde Listen) auf die Resthöhe zusammen, schneidet sie ab, der Inhalt
 * scrollt nicht mehr und das Sheet nimmt jede Wischbewegung als „Sheet ziehen“.
 */
const BODY_CLASS = "grid min-h-0 flex-1 grid-cols-1 content-start gap-6 overflow-y-auto overscroll-contain px-5 py-5 *:min-h-min";

/**
 * Bearbeiten-Sheet: auf dem Handy ein Drawer von unten (Wischen nach unten schließt), am Desktop ein zentrierter
 * Dialog (max. 640 px). Kopf mit Titel, Unterzeile und X; Inhalt scrollt; Fuß mit den Knöpfen bleibt stehen.
 */
export function EditorSheet({
  open,
  onOpenChange,
  title,
  description,
  leading,
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** z. B. Nummer des Schritts vor dem Titel */
  leading?: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const desktop = useIsDesktop();
  const closeClass =
    "grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-foreground transition hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";
  const header = (Title: typeof DrawerTitle, Description: typeof DrawerDescription, Close: typeof DrawerClose) => (
    <div className="flex shrink-0 items-start gap-3 px-5 pt-3 md:pt-5">
      {leading}
      <div className="min-w-0 flex-1">
        <Title className="text-2xl leading-tight font-semibold tracking-tight wrap-anywhere">{title}</Title>
        {description ? <Description className="mt-1 text-sm text-muted-foreground">{description}</Description> : null}
      </div>
      <Close className={closeClass} aria-label="Schließen">
        <X className="size-5" aria-hidden />
      </Close>
    </div>
  );
  const footerBox = <div className="flex shrink-0 gap-3 border-t px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-5">{footer}</div>;

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[min(90dvh,56rem)] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-[640px]"
        >
          {header(DialogTitle as typeof DrawerTitle, DialogDescription as typeof DrawerDescription, DialogClose as typeof DrawerClose)}
          <div className={BODY_CLASS}>{children}</div>
          {footerBox}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        {header(DrawerTitle, DrawerDescription, DrawerClose)}
        <DrawerBody className={BODY_CLASS}>{children}</DrawerBody>
        {footerBox}
      </DrawerContent>
    </Drawer>
  );
}

/** Überschrift eines Bereichs im Sheet bzw. über einer Karte („Menge“, „Eckdaten“). */
export function FieldHeading({ children, aside, id, htmlFor }: { children: ReactNode; aside?: ReactNode; id?: string; htmlFor?: string }) {
  const Tag = htmlFor ? "label" : "p";
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3 px-0.5">
      <Tag id={id} htmlFor={htmlFor} className="text-sm font-semibold text-muted-foreground">
        {children}
      </Tag>
      {aside ? <span className="text-xs text-muted-foreground">{aside}</span> : null}
    </div>
  );
}

/** Nummer im Akzentkreis (Schritt). `muted` für „Ohne Schritt“. */
export function StepNumber({ n, size = "md", muted }: { n: ReactNode; size?: "sm" | "md" | "lg"; muted?: boolean }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold tabular-nums",
        muted ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground",
        size === "sm" && "size-6 text-xs",
        size === "md" && "size-7 text-sm",
        size === "lg" && "size-11 text-lg",
      )}
      aria-hidden
    >
      {n}
    </span>
  );
}

/** Kleines Schritt-Badge „S3“. */
export function StepBadge({ n, className }: { n: number; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-md bg-muted px-1.5 py-px text-[0.7rem] font-semibold text-muted-foreground", className)}>
      <span className="sr-only">Schritt </span>
      <span aria-hidden>S</span>
      {n}
    </span>
  );
}

/** Chip zur Einzelauswahl (Kategorie, Glas, Methode): gewählt in Akzentfarbe mit Häkchen. */
export const choiceChipClass = (selected: boolean) =>
  cn(
    "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&_svg]:size-4 [&_svg]:shrink-0",
    selected ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-muted",
  );

/** Pfeiltasten in einer Radiogruppe aus Knöpfen (onKeyDown der Gruppe): wählt und fokussiert den Nachbarn. */
export function radioKeys<T>(values: readonly T[], value: T | null, onChange: (v: T) => void) {
  return (e: KeyboardEvent<HTMLElement>) => {
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!delta || values.length === 0) return;
    e.preventDefault();
    const current = value == null ? -1 : values.indexOf(value);
    const next = (current + delta + values.length) % values.length;
    onChange(values[next]);
    e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  };
}

/** Segment-Leiste zur Einzelauswahl (Timer, Einheit, Ansicht). Optional ein Zusatzknopf am Ende (z. B. „Mehr“). */
export function RadioSegments<T extends string>({
  label,
  value,
  options,
  onChange,
  size = "md",
  extra,
  className,
}: {
  label: string;
  value: T | null;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  size?: "sm" | "md";
  extra?: ReactNode;
  className?: string;
}) {
  const onKeyDown = radioKeys(
    options.map((o) => o.value),
    value,
    onChange,
  );
  const selectedIndex = options.findIndex((o) => o.value === value);
  return (
    <div className={cn("flex rounded-2xl bg-muted p-1", size === "sm" && "rounded-full", className)}>
      {/* Mit Zusatzknopf: die Gruppe bekommt so viel Breite wie ihre Knöpfe, der Zusatzknopf eine Knopfbreite */}
      <div
        role="radiogroup"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex min-w-0 flex-1 basis-0"
        style={extra ? { flexGrow: options.length } : undefined}
      >
        {options.map((o, i) => {
          const selected = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected || (selectedIndex < 0 && i === 0) ? 0 : -1}
              onClick={() => onChange(o.value)}
              className={cn(
                "h-11 text-sm font-medium transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                size === "md" ? "min-w-0 flex-1 basis-0 truncate rounded-xl px-1" : "rounded-full px-3.5 whitespace-nowrap",
                selected ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                size === "sm" && selected && "bg-card text-foreground",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {extra}
    </div>
  );
}
