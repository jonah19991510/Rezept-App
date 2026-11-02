"use client";

import { Fragment, type ReactNode } from "react";
import { drinkColor } from "@/lib/domain/drinks";
import { parseInline, parseRichText, termKey, type Inline, type LexiconCategory, type LexiconFact } from "@/lib/domain/lexicon";
import { cn } from "@/lib/utils";

// Bausteine des Lexikons: Kategorie-Punkt und -Label, Text mit [[Links]], Fakten, Tabellen.

/** Farbiger Punkt einer Kategorie. */
export function CategoryDot({ color, className }: { color: string; className?: string }) {
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", className)} style={{ background: drinkColor(color) }} aria-hidden />;
}

/** Kleines Label mit Punkt, z. B. in der Liste und im Eintrag. */
export function CategoryLabel({ category, parent }: { category: LexiconCategory; parent?: LexiconCategory | null }) {
  return (
    <span className="inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-md bg-muted px-1.5 py-0.5 font-sans text-xs font-semibold text-foreground/80">
      <CategoryDot color={category.color} />
      <span className="truncate">
        {parent ? <span className="text-muted-foreground">{parent.name} › </span> : null}
        {category.name}
      </span>
    </span>
  );
}

/** Wie [[Begriff]]-Links aufgelöst und geöffnet werden. */
export type LinkHandler = {
  /** Begriffsschlüssel → Eintrag */
  index: Map<string, string>;
  open: (entryId: string) => void;
  /** nur für Schreibende: fehlenden Eintrag gleich anlegen */
  create?: (term: string) => void;
};

function InlineView({ nodes, links }: { nodes: Inline[]; links: LinkHandler }) {
  return nodes.map((n, i) => {
    if (n.kind === "text") return <Fragment key={i}>{n.text}</Fragment>;
    if (n.kind === "bold")
      return (
        <strong key={i} className="font-semibold">
          <InlineView nodes={n.children} links={links} />
        </strong>
      );
    const id = links.index.get(termKey(n.term));
    if (id)
      return (
        <button
          key={i}
          type="button"
          onClick={() => links.open(id)}
          className="rounded-sm font-medium text-primary underline decoration-primary/40 underline-offset-2 transition hover:decoration-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {n.label}
        </button>
      );
    // Begriff ohne (sichtbaren) Eintrag: als Text, für Schreibende zum Anlegen
    if (links.create) {
      const create = links.create;
      return (
        <button
          key={i}
          type="button"
          onClick={() => create(n.term)}
          title={`„${n.term}“ gibt es noch nicht. Antippen zum Anlegen.`}
          className="rounded-sm text-muted-foreground underline decoration-dashed underline-offset-2 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {n.label}
        </button>
      );
    }
    return <Fragment key={i}>{n.label}</Fragment>;
  });
}

/** Eine Zeile mit **fett** und [[Links]] (Fakten, Tabellenzellen). */
export function InlineText({ text, links }: { text: string; links: LinkHandler }) {
  return <InlineView nodes={parseInline(text)} links={links} />;
}

/** Textfeld: Zwischenüberschriften, Absätze (Zeilenumbrüche bleiben), Aufzählungen. */
export function RichText({ text, links }: { text: string; links: LinkHandler }) {
  return (
    <div className="space-y-3 leading-relaxed">
      {parseRichText(text).map((b, i) => {
        if (b.kind === "heading")
          return (
            <h3 key={i} className="pt-2 font-sans text-lg font-semibold first:pt-0">
              <InlineView nodes={b.inline} links={links} />
            </h3>
          );
        if (b.kind === "list")
          return (
            <ul key={i} className="list-disc space-y-1 pl-5 marker:text-muted-foreground">
              {b.items.map((item, j) => (
                <li key={j}>
                  <InlineView nodes={item} links={links} />
                </li>
              ))}
            </ul>
          );
        return (
          <p key={i}>
            {b.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 ? <br /> : null}
                <InlineView nodes={line} links={links} />
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

/** Fakten als Tabelle mit Kopf „Fakten“: Bezeichnung links (am Handy oben), Wert rechts. */
export function FactsTable({ facts, links }: { facts: LexiconFact[]; links: LinkHandler }) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card" aria-label="Fakten">
      <h3 className="border-b bg-muted/50 px-4 py-2 font-sans text-xs font-semibold tracking-wide text-muted-foreground uppercase">Fakten</h3>
      <dl className="divide-y">
        {facts.map((f, i) => (
          <div key={i} className="grid gap-0.5 px-4 py-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4">
            <dt className="text-sm text-muted-foreground">
              <InlineText text={f.label} links={links} />
            </dt>
            <dd className="text-sm font-medium whitespace-pre-line">
              <InlineText text={f.value} links={links} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Tabelle: erste Zeile ist die Kopfzeile; breite Tabellen scrollen seitlich. */
export function TableView({ rows, links }: { rows: string[][]; links: LinkHandler }) {
  const [head, ...body] = rows;
  if (!head) return null;
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {head.map((c, i) => (
              <th key={i} scope="col" className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                <InlineText text={c} links={links} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {body.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 align-top">
                  <InlineText text={c} links={links} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Quelle: Links (http…) werden anklickbar, der Rest bleibt Text. */
export function SourceText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(/https?:\/\/[^\s<>"]+[^\s<>".,;:!?)]/g)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <a key={m.index} href={m[0]} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline underline-offset-2">
        {m[0]}
      </a>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <span className="whitespace-pre-line">{parts}</span>;
}
