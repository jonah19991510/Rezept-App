"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * Eigene Tags (oder Beilagen) als Chips. Enter oder Komma fügt hinzu, Rücktaste im leeren Feld entfernt den letzten.
 */
export function TagInput({
  id,
  value,
  onChange,
  suggestions,
  placeholder = "Tag eingeben und Enter drücken",
  maxLength = 30,
  itemLabel = "Tag",
  leading,
}: {
  id: string;
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
  placeholder?: string;
  maxLength?: number;
  /** Für die Schaltflächen „<itemLabel> „…“ entfernen“ */
  itemLabel?: string;
  /** Chips vor den eigenen Tags, z. B. die automatisch berechneten (nicht entfernbar) */
  leading?: ReactNode;
}) {
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const tag = raw.trim().replace(/,+$/, "").trim().slice(0, maxLength);
    if (!tag) return;
    if (!value.some((t) => t.toLocaleLowerCase("de") === tag.toLocaleLowerCase("de"))) onChange([...value, tag]);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="grid grid-cols-1 gap-2">
      {value.length > 0 || leading ? (
        <ul className="flex flex-wrap gap-1.5">
          {leading}
          {value.map((tag) => (
            <li key={tag} className="inline-flex max-w-full items-center gap-1 rounded-full border bg-card py-1 pr-1 pl-3 text-sm">
              <span className="min-w-0 truncate">{tag}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((t) => t !== tag))}
                className="-my-2 grid size-11 shrink-0 place-items-center rounded-full hover:bg-muted"
                aria-label={`${itemLabel} „${tag}“ entfernen`}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => add(draft)}
        placeholder={placeholder}
        list={`${id}-suggestions`}
        maxLength={maxLength + 1}
      />
      <datalist id={`${id}-suggestions`}>
        {suggestions
          .filter((s) => !value.includes(s))
          .map((s) => (
            <option key={s} value={s} />
          ))}
      </datalist>
    </div>
  );
}
