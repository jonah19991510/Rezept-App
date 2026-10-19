import type { Enums } from "@/lib/supabase/database.types";
import { convertFahrenheitInText } from "./us-units";

// Import per Link (Phase 7): liest schema.org/Recipe aus den JSON-LD-Blöcken einer Webseite.
// Reine Textverarbeitung, kein Netzwerk (das Laden der Seite macht src/lib/server/fetch-page.ts).

export type ImportedRecipe = {
  title: string;
  description: string;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  category: Enums<"recipe_category"> | null;
  ingredientLines: string[];
  steps: string[];
};

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä",
  Ouml: "Ö", Uuml: "Ü", szlig: "ß", eacute: "é", egrave: "è", agrave: "à", ccedil: "ç", deg: "°", frac12: "½",
  frac14: "¼", frac34: "¾", ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  bdquo: "„", times: "×", reg: "®", copy: "©", trade: "™",
};

/** HTML-Entities auflösen (auch doppelt kodierte wie &amp;amp;). */
export function decodeEntities(text: string): string {
  let out = text;
  for (let i = 0; i < 2 && /&[#a-z0-9]+;/i.test(out); i++) {
    out = out.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, code: string) => {
      if (code[0] === "#") {
        const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
      }
      return NAMED_ENTITIES[code] ?? m;
    });
  }
  return out;
}

/** HTML-Tags entfernen (Absätze/Listen werden Zeilenumbrüche), Entities auflösen, Leerraum glätten. */
export function cleanText(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|div|h\d)>/gi, "\n")
      .replace(/<[^>]*>/g, ""),
  )
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** Inhalte aller <script type="application/ld+json">-Blöcke, als JSON gelesen (kaputte werden übersprungen). */
export function extractJsonLd(html: string): Json[] {
  const blocks: Json[] = [];
  const re = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    const body = m[1].trim().replace(/^<!\[CDATA\[|\]\]>$/g, "");
    try {
      blocks.push(JSON.parse(body) as Json);
    } catch {
      try {
        // Manche Seiten haben Zeilenumbrüche in Strings
        blocks.push(JSON.parse(body.replace(/[\u0000-\u001f]+/g, " ")) as Json);
      } catch {
        // ignorieren
      }
    }
  }
  return blocks;
}

function isObject(v: Json | undefined): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function hasType(obj: JsonObject, type: string): boolean {
  const t = obj["@type"];
  const types = Array.isArray(t) ? t : [t];
  return types.some((x) => typeof x === "string" && (x === type || x.endsWith(`/${type}`)));
}

/** Sucht das erste Objekt vom Typ Recipe (auch in @graph, Listen und mainEntity). */
export function findRecipeNode(data: Json, depth = 0): JsonObject | null {
  if (depth > 8 || data == null) return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeNode(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (!isObject(data)) return null;
  if (hasType(data, "Recipe")) return data;
  for (const value of Object.values(data)) {
    if (typeof value === "object" && value !== null) {
      const found = findRecipeNode(value, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

/** ISO-8601-Dauer („PT1H30M“, „P0DT0H20M“, „PT90M“) in Minuten. */
export function parseIsoDuration(value: Json | undefined): number | null {
  if (typeof value !== "string") return null;
  const m = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(value.trim());
  if (!m || value.trim().toUpperCase() === "P" || value.trim().toUpperCase() === "PT") return null;
  const [, d, h, min, s] = m.map((x) => (x ? Number(x) : 0));
  const total = Math.round(d * 1440 + h * 60 + min + s / 60);
  return total > 0 && total <= 10000 ? total : null;
}

/** Portionen aus recipeYield („4“, „4 Portionen“, [„4“, „4 servings“], 4). */
export function parseYield(value: Json | undefined): number | null {
  const candidates = Array.isArray(value) ? value : [value];
  for (const c of candidates) {
    const n = typeof c === "number" ? c : typeof c === "string" ? Number(/\d+/.exec(c)?.[0]) : Number.NaN;
    if (Number.isFinite(n) && n >= 1) return Math.min(Math.round(n), 100);
  }
  return null;
}

function text(value: Json | undefined): string {
  if (typeof value === "string") return cleanText(value);
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(", ");
  return "";
}

/** Zubereitung: Text, Liste von Texten, HowToStep, HowToSection (mit Abschnittsnamen vor dem ersten Schritt). */
export function parseInstructions(value: Json | undefined): string[] {
  const out: string[] = [];
  // Abschnittsnamen („Teig“, „Füllung“) nur, wenn es mehrere Abschnitte gibt; ein einzelnes „Zubereitung“ stört
  const sections = Array.isArray(value)
    ? value.filter((v) => isObject(v) && (hasType(v, "HowToSection") || Array.isArray(v.itemListElement))).length
    : 0;
  const walk = (v: Json | undefined, prefix: string | null) => {
    if (v == null) return;
    if (typeof v === "string") {
      const lines = cleanText(v).split("\n").filter(Boolean);
      lines.forEach((line, i) => out.push(i === 0 && prefix ? `${prefix}: ${line}` : line));
      return;
    }
    if (Array.isArray(v)) {
      v.forEach((item, i) => walk(item, i === 0 ? prefix : null));
      return;
    }
    if (!isObject(v)) return;
    if (hasType(v, "HowToSection") || Array.isArray(v.itemListElement)) {
      const name = sections > 1 ? text(v.name) : "";
      walk(v.itemListElement, name || prefix);
      return;
    }
    walk(typeof v.text === "string" ? v.text : typeof v.name === "string" ? v.name : null, prefix);
  };
  walk(value, null);
  return out.map((s) => s.slice(0, 2000)).slice(0, 60);
}

const CATEGORY_HINTS: [Enums<"recipe_category">, RegExp][] = [
  ["breakfast", /frühstück|breakfast|porridge|müsli|overnight oats|pancake|pfannkuchen/i],
  ["dessert", /dessert|nachtisch|nachspeise|kuchen|torte|cake|cookie|kekse|\beis\b|eiscreme|mousse|pudding/i],
  ["drink", /getränk|drink|cocktail|smoothie|limonade/i],
  ["soup", /suppe|eintopf|soup|stew|chili con carne/i],
  ["salad", /salat|salad/i],
  ["casserole", /auflauf|gratin|casserole|lasagne|lasagna/i],
  ["pasta", /pasta|nudel|spaghetti|penne|tagliatelle|fusilli|gnocchi|maccheroni|linguine/i],
  ["rice", /reis|risotto|rice|paella|pilaw/i],
  ["bowl", /bowl/i],
  ["fish", /fisch|fish|lachs|salmon|thunfisch|garnele|shrimp/i],
  ["meat", /fleisch|meat|rind|schwein|hähnchen|huhn|chicken|beef|pork|steak|gulasch/i],
  ["snack", /snack|fingerfood|dip\b/i],
];

/** Kategorie aus recipeCategory, Titel und Stichworten erraten (der Nutzer kann sie in der Bestätigung ändern). */
export function guessCategory(...texts: string[]): Enums<"recipe_category"> | null {
  for (const source of texts) {
    if (!source) continue;
    for (const [category, re] of CATEGORY_HINTS) if (re.test(source)) return category;
  }
  return null;
}

/** schema.org/Recipe → Felder für die Bestätigungsansicht. */
export function toImportedRecipe(node: JsonObject, sourceUrl?: string): ImportedRecipe {
  const prep = parseIsoDuration(node.prepTime);
  let cook = parseIsoDuration(node.cookTime);
  const total = parseIsoDuration(node.totalTime);
  if (cook == null && total != null) cook = prep != null ? Math.max(total - prep, 0) || null : total;

  const rawIngredients = node.recipeIngredient ?? node.ingredients;
  const ingredientLines = (Array.isArray(rawIngredients) ? rawIngredients : [rawIngredients])
    .map((l) => text(l).replace(/\n/g, " "))
    .filter(Boolean)
    .slice(0, 100);

  // Manche Seiten (z. B. Chefkoch) hängen „von <Benutzername>“ an den Titel
  const authors = (Array.isArray(node.author) ? node.author : [node.author])
    .map((a) => (isObject(a) ? text(a.name) : text(a)))
    .filter(Boolean);
  let title = text(node.name).replace(/\n/g, " ");
  for (const author of authors) {
    const suffix = ` von ${author}`;
    if (title.toLowerCase().endsWith(suffix.toLowerCase())) title = title.slice(0, -suffix.length).trim();
  }
  // Chefkoch nennt den Autor nur per Verweis, der Titel endet aber immer auf „von <Benutzername>“
  if (sourceUrl && /(^|\.)chefkoch\.de$/i.test(hostOf(sourceUrl))) title = title.replace(/\s+von\s+\S+$/, "");
  title = title.slice(0, 200);
  return {
    title,
    description: convertFahrenheitInText(text(node.description)).slice(0, 2000),
    servings: parseYield(node.recipeYield),
    prepMinutes: prep,
    cookMinutes: cook,
    category: guessCategory(text(node.recipeCategory), title, text(node.keywords)),
    ingredientLines,
    // Backofentemperaturen in °F gleich in °C umrechnen
    steps: parseInstructions(node.recipeInstructions).map(convertFahrenheitInText),
  };
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/** Das erste Rezept einer Seite oder null, wenn die Seite keins im Standardformat enthält. */
export function extractRecipe(html: string, sourceUrl?: string): ImportedRecipe | null {
  for (const block of extractJsonLd(html)) {
    const node = findRecipeNode(block);
    if (node) {
      const recipe = toImportedRecipe(node, sourceUrl);
      // Übersichtsseiten markieren manchmal Listen als Recipe, ohne Zutaten: kein Rezept
      if (recipe.ingredientLines.length > 0) return recipe;
    }
  }
  return null;
}
