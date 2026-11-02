"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowDownAZ, BookOpenText, LayoutList, Pencil, SearchX } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { ChipRow, CountChip, GroupHeading, ListCard, SearchField, SegmentToggle, TagLabel } from "@/components/layout/list-blocks";
import { chipClass } from "@/components/recipes/chip-select";
import { FabButton } from "@/components/recipes/new-recipe-fab";
import {
  categoryCounts,
  categoryTree,
  entryCategories,
  entryPreview,
  filterEntries,
  groupByCategory,
  groupByLetter,
  termIndex,
  type LexiconCategory,
  type LexiconEntry,
} from "@/lib/domain/lexicon";
import { normalizeSearch } from "@/lib/domain/exercises";
import { cn } from "@/lib/utils";
import { CategoryEditor } from "./category-editor";
import { EntryDetail } from "./entry-detail";
import { EntryEditor } from "./entry-editor";
import { CategoryDot, CategoryLabel, type LinkHandler } from "./lexicon-parts";

const VIEW_OPTIONS = [
  { value: "az", label: "A–Z", icon: ArrowDownAZ, showLabel: true },
  { value: "kategorien", label: "Nach Kategorien", icon: LayoutList },
] as const;

type Editor = { entry: LexiconEntry | null; term: string; key: number };

/**
 * Lexikon: Suche (Begriff, Fakten, Text, Stichworte), Kategorie-Chips mit Anzahl (Unterkategorien als zweite Reihe),
 * Liste A–Z oder nach Kategorien. Antippen öffnet den Eintrag. Schreibende (vorerst Admins) legen Einträge an,
 * bearbeiten Kategorien und sehen Entwürfe.
 */
export function LexiconView({ entries, categories, canWrite }: { entries: LexiconEntry[]; categories: LexiconCategory[]; canWrite: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [view, setView] = useState<"az" | "kategorien">("az");
  // geöffnete Einträge; der letzte ist sichtbar, die vorigen erreicht „Zurück“
  const [trail, setTrail] = useState<string[]>([]);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const tree = useMemo(() => categoryTree(categories), [categories]);
  const counts = useMemo(() => categoryCounts(entries, categories), [entries, categories]);
  const shown = useMemo(() => filterEntries(entries, categories, { query, categoryId }), [entries, categories, query, categoryId]);
  const index = useMemo(() => termIndex(entries), [entries]);
  const selected = categoryId ? categories.find((c) => c.id === categoryId) : null;
  // Zweite Reihe: Unterkategorien der gewählten Hauptkategorie (bzw. der Hauptkategorie der gewählten Unterkategorie)
  const parentNode = selected ? tree.find((n) => n.id === (selected.parentId ?? selected.id)) : null;
  const searching = normalizeSearch(query) !== "";
  const drafts = entries.filter((e) => !e.isPublic).length;
  const openEntry = trail.length ? entries.find((e) => e.id === trail[trail.length - 1]) : undefined;

  const openEditor = (entry: LexiconEntry | null, term = "") => {
    setTrail([]);
    setEditor({ entry, term, key: Date.now() });
  };

  const links: LinkHandler = {
    index,
    open: (id) => setTrail((t) => (t[t.length - 1] === id ? t : [...t, id])),
    create: canWrite ? (term) => openEditor(null, term) : undefined,
  };

  const row = (e: LexiconEntry) => {
    const preview = entryPreview(e);
    const labels = entryCategories(e, categories);
    return (
      <li key={e.id}>
        <button
          type="button"
          onClick={() => setTrail([e.id])}
          className="flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              {/* am Handy nur die Punkte der Kategorien */}
              <span className="flex shrink-0 gap-1 sm:hidden">
                {labels.map(({ category, parent }) => (
                  <CategoryDot key={category.id} color={(parent ?? category).color} />
                ))}
              </span>
              <span className="truncate font-medium">{e.term}</span>
              {!e.isPublic ? <TagLabel>Entwurf</TagLabel> : null}
            </span>
            <span className={cn("block truncate text-sm text-muted-foreground", !preview && "italic")}>{preview ?? "Noch kein Text"}</span>
          </span>
          {labels.length ? (
            <span className="hidden max-w-[45%] shrink-0 flex-wrap justify-end gap-1 sm:flex">
              {labels.map(({ category, parent }) => (
                <CategoryLabel key={category.id} category={category} parent={parent} />
              ))}
            </span>
          ) : null}
        </button>
      </li>
    );
  };

  return (
    // Unten Platz lassen, damit der schwebende Knopf die letzte Zeile nicht verdeckt
    <div className={cn("space-y-4", canWrite && "pb-16 md:pb-20")}>
      {entries.length === 0 ? (
        <EmptyState icon={BookOpenText} title={canWrite ? "Noch keine Einträge" : "Hier entsteht ein Nachschlagewerk"}>
          {canWrite
            ? "Mit dem Plus-Knopf unten rechts legst du den ersten an. Neue Einträge sind Entwürfe, bis du sie veröffentlichst."
            : "Bald stehen hier Erklärungen zu Ernährung, Supplements, Training, Regeneration und Blutwerten."}
        </EmptyState>
      ) : (
        <>
          <div className="space-y-3">
            <SearchField value={query} onChange={setQuery} placeholder="Begriff, Fakt oder Stichwort suchen …" label="Lexikon durchsuchen" />
            <ChipRow label="Kategorie">
              <CountChip active={categoryId === null} count={entries.length} onClick={() => setCategoryId(null)}>
                Alle
              </CountChip>
              {tree.map((c) => (
                <CountChip
                  key={c.id}
                  active={categoryId === c.id || selected?.parentId === c.id}
                  count={counts.get(c.id) ?? 0}
                  onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
                >
                  <CategoryDot color={c.color} />
                  {c.name}
                </CountChip>
              ))}
              {canWrite ? (
                <button type="button" onClick={() => setCategoriesOpen(true)} className={cn(chipClass(false), "border-dashed text-primary")}>
                  <Pencil aria-hidden />
                  Kategorien bearbeiten
                </button>
              ) : null}
            </ChipRow>
            {parentNode?.children.length ? (
              <ChipRow label={`Unterkategorie von ${parentNode.name}`}>
                {parentNode.children.map((s) => (
                  <CountChip key={s.id} active={categoryId === s.id} count={counts.get(s.id) ?? 0} onClick={() => setCategoryId(categoryId === s.id ? parentNode.id : s.id)}>
                    <span className="text-muted-foreground" aria-hidden>
                      ›
                    </span>
                    {s.name}
                  </CountChip>
                ))}
              </ChipRow>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {shown.length === entries.length ? `${entries.length} Einträge` : `${shown.length} von ${entries.length} Einträgen`}
              {canWrite && drafts ? ` · ${drafts} ${drafts === 1 ? "Entwurf" : "Entwürfe"}` : ""}
            </p>
            {!searching ? <SegmentToggle label="Ansicht" value={view} options={VIEW_OPTIONS} onChange={setView} /> : null}
          </div>

          {shown.length === 0 ? (
            <EmptyState icon={SearchX} title="Nichts gefunden">
              {canWrite ? "Kein Eintrag passt. Mit dem Plus-Knopf unten rechts legst du einen an." : "Kein Eintrag passt zu deiner Suche."}
            </EmptyState>
          ) : searching ? (
            // Beim Suchen nach Treffer-Güte, nicht nach Buchstaben
            <ListCard>{shown.map(row)}</ListCard>
          ) : view === "az" ? (
            <div className="space-y-4">
              {groupByLetter(shown).map(({ letter, items }) => (
                <section key={letter} aria-label={letter === "#" ? "Ziffern und Zeichen" : letter}>
                  <GroupHeading aside={items.length}>{letter}</GroupHeading>
                  <ListCard className="mt-1">{items.map(row)}</ListCard>
                </section>
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              {groupByCategory(shown, categories).map(({ category, items, sub }) => (
                <section key={category?.id ?? "ohne"} aria-label={category?.name ?? "Ohne Kategorie"}>
                  <GroupHeading aside={new Set([...items, ...sub.flatMap((s) => s.items)].map((e) => e.id)).size}>
                    <span className="flex items-center gap-2">
                      {category ? <CategoryDot color={category.color} /> : null}
                      {category?.name ?? "Ohne Kategorie"}
                    </span>
                  </GroupHeading>
                  {items.length ? <ListCard className="mt-1">{items.map(row)}</ListCard> : null}
                  {sub.map((s) => (
                    <div key={s.category.id} className="mt-2 pl-3">
                      <p className="flex min-h-9 items-center gap-1.5 px-1 text-sm font-medium text-muted-foreground">
                        <span aria-hidden>›</span>
                        {s.category.name}
                        <span className="ml-auto tabular-nums">{s.items.length}</span>
                      </p>
                      <ListCard>{s.items.map(row)}</ListCard>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          )}
        </>
      )}

      <p className="px-1 text-xs text-muted-foreground">Das Lexikon erklärt Zusammenhänge und ersetzt keine ärztliche Beratung.</p>

      {canWrite ? <FabButton label="Neuer Eintrag" onClick={() => openEditor(null)} /> : null}

      {openEntry ? (
        <EntryDetail
          key={trail[0]}
          entry={openEntry}
          entries={entries}
          categories={categories}
          canWrite={canWrite}
          links={links}
          canGoBack={trail.length > 1}
          onBack={() => setTrail((t) => t.slice(0, -1))}
          onEdit={() => openEditor(openEntry)}
          onClose={() => setTrail([])}
        />
      ) : null}

      {editor ? (
        <EntryEditor
          key={editor.key}
          entry={editor.entry}
          initialTerm={editor.term}
          categories={categories}
          onSaved={(id) => {
            router.refresh();
            // Nach dem Schließen des Editors den gespeicherten Eintrag zeigen
            setTimeout(() => setTrail([id]), 300);
          }}
          onClose={() => setEditor(null)}
        />
      ) : null}

      {categoriesOpen ? <CategoryEditor categories={categories} counts={counts} onClose={() => setCategoriesOpen(false)} /> : null}
    </div>
  );
}
