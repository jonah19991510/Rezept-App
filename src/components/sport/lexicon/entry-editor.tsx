"use client";

import { useState, useTransition, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Plus, Table2, Type, X } from "lucide-react";
import { toast } from "sonner";
import { saveEntryAction } from "@/app/(app)/sport/lexikon/actions";
import { chipClass } from "@/components/recipes/chip-select";
import { EditorSheet, FieldHeading } from "@/components/recipes/editor/editor-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { categoryTree, LEXICON_LIMITS as L, type LexiconBlock, type LexiconCategory, type LexiconEntry } from "@/lib/domain/lexicon";
import { cn } from "@/lib/utils";
import { CategoryDot } from "./lexicon-parts";

type FactDraft = { key: number; label: string; value: string };
type BlockDraft = { key: number } & LexiconBlock;
type Form = {
  term: string;
  isPublic: boolean;
  categoryIds: string[];
  facts: FactDraft[];
  blocks: BlockDraft[];
  keywords: string;
  source: string;
};

// Schlüssel für Fakten und Felder in der Liste (React-Keys), über alle Editoren fortlaufend
let keySeq = 0;
const nextKey = () => ++keySeq;

const EMPTY_TABLE = () => [
  ["", ""],
  ["", ""],
];

function initialForm(entry: LexiconEntry | null, term: string, nextKey: () => number): Form {
  if (!entry) return { term, isPublic: false, categoryIds: [], facts: [], blocks: [{ key: nextKey(), type: "text", text: "" }], keywords: "", source: "" };
  return {
    term: entry.term,
    isPublic: entry.isPublic,
    categoryIds: entry.categoryIds,
    facts: entry.facts.map((f) => ({ key: nextKey(), ...f })),
    blocks: entry.blocks.map((b) => ({ key: nextKey(), ...b })),
    keywords: entry.keywords.join(", "),
    source: entry.source ?? "",
  };
}

function move<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

const iconButton =
  "grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-30";

/** Pfeile hoch/runter und Entfernen für Fakten, Textfelder und Tabellen. */
function ItemTools({ label, index, count, onMove, onRemove }: { label: string; index: number; count: number; onMove: (delta: number) => void; onRemove: () => void }) {
  return (
    <div className="flex shrink-0 items-center">
      <button type="button" className={iconButton} onClick={() => onMove(-1)} disabled={index === 0} aria-label={`${label} nach oben`}>
        <ChevronUp className="size-4" aria-hidden />
      </button>
      <button type="button" className={iconButton} onClick={() => onMove(1)} disabled={index === count - 1} aria-label={`${label} nach unten`}>
        <ChevronDown className="size-4" aria-hidden />
      </button>
      <button type="button" className={iconButton} onClick={onRemove} aria-label={`${label} entfernen`}>
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

function ItemCard({ children }: { children: ReactNode }) {
  return <div className="space-y-2 rounded-2xl border bg-muted/30 p-3">{children}</div>;
}

const hintClass = "mt-2 text-xs text-muted-foreground";

/**
 * Eintrag anlegen oder bearbeiten: Begriff, öffentlich/Entwurf, Kategorien (mit Unterkategorien), Fakten, Textfelder
 * und Tabellen in beliebiger Reihenfolge, Stichworte, Quelle. Schließen mit Änderungen fragt nach.
 */
export function EntryEditor({
  entry,
  initialTerm = "",
  categories,
  onSaved,
  onClose,
}: {
  entry: LexiconEntry | null;
  /** Begriff vorbelegen (Anlegen aus einem [[Link]] heraus) */
  initialTerm?: string;
  categories: LexiconCategory[];
  onSaved: (id: string) => void;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [initial] = useState(() => JSON.stringify(initialForm(entry, initialTerm, () => 0)));
  const [form, setForm] = useState<Form>(() => initialForm(entry, initialTerm, nextKey));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [pending, startTransition] = useTransition();
  const tree = categoryTree(categories);
  const patch = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));
  const err = (key: string) => errors[key]?.[0];
  // Schlüssel der Listen zählen nicht als Änderung
  const dirty = JSON.stringify({ ...form, facts: form.facts.map((f) => ({ ...f, key: 0 })), blocks: form.blocks.map((b) => ({ ...b, key: 0 })) }) !== initial;

  function close() {
    setOpen(false);
    setTimeout(onClose, 300);
  }

  function requestClose() {
    if (dirty && !pending) setConfirmDiscard(true);
    else close();
  }

  function toggleCategory(c: LexiconCategory) {
    const on = form.categoryIds.includes(c.id);
    if (on) {
      // Hauptkategorie abwählen nimmt ihre Unterkategorien mit
      const drop = new Set([c.id, ...categories.filter((s) => s.parentId === c.id).map((s) => s.id)]);
      patch({ categoryIds: form.categoryIds.filter((id) => !drop.has(id)) });
    } else {
      // Unterkategorie wählen wählt die Hauptkategorie mit
      patch({ categoryIds: [...new Set([...form.categoryIds, c.id, ...(c.parentId ? [c.parentId] : [])])] });
    }
  }

  function setFact(key: number, p: Partial<FactDraft>) {
    patch({ facts: form.facts.map((f) => (f.key === key ? { ...f, ...p } : f)) });
  }

  function setBlock(key: number, block: LexiconBlock) {
    patch({ blocks: form.blocks.map((b) => (b.key === key ? { key, ...block } : b)) });
  }

  function save() {
    startTransition(async () => {
      const result = await saveEntryAction(entry?.id ?? null, {
        term: form.term,
        isPublic: form.isPublic,
        categoryIds: form.categoryIds.filter((id) => categories.some((c) => c.id === id)),
        facts: form.facts.map(({ label, value }) => ({ label, value })),
        blocks: form.blocks.map((b): LexiconBlock => (b.type === "text" ? { type: "text", text: b.text } : { type: "table", rows: b.rows })),
        keywords: form.keywords,
        source: form.source,
      });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message ?? "Bitte die markierten Felder prüfen.");
        return;
      }
      toast.success(entry ? "Gespeichert" : `${form.term.trim()} angelegt${form.isPublic ? "" : " (Entwurf)"}`);
      onSaved(result.id);
      close();
    });
  }

  // Fehler zu Fakten kommen als „facts.2.label“; die Positionen beziehen sich auf die Fakten ohne leere Zeilen
  const factErrors = Object.entries(errors).filter(([k]) => k.startsWith("facts"));
  const nonEmptyFacts = form.facts.filter((f) => f.label.trim() || f.value.trim());

  return (
    <EditorSheet
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : requestClose())}
      title={entry ? "Eintrag bearbeiten" : "Neuer Eintrag"}
      description={form.isPublic ? "Öffentlich: alle aus der Runde sehen ihn." : "Entwurf: nur du siehst ihn, bis du ihn veröffentlichst."}
      footer={
        confirmDiscard ? (
          <>
            <Button type="button" variant="destructive" size="lg" onClick={close} className="flex-1">
              Verwerfen
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={() => setConfirmDiscard(false)} className="flex-1">
              Weiter bearbeiten
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="outline" size="lg" onClick={requestClose}>
              Abbrechen
            </Button>
            <Button type="button" size="lg" onClick={save} disabled={pending || form.term.trim() === ""} className="flex-1">
              {pending ? "Wird gespeichert …" : "Speichern"}
            </Button>
          </>
        )
      }
    >
      {confirmDiscard ? <p className="rounded-2xl bg-destructive/10 p-3 text-sm">Deine Änderungen sind noch nicht gespeichert.</p> : null}

      <div className="grid gap-1.5">
        <Label htmlFor="lex-term">Begriff</Label>
        <Input
          id="lex-term"
          value={form.term}
          maxLength={L.term}
          onChange={(e) => patch({ term: e.target.value })}
          className="h-12 text-base"
          aria-invalid={Boolean(err("term"))}
          placeholder="z. B. Kreatin"
        />
        {err("term") ? <p className="text-sm text-destructive">{err("term")}</p> : null}
      </div>

      <label className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border px-4 py-2">
        <span>
          <span className="block font-medium">Öffentlich</span>
          <span className="block text-sm text-muted-foreground">
            {form.isPublic ? "Alle aus der Runde sehen den Eintrag." : "Aus: Entwurf, nur du siehst ihn."}
          </span>
        </span>
        <Switch checked={form.isPublic} onCheckedChange={(isPublic) => patch({ isPublic })} />
      </label>

      <section>
        <FieldHeading aside="mehrere möglich">Kategorien</FieldHeading>
        {tree.length ? (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Kategorien">
            {tree.map((node) => {
              const on = form.categoryIds.includes(node.id);
              return (
                <div key={node.id} className="contents">
                  <button type="button" aria-pressed={on} onClick={() => toggleCategory(node)} className={chipClass(on)}>
                    <CategoryDot color={node.color} />
                    {node.name}
                  </button>
                  {on
                    ? node.children.map((s) => {
                        const subOn = form.categoryIds.includes(s.id);
                        return (
                          <button key={s.id} type="button" aria-pressed={subOn} onClick={() => toggleCategory(s)} className={chipClass(subOn)}>
                            <span className="text-muted-foreground" aria-hidden>
                              ›
                            </span>
                            {s.name}
                          </button>
                        );
                      })
                    : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Noch keine Kategorien.</p>
        )}
        <p className={hintClass}>Unterkategorien erscheinen, sobald du die Kategorie wählst. Anlegen unter „Kategorien bearbeiten“.</p>
      </section>

      <section>
        <FieldHeading>Fakten</FieldHeading>
        {form.facts.length ? (
          <div className="space-y-2">
            {form.facts.map((f, i) => {
              const errIndex = nonEmptyFacts.indexOf(f);
              const factErr = errIndex >= 0 ? factErrors.find(([k]) => k.startsWith(`facts.${errIndex}.`))?.[1][0] : undefined;
              return (
                <ItemCard key={f.key}>
                  <div className="flex items-center gap-1">
                    <Input
                      value={f.label}
                      maxLength={L.factLabel}
                      onChange={(e) => setFact(f.key, { label: e.target.value })}
                      className="h-11 min-w-0 flex-1 text-base font-semibold"
                      placeholder="Bezeichnung, z. B. Höchstmenge:"
                      aria-label={`Fakt ${i + 1}: Bezeichnung`}
                      aria-invalid={Boolean(factErr)}
                    />
                    <ItemTools
                      label={`Fakt ${i + 1}`}
                      index={i}
                      count={form.facts.length}
                      onMove={(d) => patch({ facts: move(form.facts, i, d) })}
                      onRemove={() => patch({ facts: form.facts.filter((x) => x.key !== f.key) })}
                    />
                  </div>
                  <Textarea
                    value={f.value}
                    maxLength={L.factValue}
                    onChange={(e) => setFact(f.key, { value: e.target.value })}
                    className="min-h-11 text-base"
                    placeholder="Wert"
                    aria-label={`Fakt ${i + 1}: Wert`}
                  />
                  {factErr ? <p className="text-sm text-destructive">{factErr}</p> : null}
                </ItemCard>
              );
            })}
          </div>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          className="mt-1 h-11 px-2 text-primary"
          onClick={() => patch({ facts: [...form.facts, { key: nextKey(), label: "", value: "" }] })}
          disabled={form.facts.length >= L.facts}
        >
          <Plus aria-hidden />
          Fakt hinzufügen
        </Button>
        <p className="text-xs text-muted-foreground">[[Begriff]] verlinkt einen anderen Eintrag, auch in Fakten und Tabellen.</p>
      </section>

      <section>
        <FieldHeading>Erklärung, Notizen und Tabellen</FieldHeading>
        <div className="space-y-2">
          {form.blocks.map((b, i) => (
            <ItemCard key={b.key}>
              <div className="flex items-center gap-2">
                <span className="flex flex-1 items-center gap-1.5 pl-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {b.type === "text" ? <Type className="size-3.5" aria-hidden /> : <Table2 className="size-3.5" aria-hidden />}
                  {b.type === "text" ? "Text" : "Tabelle"}
                </span>
                <ItemTools
                  label={`${b.type === "text" ? "Textfeld" : "Tabelle"} ${i + 1}`}
                  index={i}
                  count={form.blocks.length}
                  onMove={(d) => patch({ blocks: move(form.blocks, i, d) })}
                  onRemove={() => patch({ blocks: form.blocks.filter((x) => x.key !== b.key) })}
                />
              </div>
              {b.type === "text" ? (
                <Textarea
                  value={b.text}
                  maxLength={L.text}
                  onChange={(e) => setBlock(b.key, { type: "text", text: e.target.value })}
                  className="min-h-40 text-base leading-relaxed"
                  placeholder={"## Zwischenüberschrift\nText …\n- Aufzählung"}
                  aria-label={`Textfeld ${i + 1}`}
                />
              ) : (
                <TableEditor rows={b.rows} onChange={(rows) => setBlock(b.key, { type: "table", rows })} label={`Tabelle ${i + 1}`} />
              )}
            </ItemCard>
          ))}
        </div>
        {err("blocks") ? <p className="mt-1 text-sm text-destructive">{err("blocks")}</p> : null}
        <div className="mt-2 flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => patch({ blocks: [...form.blocks, { key: nextKey(), type: "text", text: "" }] })}
            disabled={form.blocks.length >= L.blocks}
          >
            <Plus aria-hidden />
            Textfeld
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => patch({ blocks: [...form.blocks, { key: nextKey(), type: "table", rows: EMPTY_TABLE() }] })}
            disabled={form.blocks.length >= L.blocks}
          >
            <Plus aria-hidden />
            Tabelle
          </Button>
        </div>
        <p className={hintClass}>
          Mit den Pfeilen verschiebst du Felder. Im Text: Leerzeile = neuer Absatz · „- “ = Aufzählung · „## “ = Zwischenüberschrift · **fett** ·
          [[Begriff]] oder [[Begriff|Text]] = Link. In Tabellen ist die erste Zeile die Kopfzeile.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid content-start gap-1.5">
          <Label htmlFor="lex-keywords">Stichworte</Label>
          <Input
            id="lex-keywords"
            value={form.keywords}
            maxLength={2000}
            onChange={(e) => patch({ keywords: e.target.value })}
            className="h-12 text-base"
            placeholder="Hypertrophie, Kraft"
            aria-invalid={Boolean(err("keywords"))}
          />
          <p className="text-xs text-muted-foreground">{err("keywords") ?? "Mit Komma trennen; helfen bei der Suche."}</p>
        </div>
        <div className="grid content-start gap-1.5">
          <Label htmlFor="lex-source">Quelle</Label>
          <Textarea
            id="lex-source"
            value={form.source}
            maxLength={L.source}
            onChange={(e) => patch({ source: e.target.value })}
            className="min-h-12 text-base"
            placeholder="Studie, Buch, Link, Trainer …"
          />
        </div>
      </div>
    </EditorSheet>
  );
}

/** Tabelle bearbeiten: Zellen als Felder, erste Zeile fett (Kopfzeile); Zeilen und Spalten hinzufügen/entfernen. */
function TableEditor({ rows, onChange, label }: { rows: string[][]; onChange: (rows: string[][]) => void; label: string }) {
  const width = Math.max(1, ...rows.map((r) => r.length));
  const grid = rows.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ""));
  const setCell = (ri: number, ci: number, value: string) => onChange(grid.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? value : c)) : r)));

  return (
    <div className="space-y-2">
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <table className="border-separate border-spacing-1" aria-label={label}>
          <thead>
            <tr>
              {grid[0]?.map((_, ci) => (
                <th key={ci} className="p-0 text-right">
                  <button
                    type="button"
                    className={cn(iconButton, "ml-auto size-7")}
                    onClick={() => onChange(grid.map((r) => r.filter((_, j) => j !== ci)))}
                    disabled={width <= 1}
                    aria-label={`Spalte ${ci + 1} entfernen`}
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </th>
              ))}
              <th className="p-0" />
            </tr>
          </thead>
          <tbody>
            {grid.map((r, ri) => (
              <tr key={ri}>
                {r.map((c, ci) => (
                  <td key={ci} className="p-0">
                    <Input
                      value={c}
                      maxLength={L.cell}
                      onChange={(e) => setCell(ri, ci, e.target.value)}
                      className={cn("h-10 w-36 text-base md:text-sm", ri === 0 && "font-semibold")}
                      placeholder={ri === 0 ? "Kopf" : ""}
                      aria-label={`${label}, Zeile ${ri + 1}, Spalte ${ci + 1}`}
                    />
                  </td>
                ))}
                <td className="p-0">
                  <button
                    type="button"
                    className={cn(iconButton, "size-7")}
                    onClick={() => onChange(grid.filter((_, i) => i !== ri))}
                    disabled={grid.length <= 1}
                    aria-label={`Zeile ${ri + 1} entfernen`}
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...grid, Array(width).fill("")])} disabled={grid.length >= L.tableRows}>
          <Plus aria-hidden />
          Zeile
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(grid.map((r) => [...r, ""]))} disabled={width >= L.tableCols}>
          <Plus aria-hidden />
          Spalte
        </Button>
      </div>
    </div>
  );
}
