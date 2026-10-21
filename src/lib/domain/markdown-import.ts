import { CATEGORY_LABELS, GLASS_LABELS, METHOD_LABELS } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/database.types";

// Markdown-Import (Phase 13): zerlegt eine oder mehrere .md-Dateien in Rezepte, ein Rezept pro Überschrift.
// Gebaut für den Notion-Export des Nutzers (je Rezept eine Datei: „# Titel“, Eigenschaften wie „Art: Pasta“,
// graue Kästen „Vorbereitung: 10 min“ / „Anzahl Personen: 4“, „### Zutaten“ und „### Zubereitung“ als Listen,
// Untergruppen wie „Teig:“, Hinweise „**Optionale Zutat**“), liest aber auch den eigenen Markdown-Export
// (Buch mit „## Inhalt“ und je Rezept „##“) und schlicht geschriebene Dateien.

export type MarkdownImportRecipe = {
  /** Fortlaufende Nummer, stabil für Auswahl und React-Schlüssel */
  key: number;
  fileName: string;
  title: string;
  description: string;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  category: Enums<"recipe_category"> | null;
  tags: string[];
  /** Beilagen („**Passt dazu:** Spätzle, Kroketten“), gehören nicht zum Rezept */
  sideDishes: string[];
  isMealPrep: boolean;
  sourceUrl: string;
  /** Phase 15: Cocktail (eigener Export „*Cocktail*“, „Glas:“, „Methode:“, „Art: Cocktail“) */
  recipeType: Enums<"recipe_type">;
  cocktail: {
    glass: Enums<"glass"> | null;
    method: Enums<"cocktail_method"> | null;
    ice: string;
    garnish: string;
  };
  /** Zutatenzeilen im Original plus Zusatz aus Gruppe/„optional“, der in die Notiz wandert */
  ingredients: { text: string; extraNote: string }[];
  steps: { text: string; timer_seconds: number | null }[];
  /** Nährwerte laut Datei (z. B. Notion-Eigenschaften), nur zum Vergleichen angezeigt */
  reference: string | null;
  /** Was der Parser nicht sicher erkannt hat */
  warnings: string[];
};

export type MarkdownFile = { name: string; text: string };

export type MarkdownImportResult = {
  recipes: MarkdownImportRecipe[];
  /** Seiten ohne Zutaten, Schritte und Beschreibung (z. B. leere Vorlagen in Notion) */
  skippedEmpty: string[];
};

export const MAX_IMPORT_FILES = 500;
export const MAX_IMPORT_RECIPES = 300;
export const MAX_FILE_CHARS = 500_000;

// ---------- Text-Hilfen ----------

const norm = (s: string) =>
  s
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/ß/g, "ss")
    .replace(/\s+/g, " ")
    .trim();

/** Markdown/HTML-Formatierung entfernen: Fett, Kursiv, Links, Code, HTML-Tags, Escapes. */
export function plainText(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,:;!?]|$)/g, "$1$2")
    .replace(/\\([\\`*_[\]<>#|{}()+\-.!~])/g, "$1")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t ]+/g, " ")
    .trim();
}

/** Notion hängt an Datei- und Ordnernamen eine 32-stellige ID: „Pasta Alfredo 49d86cd9….md“. */
export function titleFromFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  return base
    .replace(/\.(md|markdown|txt)$/i, "")
    .replace(/\s+[0-9a-f]{32}$/i, "")
    .replace(/[_]+/g, " ")
    .trim();
}

/** „10 min“, „1 Std. 15 Min.“, „1,5 h“, „90 Minuten“, „30“ → Minuten. null, wenn nichts erkennbar. */
export function parseDuration(input: string): number | null {
  const text = norm(plainText(input)).replace(/(\d),(\d)/g, "$1.$2");
  if (!text) return null;
  let total = 0;
  let found = false;
  const hours = /(\d+(?:\.\d+)?)\s*(?:h|std\.?|stunden?|hours?|hrs?)\b/.exec(text);
  if (hours) {
    total += Number(hours[1]) * 60;
    found = true;
  }
  const mins = /(\d+(?:\.\d+)?)\s*(?:-\s*\d+\s*)?(?:m|min\.?|minuten?|minutes?|mins?)\b/.exec(text);
  if (mins) {
    total += Number(mins[1]);
    found = true;
  }
  if (!found) {
    const bare = /^(\d+(?:\.\d+)?)$/.exec(text);
    if (!bare) return null;
    total = Number(bare[1]);
  }
  const rounded = Math.round(total);
  return rounded > 0 && rounded <= 10000 ? rounded : null;
}

/** „4“, „4 Personen“, „3-4“ → Portionen; bei Spannen die kleinere Zahl und ein Hinweis. */
function parseServings(input: string): { value: number | null; range: boolean } {
  const m = /(\d+)(?:\s*(?:-|–|bis)\s*(\d+))?/.exec(plainText(input));
  if (!m) return { value: null, range: false };
  const value = Number(m[1]);
  return { value: value >= 1 && value <= 100 ? value : null, range: m[2] != null };
}

// ---------- Kategorien ----------

const CATEGORY_WORDS: Record<string, Enums<"recipe_category">> = {
  pasta: "pasta",
  nudeln: "pasta",
  nudelgericht: "pasta",
  reis: "rice",
  risotto: "rice",
  bowl: "bowl",
  bowls: "bowl",
  suppe: "soup",
  suppen: "soup",
  eintopf: "soup",
  "suppe/eintopf": "soup",
  salat: "salad",
  salate: "salad",
  auflauf: "casserole",
  auflaufe: "casserole",
  gratin: "casserole",
  fleisch: "meat",
  fleischgericht: "meat",
  fisch: "fish",
  fruhstuck: "breakfast",
  snack: "snack",
  snacks: "snack",
  dessert: "dessert",
  nachtisch: "dessert",
  getrank: "drink",
  getranke: "drink",
  drink: "drink",
  drinks: "drink",
  cocktail: "drink",
  cocktails: "drink",
};

const COCKTAIL_WORDS = new Set(["cocktail", "cocktails", "longdrink", "longdrinks"]);

// Phase 15: Glas und Methode aus dem eigenen Export („Coupette“, „geshaked“) und üblichen Schreibweisen
const GLASS_WORDS: Record<string, Enums<"glass">> = { coupe: "coupette", "martini-glas": "martini", longdrink: "highball", rocks: "tumbler" };
for (const [value, label] of Object.entries(GLASS_LABELS)) GLASS_WORDS[norm(label)] = value as Enums<"glass">;
const METHOD_WORDS: Record<string, Enums<"cocktail_method">> = {
  geschuttelt: "shaken",
  geshakt: "shaken",
  shaken: "shaken",
  shake: "shaken",
  stirred: "stirred",
  ruhren: "stirred",
  gebaut: "built",
  built: "built",
  build: "built",
  "im glas gebaut": "built",
  blended: "blended",
  gemixt: "blended",
  "im mixer": "blended",
};
for (const [value, label] of Object.entries(METHOD_LABELS)) METHOD_WORDS[norm(label)] = value as Enums<"cocktail_method">;

export function glassFor(value: string): Enums<"glass"> | null {
  return GLASS_WORDS[norm(plainText(value)).replace(/glas$/, "").trim()] ?? GLASS_WORDS[norm(plainText(value))] ?? null;
}

export function methodFor(value: string): Enums<"cocktail_method"> | null {
  return METHOD_WORDS[norm(plainText(value))] ?? null;
}
for (const [value, label] of Object.entries(CATEGORY_LABELS)) CATEGORY_WORDS[norm(label)] = value as Enums<"recipe_category">;

/** Werte, die keine eigene Kategorie und kein sinnvoller Tag sind (Notion „Kategorie: Mittag/Abend“). */
const IGNORED_VALUES = new Set(["mittag/abend", "mittag", "abend", "mittagessen", "abendessen"]);

export function categoryFor(value: string): Enums<"recipe_category"> | null {
  return CATEGORY_WORDS[norm(value)] ?? null;
}

/** Notion-Mehrfachauswahl „Frühstück, Mittag/Abend“ → einzelne Werte. */
function splitValues(value: string): string[] {
  return plainText(value)
    .split(/\s*[,;]\s*/)
    .map((v) => v.replace(/\s*\/\s*/g, "/").trim())
    .filter(Boolean);
}

// ---------- Eigenschaften ----------

type PropertyKind =
  | "servings"
  | "prep"
  | "cook"
  | "total"
  | "type"
  | "category"
  | "tags"
  | "kitchen"
  | "source"
  | "macro"
  | "glass"
  | "method"
  | "ice"
  | "garnish"
  | "sides"
  | "ignore";

const PROPERTY_KEYS: [RegExp, PropertyKind][] = [
  [/^(anzahl )?(personen|portionen|portion|drinks?)$|^servings?$|^fur$|^ergibt$/, "servings"],
  [/^glas$|^glass$/, "glass"],
  [/^methode$|^technik$|^method$/, "method"],
  [/^eis$|^ice$/, "ice"],
  [/^garnitur$|^garnish$|^deko$/, "garnish"],
  [/^vorbereitung(szeit)?$|^arbeitszeit$|^prep( time)?$/, "prep"],
  [/^(koch|back|gar)(zeit)?( ?\/ ?(koch|back)(zeit)?)?$|^koch- ?\/ ?backzeit$|^kochen$|^cook( time)?$/, "cook"],
  [/^(gesamt|zubereitungs)zeit$|^dauer$|^total( time)?$/, "total"],
  [/^art$|^typ$|^gericht$/, "type"],
  [/^kategorien?$|^category$|^mahlzeit$/, "category"],
  [/^tags?$|^schlagworte?$/, "tags"],
  [/^passt dazu$|^dazu passt$|^beilagen?$|^dazu$/, "sides"],
  [/^kuche$|^cuisine$/, "kitchen"],
  [/^quelle$|^source$|^url$|^link$|^original$/, "source"],
  [/(kcal|kalorien|eiweiss|protein|fett|kohlenhydrate|ballaststoffe|nahrwerte).*$|^pro portion$|^pro drink$/, "macro"],
  [/^(created|erstellt|zuletzt bearbeitet|last edited|exportiert am|bewertung|status)$/, "ignore"],
];

function propertyKind(key: string): PropertyKind | null {
  const k = norm(plainText(key)).replace(/:$/, "");
  for (const [pattern, kind] of PROPERTY_KEYS) if (pattern.test(k)) return kind;
  return null;
}

/** „Art: Pasta“, „**Tags:** a, b“, „> Vorbereitung: 10 min“ → [Schlüssel, Wert]. */
function splitProperty(line: string): [string, string] | null {
  const text = line.replace(/^>\s?/, "").trim();
  const m = /^\*{0,2}([^:*]{1,40}?)\*{0,2}\s*:\s*\*{0,2}\s*(.*)$/.exec(text);
  if (!m) return null;
  return [m[1].trim(), m[2].trim()];
}

// ---------- Zeilenarten ----------

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const LIST_ITEM = /^\s*(?:[-*+•]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.*)$/;
const EMPTY_LIST_ITEM = /^\s*(?:[-*+•]|\d+[.)])\s*(?:\[[ xX]\])?\s*$/;
const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const IMAGE_ONLY = /^\s*!\[[^\]]*\]\([^)]*\)\s*$/;
/** Nur ein Verweis auf eine Datei im Export (Notion: „[Rezepte](Rezepte%20….csv)“), kein Inhalt */
const LOCAL_LINK_ONLY = /^\s*\[[^\]]*\]\((?!https?:)[^)]*\)\s*$/i;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const TOC_TITLES = new Set(["inhalt", "inhaltsverzeichnis", "table of contents", "contents", "toc"]);

type SectionKind = "ingredients" | "steps" | "notes";

function sectionKind(heading: string): SectionKind | null {
  const h = norm(plainText(heading)).replace(/:$/, "");
  if (/^(zutaten|ingredients|einkaufsliste|das brauchst du|du brauchst)\b/.test(h)) return "ingredients";
  if (/^(zubereitung|anleitung|schritte|so geht'?s|instructions|directions|method|preparation|zubereitungsschritte)\b/.test(h)) return "steps";
  if (/^(notizen|tipps?|hinweise?|anmerkungen?|notes?|tips?|variationen?|beilagen?)\b/.test(h)) return "notes";
  return null;
}

/** „**Optionale Zutat**“, „Optional:“ → ab hier optional. */
function isOptionalMarker(line: string): boolean {
  return /^(optional(e|er|es|en)? (zutat(en)?|zubereitungsschritte?|schritte?)|optional)\s*:?$/i.test(plainText(line));
}

/**
 * Zeile wie „Teig:“, „Für die Füllung: Wrap“ oder „**Sauce**“ (kein Listenpunkt) als Gruppenüberschrift:
 * endet mit Doppelpunkt, ist ganz fett oder steht direkt über einer Liste. Sonst ist es eine Zutat ohne Punkt.
 */
function groupLabel(line: string, nextLine: string | undefined): string | null {
  const raw = line.replace(/^>\s?/, "").trim();
  const text = plainText(raw);
  if (!text || text.length > 60 || /^[\d½¼¾⅓⅔]/.test(text)) return null;
  const looksLikeLabel = text.includes(":") || /^(\*\*|__).+(\*\*|__)$/.test(raw) || (nextLine != null && LIST_ITEM.test(nextLine));
  return looksLikeLabel ? text.replace(/\s*:\s*$/, "").trim() || null : null;
}

const TIMER_SUFFIX = /\s*\*?\(Timer:\s*([^)]*)\)\*?\s*$/i;

// ---------- Rezepte finden ----------

type Heading = { index: number; level: number; text: string };

function findHeadings(lines: string[]): Heading[] {
  const headings: Heading[] = [];
  let fence = false;
  lines.forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    if (fence) return;
    const m = HEADING.exec(line);
    if (m) headings.push({ index, level: m[1].length, text: plainText(m[2]) });
  });
  return headings;
}

/**
 * Welche Überschriften-Ebene steht für ein Rezept? Die tiefste Ebene, deren Abschnitte selbst „Zutaten“ oder
 * „Zubereitung“ enthalten (Buch: „# Buch“ → „## Rezept“ → „### Zutaten“ ergibt 2). Gibt es solche Abschnitte
 * nicht, die oberste Ebene – außer dort steht nur ein einzelner Buchtitel über weiteren Überschriften.
 */
function recipeLevel(headings: Heading[]): number | null {
  const candidates = headings.filter((h) => !sectionKind(h.text) && !TOC_TITLES.has(norm(h.text)));
  if (candidates.length === 0) return null;
  const containsSection = (h: Heading) => {
    const i = headings.indexOf(h);
    for (const next of headings.slice(i + 1)) {
      if (next.level <= h.level) return false;
      if (sectionKind(next.text) === "ingredients" || sectionKind(next.text) === "steps") return true;
    }
    return false;
  };
  const withSections = candidates.filter(containsSection);
  if (withSections.length > 0) return Math.max(...withSections.map((h) => h.level));

  const minLevel = Math.min(...candidates.map((h) => h.level));
  const top = candidates.filter((h) => h.level === minLevel);
  const deeper = candidates.filter((h) => h.level > minLevel);
  if (top.length === 1 && deeper.length > 0 && candidates[0] === top[0]) return Math.min(...deeper.map((h) => h.level));
  return minLevel;
}

/** Zerlegt eine Datei in Blöcke „Titel + Zeilen“, je Rezept einer. */
function splitFile(file: MarkdownFile): { title: string; lines: string[] }[] {
  const lines = file.text.replace(/^﻿/, "").split(/\r?\n/);
  const headings = findHeadings(lines);
  const level = recipeLevel(headings);
  if (level == null) return [{ title: titleFromFileName(file.name), lines }];

  const starts = headings.filter((h) => h.level === level && !sectionKind(h.text) && !TOC_TITLES.has(norm(h.text)));
  return starts.map((start, i) => {
    // Ende: nächste Überschrift derselben oder höheren Ebene (z. B. nächstes Rezept oder neues Kapitel)
    const end = headings.find((h) => h.index > start.index && h.level <= level)?.index ?? lines.length;
    const until = i + 1 < starts.length ? Math.min(end, starts[i + 1].index) : end;
    return { title: start.text, lines: lines.slice(start.index + 1, until) };
  });
}

// ---------- Ein Rezept lesen ----------

const ING_SPLIT_MAX_WORDS = 3;

/** „Paprikapulver, Salz, Pfeffer, Olivenöl“ (ohne Menge) → einzelne Zutaten. */
export function splitIngredientList(text: string): string[] {
  if (/^\s*[\d½¼¾⅓⅔]/.test(text)) return [text];
  const parts = text.split(/\s*,\s*|\s+und\s+|\s+&\s+/).map((p) => p.trim()).filter(Boolean);
  // Nur Aufzählungen von Zutaten (deutsche Substantive, groß geschrieben), nicht „Zwiebel, gewürfelt“
  if (parts.length < 2 || parts.some((p) => p.split(/\s+/).length > ING_SPLIT_MAX_WORDS || !/^\p{Lu}/u.test(p))) return [text];
  return parts;
}

function parseRecipe(block: { title: string; lines: string[] }, fileName: string, key: number): MarkdownImportRecipe {
  const recipe: MarkdownImportRecipe = {
    key,
    fileName,
    title: block.title.slice(0, 200),
    description: "",
    servings: null,
    prepMinutes: null,
    cookMinutes: null,
    category: null,
    tags: [],
    sideDishes: [],
    isMealPrep: false,
    sourceUrl: "",
    recipeType: "dish",
    cocktail: { glass: null, method: null, ice: "", garnish: "" },
    ingredients: [],
    steps: [],
    reference: null,
    warnings: [],
  };
  const description: string[] = [];
  const references: string[] = [];
  const typeValues: string[] = [];
  const categoryValues: string[] = [];
  let totalMinutes: number | null = null;
  let servingsRange = false;

  let section: SectionKind | null = null;
  let group = "";
  let optional = false;
  let stepPrefix = "";
  let fence = false;

  const addTag = (value: string) => {
    const tag = value.slice(0, 30).trim();
    if (tag && !recipe.tags.some((t) => norm(t) === norm(tag)) && recipe.tags.length < 20) recipe.tags.push(tag);
  };

  function applyProperty(kind: PropertyKind, value: string, key: string) {
    const v = plainText(value);
    if (!v) return;
    switch (kind) {
      case "servings": {
        const s = parseServings(v);
        if (s.value != null && recipe.servings == null) {
          recipe.servings = s.value;
          servingsRange = s.range;
        }
        break;
      }
      case "prep":
        recipe.prepMinutes ??= parseDuration(v);
        break;
      case "cook":
        recipe.cookMinutes ??= parseDuration(v);
        break;
      case "total":
        totalMinutes ??= parseDuration(v);
        break;
      case "type":
        typeValues.push(...splitValues(v));
        break;
      case "category":
        categoryValues.push(...splitValues(v));
        break;
      case "tags":
        splitValues(v).forEach(addTag);
        break;
      case "kitchen":
        addTag(v);
        break;
      case "sides":
        for (const side of splitValues(v)) {
          const name = side.slice(0, 100).trim();
          if (name && !recipe.sideDishes.some((s) => norm(s) === norm(name)) && recipe.sideDishes.length < 20) {
            recipe.sideDishes.push(name);
          }
        }
        break;
      case "source": {
        const url = /https?:\/\/[^\s)>\]]+/.exec(value)?.[0];
        if (url && !recipe.sourceUrl) recipe.sourceUrl = url;
        break;
      }
      case "macro": {
        // „Eiweiß pro Person: 46,9 g“ → „Eiweiß 46,9 g“; kcal-Angaben tragen ihre Einheit selbst und kommen nach vorn
        const label = plainText(key).replace(/\s*pro (person|portion)\s*/i, " ").trim();
        if (/kcal|kalorien|^pro (portion|drink)$|^nährwerte$|^$/i.test(label)) references.unshift(v);
        else references.push(`${label} ${v}`);
        break;
      }
      case "glass":
        recipe.recipeType = "cocktail";
        recipe.cocktail.glass ??= glassFor(v) ?? "other";
        break;
      case "method":
        recipe.recipeType = "cocktail";
        recipe.cocktail.method ??= methodFor(v);
        break;
      case "ice":
        recipe.recipeType = "cocktail";
        recipe.cocktail.ice ||= v.slice(0, 100);
        break;
      case "garnish":
        recipe.recipeType = "cocktail";
        recipe.cocktail.garnish ||= v.slice(0, 200);
        break;
      case "ignore":
        break;
    }
  }

  /**
   * Meta-Zeile aus dem eigenen Export: „*Pasta* · 4 Portionen · Vorbereitung 10 Min. · Kochen 25 Min. · Meal-Prep“,
   * bei Cocktails „*Cocktail* · 1 Drink · geshaked · Glas Coupette · Zubereitung 5 Min.“
   */
  function applyMetaLine(line: string): boolean {
    if (!line.includes(" · ") && !/^\d+ (Portion(en)?|Drinks?)$/.test(plainText(line))) return false;
    const parts = line.split(" · ").map((p) => p.trim());
    let recognized = 0;
    for (const part of parts) {
      const text = plainText(part);
      const servings = /^(\d+) Portion(en)?$/.exec(text);
      const drinks = /^(\d+) Drinks?$/.exec(text);
      const prep = /^(?:Vorbereitung|Zubereitung) (.+)$/.exec(text);
      const cook = /^Kochen (.+)$/.exec(text);
      const glass = /^Glas (.+)$/.exec(text);
      if (servings) recipe.servings ??= Number(servings[1]);
      else if (drinks) {
        recipe.servings ??= Number(drinks[1]);
        recipe.recipeType = "cocktail";
      } else if (/^\*Cocktail\*$/.test(part)) {
        recipe.recipeType = "cocktail";
        recipe.category ??= "drink";
      } else if (glass && glassFor(glass[1])) {
        recipe.recipeType = "cocktail";
        recipe.cocktail.glass ??= glassFor(glass[1]);
      } else if (methodFor(text)) {
        recipe.recipeType = "cocktail";
        recipe.cocktail.method ??= methodFor(text);
      }
      else if (prep) recipe.prepMinutes ??= parseDuration(prep[1]);
      else if (cook) recipe.cookMinutes ??= parseDuration(cook[1]);
      else if (text === "Meal-Prep") recipe.isMealPrep = true;
      else if (/^\*[^*]+\*$/.test(part) && categoryFor(text)) recipe.category ??= categoryFor(text);
      else continue;
      recognized++;
    }
    return recognized > 0 && recognized === parts.length;
  }

  function addIngredient(text: string) {
    for (const part of splitIngredientList(text)) {
      const extra = [group, optional ? "optional" : ""].filter(Boolean).join(", ");
      if (recipe.ingredients.length < 100) recipe.ingredients.push({ text: part.slice(0, 300), extraNote: extra });
    }
  }

  function addStep(text: string) {
    let body = text;
    let timer: number | null = null;
    const t = TIMER_SUFFIX.exec(body);
    if (t) {
      const minutes = parseDuration(t[1]);
      if (minutes) timer = minutes * 60;
      body = body.slice(0, t.index);
    }
    body = plainText(body);
    if (!body) return;
    const prefix = [stepPrefix, optional ? "Optional" : ""].filter(Boolean).join(" · ");
    if (prefix) {
      body = `${prefix}: ${body}`;
      stepPrefix = "";
      // „Optionaler Zubereitungsschritt“ gilt nur für den nächsten Schritt
      optional = false;
    }
    if (recipe.steps.length < 60) recipe.steps.push({ text: body.slice(0, 2000), timer_seconds: timer });
  }

  for (let i = 0; i < block.lines.length; i++) {
    const raw = block.lines[i];
    if (/^\s*(```|~~~)/.test(raw)) {
      fence = !fence;
      continue;
    }
    const line = raw.trim();
    if (!line || RULE.test(line) || IMAGE_ONLY.test(line) || LOCAL_LINK_ONLY.test(line) || /^<\/?(aside|details|summary|div)[^>]*>$/i.test(line)) {
      continue;
    }
    if (fence) {
      if (section === "steps") addStep(line);
      else description.push(line);
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const kind = sectionKind(heading[2]);
      if (kind) {
        section = kind;
        group = "";
        optional = false;
        stepPrefix = "";
      } else if (section === "ingredients") {
        group = plainText(heading[2]).replace(/:$/, "");
        optional = false;
      } else if (section === "steps") {
        stepPrefix = plainText(heading[2]).replace(/:$/, "");
        optional = false;
      } else {
        // Unbekannte Zwischenüberschrift außerhalb der Abschnitte: als Notiz in die Beschreibung
        description.push(plainText(heading[2]));
      }
      continue;
    }

    // Quelle steht im eigenen Export am Ende, also schon im Abschnitt „Zubereitung“
    if (/^Quelle:\s*<?https?:\/\//i.test(plainText(line)) || /^Quelle:\s*<https?:/i.test(line)) {
      const url = /https?:\/\/[^\s)>\]]+/.exec(line)?.[0];
      if (url && !recipe.sourceUrl) recipe.sourceUrl = url;
      continue;
    }

    // Eigenschaften („Art: Pasta“, „> Anzahl Personen: 4“, „**Tags:** …“) vor den Abschnitten
    const property = section == null && !LIST_ITEM.test(line) ? splitProperty(line) : null;
    const kind = property ? propertyKind(property[0]) : null;
    if (property && kind) {
      applyProperty(kind, property[1], property[0]);
      continue;
    }
    if (section == null && applyMetaLine(line)) continue;

    if (/^\s*>\s?$/.test(line)) continue;

    if (isOptionalMarker(line)) {
      optional = true;
      continue;
    }

    const isList = LIST_ITEM.exec(raw);
    if (EMPTY_LIST_ITEM.test(raw)) continue;

    // Tabellenzeilen: Zellen mit Leerzeichen verbinden („| 500 g | Penne |“)
    if (line.startsWith("|")) {
      if (TABLE_SEPARATOR.test(line)) continue;
      const cells = line.split("|").map((c) => plainText(c)).filter(Boolean).join(" ");
      if (!cells) continue;
      if (section === "steps") addStep(cells);
      else if (section === "ingredients") addIngredient(cells);
      else description.push(cells);
      continue;
    }

    if (section === "ingredients") {
      if (isList) {
        const text = plainText(isList[1]);
        if (text) addIngredient(text);
        continue;
      }
      const label = groupLabel(line, block.lines.slice(i + 1).find((l) => l.trim()));
      if (label) {
        group = label;
        optional = false;
      } else addIngredient(plainText(line));
      continue;
    }

    if (section === "steps") {
      if (isList) {
        addStep(isList[1]);
        continue;
      }
      // Eingerückte Folgezeile gehört zum vorigen Schritt
      if (/^\s{2,}\S/.test(raw) && recipe.steps.length > 0) {
        const last = recipe.steps[recipe.steps.length - 1];
        const t = TIMER_SUFFIX.exec(line);
        if (t) last.timer_seconds = (parseDuration(t[1]) ?? 0) * 60 || last.timer_seconds;
        last.text = `${last.text}\n${plainText(t ? line.slice(0, t.index) : line)}`.slice(0, 2000);
        continue;
      }
      const text = plainText(line);
      if (text.endsWith(":") && text.length <= 60) {
        stepPrefix = text.slice(0, -1).trim();
        optional = false;
        continue;
      }
      addStep(line);
      continue;
    }

    // Außerhalb der Abschnitte: Beschreibung (bzw. Notizen)
    const text = plainText(isList ? isList[1] : line);
    if (!text) continue;
    if (/^Quelle:/i.test(text) || /^https?:\/\/\S+$/.test(text)) {
      const url = /https?:\/\/[^\s)>\]]+/.exec(line)?.[0];
      if (url && !recipe.sourceUrl) recipe.sourceUrl = url;
      continue;
    }
    description.push(isList ? `– ${text}` : text);
  }

  // Kategorie: erst „Art“, dann „Kategorie“; was nicht passt, wird Tag
  for (const value of [...typeValues, ...categoryValues]) {
    if (COCKTAIL_WORDS.has(norm(value))) recipe.recipeType = "cocktail";
    const category = categoryFor(value);
    if (category && !recipe.category) recipe.category = category;
    else if (!category && !IGNORED_VALUES.has(norm(value))) addTag(value);
  }
  if (recipe.prepMinutes == null && recipe.cookMinutes == null && totalMinutes != null) recipe.prepMinutes = totalMinutes;
  if (recipe.recipeType === "cocktail") recipe.category ??= "drink";

  recipe.description = description.join("\n").slice(0, 2000);
  recipe.reference = references.length > 0 ? references.join(" · ").slice(0, 300) : null;

  if (recipe.servings == null) recipe.warnings.push(recipe.recipeType === "cocktail" ? "Anzahl Drinks fehlt" : "Portionen fehlen");
  else if (servingsRange) recipe.warnings.push("Portionen als Spanne angegeben");
  if (recipe.ingredients.length === 0) recipe.warnings.push("Keine Zutaten erkannt");
  if (recipe.steps.length === 0) recipe.warnings.push("Keine Schritte erkannt");
  if (/^(page|seite|untitled|unbenannt|neue seite)\s*\d*(\s*\(\d+\))?$/i.test(recipe.title)) recipe.warnings.push("Kein richtiger Titel");
  return recipe;
}

function isEmpty(r: MarkdownImportRecipe): boolean {
  return r.ingredients.length === 0 && r.steps.length === 0 && !r.description.trim();
}

/** Alle Dateien lesen: Rezepte in Dateireihenfolge, leere Seiten getrennt. */
export function parseMarkdownFiles(files: MarkdownFile[]): MarkdownImportResult {
  const recipes: MarkdownImportRecipe[] = [];
  const skippedEmpty: string[] = [];
  let key = 0;
  for (const file of files.slice(0, MAX_IMPORT_FILES)) {
    for (const block of splitFile({ name: file.name, text: file.text.slice(0, MAX_FILE_CHARS) })) {
      const recipe = parseRecipe(block, file.name, key++);
      if (isEmpty(recipe)) skippedEmpty.push(recipe.title);
      else if (recipes.length < MAX_IMPORT_RECIPES) recipes.push(recipe);
    }
  }
  return { recipes, skippedEmpty };
}

/** Gibt es ein eigenes Rezept mit (fast) demselben Titel? */
export function titleKey(title: string): string {
  return norm(title).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** Vorauswahl: nur Rezepte mit Zutaten oder Schritten, die es im Buch noch nicht gibt. */
export function preselect(recipe: MarkdownImportRecipe, existingTitleKeys: Set<string>): boolean {
  if (existingTitleKeys.has(titleKey(recipe.title))) return false;
  if (recipe.warnings.includes("Kein richtiger Titel")) return false;
  return recipe.ingredients.length > 0 || recipe.steps.length > 0;
}
