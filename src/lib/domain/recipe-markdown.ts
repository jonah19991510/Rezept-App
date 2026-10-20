import { formatDate, formatNumber } from "@/lib/format";
import { formatMinutes, formatQuantity } from "@/lib/format-quantity";
import { CATEGORY_LABELS, GLASS_LABELS, METHOD_LABELS } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/database.types";

// Markdown-Export (Phase 13): ein einzelnes Rezept oder das ganze Buch als .md-Datei.
// Aufbau je Rezept: Überschrift (##), Zeile mit Kategorie/Portionen/Zeit, Beschreibung, Tags, Nährwerte,
// „### Zutaten“ als Liste („400 g Spaghetti, Notiz“ wie auf der Rezeptseite), „### Zubereitung“ nummeriert.
// Das Buch bekommt oben ein Inhaltsverzeichnis mit Sprungmarken (nach Kategorie gruppiert).
// Phase 15: Cocktails mit „*Cocktail* · 1 Drink · geshaked · Glas Coupette“, Eis, Garnitur und Alkoholgehalt pro Drink;
// im Buch als eigene Gruppe „Cocktails“ am Ende. Der Markdown-Import liest das wieder ein.

export type MarkdownRecipe = {
  title: string;
  description: string | null;
  servings: number;
  prep_minutes: number | null;
  cook_minutes: number | null;
  category: Enums<"recipe_category"> | null;
  tags: string[];
  is_meal_prep: boolean;
  source_url: string | null;
  /** Makros pro Portion, falls alle Zutaten Grammangaben haben */
  perServing: { kcal: number; protein: number; carbs: number; fat: number; fiber: number } | null;
  ingredients: { amount: number | null; unit: Enums<"unit"> | null; name: string; note: string | null }[];
  steps: { text: string; timer_seconds: number | null }[];
  /** Phase 15: ohne Angabe Gericht */
  recipe_type?: Enums<"recipe_type">;
  cocktail?: { glass: Enums<"glass"> | null; method: Enums<"cocktail_method"> | null; ice: string | null; garnish: string | null } | null;
  /** Alkoholgehalt pro Drink (View recipe_alcohol) */
  alcohol?: { abvPercent: number; alcoholGrams: number } | null;
};

const COCKTAIL_GROUP = "Cocktails";
const isCocktail = (r: MarkdownRecipe) => r.recipe_type === "cocktail";

const NO_CATEGORY = "Ohne Kategorie";
const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS) as Enums<"recipe_category">[];

/** Zeichen, die Markdown sonst als Formatierung liest. */
export function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_[\]<>#|])/g, "\\$1");
}

/** Text in einer Zeile: Zeilenumbrüche werden zu Leerzeichen. */
function inline(text: string): string {
  return escapeMarkdown(text.replace(/\s*\n\s*/g, " ").trim());
}

/**
 * Sprungmarken wie GitHub/VS Code: klein, Satzzeichen weg, Leerzeichen → „-“, Umlaute bleiben.
 * Gleiche Überschriften bekommen -1, -2 … (in der Reihenfolge im Dokument).
 */
export function createSlugger() {
  // Wie github-slugger: bei Doppelten weiterzählen, bis die Marke frei ist
  const occurrences = new Map<string, number>();
  return (heading: string): string => {
    const base = heading
      .toLocaleLowerCase("de-DE")
      .trim()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .replace(/\s/g, "-");
    let slug = base;
    while (occurrences.has(slug)) {
      const n = (occurrences.get(base) ?? 0) + 1;
      occurrences.set(base, n);
      slug = `${base}-${n}`;
    }
    occurrences.set(slug, 0);
    return slug;
  };
}

function metaLine(r: MarkdownRecipe): string {
  const parts: string[] = [];
  if (isCocktail(r)) {
    parts.push("*Cocktail*", `${r.servings} ${r.servings === 1 ? "Drink" : "Drinks"}`);
    if (r.cocktail?.method) parts.push(METHOD_LABELS[r.cocktail.method]);
    if (r.cocktail?.glass) parts.push(`Glas ${GLASS_LABELS[r.cocktail.glass]}`);
    const prep = formatMinutes(r.prep_minutes);
    if (prep) parts.push(`Zubereitung ${prep}`);
    return parts.join(" · ");
  }
  if (r.category) parts.push(`*${CATEGORY_LABELS[r.category]}*`);
  parts.push(`${r.servings} ${r.servings === 1 ? "Portion" : "Portionen"}`);
  const prep = formatMinutes(r.prep_minutes);
  const cook = formatMinutes(r.cook_minutes);
  if (prep) parts.push(`Vorbereitung ${prep}`);
  if (cook) parts.push(`Kochen ${cook}`);
  if (r.is_meal_prep) parts.push("Meal-Prep");
  return parts.join(" · ");
}

/** „**Pro Drink:** 17,5 % vol · 18,9 g Alkohol · 152 kcal“ */
function drinkLine(r: MarkdownRecipe): string | null {
  const parts: string[] = [];
  if (r.alcohol) parts.push(`${formatNumber(r.alcohol.abvPercent, 1)} % vol`, `${formatNumber(r.alcohol.alcoholGrams, 1)} g Alkohol`);
  if (r.perServing) parts.push(`${formatNumber(Math.round(r.perServing.kcal), 0)} kcal`);
  return parts.length ? `**Pro Drink:** ${parts.join(" · ")}` : null;
}

function macroLine(m: NonNullable<MarkdownRecipe["perServing"]>): string {
  const g = (v: number) => `${formatNumber(v, 0)} g`;
  return `**Pro Portion:** ${formatNumber(Math.round(m.kcal), 0)} kcal · ${g(m.protein)} Eiweiß · ${g(m.carbs)} Kohlenhydrate · ${g(m.fat)} Fett · ${g(m.fiber)} Ballaststoffe`;
}

function ingredientLine(l: MarkdownRecipe["ingredients"][number]): string {
  const quantity = formatQuantity(l.amount, l.unit);
  const note = l.note?.trim() ? `, ${inline(l.note)}` : "";
  return `- ${quantity ? `${quantity} ` : ""}${inline(l.name)}${note}`;
}

function stepLine(step: MarkdownRecipe["steps"][number], index: number): string {
  const prefix = `${index + 1}. `;
  const timer = step.timer_seconds ? ` *(Timer: ${formatMinutes(Math.max(1, Math.round(step.timer_seconds / 60)))})*` : "";
  // Mehrzeilige Schritte: Folgezeilen einrücken, damit sie zum Listenpunkt gehören
  const lines = escapeMarkdown(step.text.trim()).split(/\r?\n/);
  return prefix + lines.map((line, i) => (i === 0 ? line : `${" ".repeat(prefix.length)}${line}`)).join("\n") + timer;
}

/** Ein Rezept als Markdown-Abschnitt. `level` ist die Ebene der Rezeptüberschrift (1 = #). */
function recipeSection(r: MarkdownRecipe, level: number): string {
  const h = (n: number) => "#".repeat(n);
  const blocks: string[] = [`${h(level)} ${inline(r.title)}`, metaLine(r)];
  if (r.description?.trim()) blocks.push(escapeMarkdown(r.description.trim()));
  if (r.tags.length > 0) blocks.push(`**Tags:** ${r.tags.map(inline).join(", ")}`);
  if (isCocktail(r)) {
    if (r.cocktail?.ice?.trim()) blocks.push(`**Eis:** ${inline(r.cocktail.ice)}`);
    if (r.cocktail?.garnish?.trim()) blocks.push(`**Garnitur:** ${inline(r.cocktail.garnish)}`);
    const drink = drinkLine(r);
    if (drink) blocks.push(drink);
  } else if (r.perServing) blocks.push(macroLine(r.perServing));

  blocks.push(`${h(level + 1)} Zutaten`);
  blocks.push(r.ingredients.length > 0 ? r.ingredients.map(ingredientLine).join("\n") : "*Keine Zutaten eingetragen.*");

  blocks.push(`${h(level + 1)} Zubereitung`);
  blocks.push(r.steps.length > 0 ? r.steps.map(stepLine).join("\n") : "*Keine Schritte eingetragen.*");

  if (r.source_url) blocks.push(`Quelle: <${r.source_url}>`);
  return blocks.join("\n\n");
}

/** Einzelnes Rezept als eigenständige Datei (Titel als #). */
export function recipeToMarkdown(recipe: MarkdownRecipe): string {
  return `${recipeSection(recipe, 1)}\n`;
}

const collator = new Intl.Collator("de-DE", { sensitivity: "base", numeric: true });

/** Rezepte nach Kategorie (Reihenfolge wie im Filter, ohne Kategorie danach, Cocktails zuletzt), darin alphabetisch. */
export function groupByCategory(recipes: MarkdownRecipe[]): { label: string; recipes: MarkdownRecipe[] }[] {
  const rank = (r: MarkdownRecipe) =>
    isCocktail(r) ? CATEGORY_ORDER.length + 1 : r.category ? CATEGORY_ORDER.indexOf(r.category) : CATEGORY_ORDER.length;
  const sorted = [...recipes].sort((a, b) => rank(a) - rank(b) || collator.compare(a.title, b.title));
  const groups: { label: string; recipes: MarkdownRecipe[] }[] = [];
  for (const r of sorted) {
    const label = isCocktail(r) ? COCKTAIL_GROUP : r.category ? CATEGORY_LABELS[r.category] : NO_CATEGORY;
    const last = groups.at(-1);
    if (last?.label === label) last.recipes.push(r);
    else groups.push({ label, recipes: [r] });
  }
  return groups;
}

/** Das ganze Buch: Titel, Inhaltsverzeichnis mit Sprungmarken, dann alle Rezepte (je ##). */
export function bookToMarkdown(recipes: MarkdownRecipe[], options: { title: string; exportedAt: Date }): string {
  const slug = createSlugger();
  // Sprungmarken in Dokument-Reihenfolge vergeben: erst Buchtitel und „Inhalt“, dann je Rezept
  // Titel, „Zutaten“, „Zubereitung“ (die wiederholten Unterüberschriften zählen bei GitHub mit).
  slug(options.title);
  slug("Inhalt");
  const groups = groupByCategory(recipes);
  const toc: string[] = [];
  const sections: string[] = [];
  for (const group of groups) {
    toc.push(`**${escapeMarkdown(group.label)}**`, "");
    for (const r of group.recipes) {
      const anchor = slug(r.title.replace(/\s+/g, " "));
      slug("Zutaten");
      slug("Zubereitung");
      toc.push(`- [${inline(r.title)}](#${anchor})`);
      sections.push(recipeSection(r, 2));
    }
    toc.push("");
  }

  const count = recipes.length;
  const head = [
    `# ${inline(options.title)}`,
    `Exportiert am ${formatDate(options.exportedAt)} · ${count} ${count === 1 ? "Rezept" : "Rezepte"}`,
    "## Inhalt",
    count > 0 ? toc.join("\n").trim() : "*Noch keine Rezepte.*",
  ];
  if (sections.length === 0) return `${head.join("\n\n")}\n`;
  // Trennlinie zwischen den Rezepten
  return `${head.join("\n\n")}\n\n---\n\n${sections.join("\n\n---\n\n")}\n`;
}

/** Dateiname aus dem Rezepttitel: „Spaghetti Bolognese“ → „spaghetti-bolognese.md“. */
export function markdownFileName(title: string): string {
  const base = title
    .toLocaleLowerCase("de-DE")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return `${base || "rezept"}.md`;
}
