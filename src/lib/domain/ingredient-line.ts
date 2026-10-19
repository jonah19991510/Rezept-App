import type { Unit } from "./units";

// Zerlegt Zutatenzeilen aus importierten Rezepten („200 g Mehl“, „1/2 TL Salz“, „2 cups flour“)
// in Menge, Einheit, Name und Notiz. Amerikanische Einheiten werden dabei metrisch umgerechnet
// (cup pauschal 240 ml; zutatenabhängige Dichten kommen mit Phase 9).

export type ParsedIngredientLine = {
  raw: string;
  amount: number | null;
  unit: Unit | null;
  /** Zutatenname für die Suche, ohne Mengen und Zusätze */
  name: string;
  /** Zusätze wie „fein gehackt“, „Dose“, „2–3“ oder die Umrechnung „aus 1 cup“ */
  note: string;
};

const FRACTIONS: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125, "⅕": 0.2 };

/** Einheit, ggf. mit Umrechnungsfaktor und dem Wort, das als Notiz erhalten bleibt. */
type UnitRule = { unit: Unit; factor?: number; us?: string; keepWord?: boolean };

// Längere Schreibweisen zuerst, damit „fl oz“ vor „oz“ und „Esslöffel“ vor „EL“ greift.
const UNIT_WORDS: [string, UnitRule][] = [
  ["fl\\.? ?oz\\.?", { unit: "ml", factor: 29.57, us: "fl oz" }],
  ["esslöffeln?|eßlöffeln?|essl\\.?|el\\.?", { unit: "tbsp" }],
  ["tablespoons?|tbsps?\\.?|tbs\\.?|tbl\\.?", { unit: "tbsp" }],
  ["teelöffeln?|teel\\.?|tl\\.?", { unit: "tsp" }],
  ["teaspoons?|tsps?\\.?", { unit: "tsp" }],
  ["barlöffeln?|bl\\.?", { unit: "barspoon" }],
  ["kilogramm|kg\\.?", { unit: "g", factor: 1000 }],
  ["gramm|gr\\.?|g\\.?", { unit: "g" }],
  ["milliliter|ml\\.?", { unit: "ml" }],
  ["zentiliter|cl\\.?", { unit: "cl" }],
  ["deziliter|dl\\.?", { unit: "ml", factor: 100 }],
  ["liter|ltr\\.?|l\\.?", { unit: "ml", factor: 1000 }],
  ["prisen?|pinch(?:es)?", { unit: "pinch" }],
  ["messerspitzen?|msp\\.?", { unit: "pinch", keepWord: true }],
  ["dash(?:es)?|spritzer", { unit: "dash" }],
  ["stücke?|stk\\.?|st\\.", { unit: "piece" }],
  ["cups?|c\\.", { unit: "ml", factor: 240, us: "cup" }],
  ["ounces?|oz\\.?", { unit: "g", factor: 28.35, us: "oz" }],
  ["pounds?|lbs?\\.?", { unit: "g", factor: 453.6, us: "lb" }],
  ["pints?|pt\\.?", { unit: "ml", factor: 473, us: "pint" }],
  ["quarts?|qt\\.?", { unit: "ml", factor: 946, us: "quart" }],
  ["sticks?", { unit: "g", factor: 113, us: "stick" }],
  // Gebinde und Zählwörter: als Stück zählen, das Wort bleibt als Notiz sichtbar
  [
    "dosen?|bund|bunde|packungen?|pck\\.?|pkt\\.?|päckchen|becher|scheiben?|zehen?|knollen?|gläser|glas|tassen?|handvoll|zweige?|stangen?|stängel|blätter|blatt|köpfe?|würfel|tüten?|beutel|flaschen?|cloves?|cans?|slices?",
    { unit: "piece", keepWord: true },
  ],
];

const UNIT_PATTERN = new RegExp(`^(${UNIT_WORDS.map(([w]) => `(?:${w})`).join("|")})(?=\\s|$|[,(])`, "i");

function ruleFor(word: string): UnitRule | null {
  for (const [pattern, rule] of UNIT_WORDS) if (new RegExp(`^(?:${pattern})$`, "i").test(word)) return rule;
  return null;
}

function parseNumber(token: string): number | null {
  const t = token.trim();
  if (/^\d+\/\d+$/.test(t)) {
    const [a, b] = t.split("/").map(Number);
    return b ? a / b : null;
  }
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(t);
  if (mixed) return Number(mixed[1]) + (Number(mixed[3]) ? Number(mixed[2]) / Number(mixed[3]) : 0);
  // 1.000 (Tausenderpunkt) → 1000, 1,5 / 1.5 → 1,5
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ""));
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function roundConverted(value: number, unit: Unit): number {
  if (unit === "g" || unit === "ml") return value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return Math.round(value * 100) / 100;
}

function formatPlain(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100).replace(".", ",");
}

const QUANTITY = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)*)(?:\s*(?:-|bis|to)\s*(\d+\/\d+|\d+(?:[.,]\d+)?))?/i;
const VAGUE_PREFIX = /^(ca\.?|circa|etwa|ungefähr|about|approx\.?)\s+/i;
const VAGUE_AMOUNT = /^(etwas|einige|ein paar|eine? handvoll|nach belieben|n\. ?b\.?|evtl\.?|optional|some|a pinch of)\s+/i;

export function parseIngredientLine(input: string): ParsedIngredientLine {
  const raw = input.replace(/\s+/g, " ").trim();
  let rest = raw
    .replace(/[–—]/g, "-")
    // „1½“ → „1 1/2“, „½“ → „1/2“
    .replace(/(\d)?\s*([½¼¾⅓⅔⅛⅕])/g, (_m, whole: string | undefined, frac: string) => {
      const value = FRACTIONS[frac];
      const as = value === 0.5 ? "1/2" : value === 0.25 ? "1/4" : value === 0.75 ? "3/4" : String(value);
      return whole ? `${whole} ${as} ` : `${as} `;
    })
    .replace(/\s+/g, " ")
    .trim();
  const notes: string[] = [];

  rest = rest.replace(VAGUE_PREFIX, "");
  const vague = VAGUE_AMOUNT.exec(rest);
  if (vague) {
    notes.push(vague[1].toLowerCase());
    rest = rest.slice(vague[0].length);
  }

  let amount: number | null = null;
  let quantityText = "";
  const q = QUANTITY.exec(rest);
  if (q) {
    quantityText = q[1].trim();
    amount = parseNumber(q[1]);
    if (q[2] != null && amount != null) {
      const upper = parseNumber(q[2]);
      if (upper != null) notes.push(`${formatPlain(amount)}–${formatPlain(upper)}`);
    }
    rest = rest.slice(q[0].length).trim();
  }

  let unit: Unit | null = null;
  const u = UNIT_PATTERN.exec(rest);
  if (u && amount != null) {
    const word = u[1];
    const rule = ruleFor(word);
    if (rule) {
      unit = rule.unit;
      if (rule.us) notes.push(`aus ${quantityText.replace(".", ",")} ${rule.us}`);
      else if (rule.keepWord) notes.push(word.replace(/\.$/, ""));
      if (rule.factor) amount = roundConverted(amount * rule.factor, rule.unit);
      rest = rest.slice(word.length).trim();
    }
  }
  if (amount != null && unit == null) unit = "piece";

  // „of“ aus „2 cups of flour“
  rest = rest.replace(/^of\s+/i, "");
  // Pluralendungen in Klammern: „Zwiebel(n)“, „Ei(er)“
  rest = rest.replace(/\((n|en|e|s|er|nen)\)/gi, "");
  // Klammerzusätze und alles nach dem ersten Komma sind Notizen
  rest = rest.replace(/\(([^)]*)\)/g, (_m, inner: string) => {
    if (inner.trim()) notes.push(inner.trim());
    return " ";
  });
  const comma = rest.indexOf(",");
  if (comma >= 0) {
    const after = rest.slice(comma + 1).trim();
    if (after) notes.push(after);
    rest = rest.slice(0, comma);
  }
  const name = rest.replace(/\*/g, "").replace(/\s+/g, " ").replace(/^[-–:;.\s]+|[-–:;.\s]+$/g, "").trim();

  return {
    raw,
    amount: amount != null && amount > 0 ? amount : null,
    unit: amount != null && amount > 0 ? unit : null,
    name: name || raw,
    note: notes.join(", ").slice(0, 200),
  };
}

/** Suchbegriffe für die Zutatensuche: erst der ganze Name, dann einzelne Wörter (längste zuerst). */
export function searchTermsFor(name: string): string[] {
  const words = name
    .split(/[\s/-]+/)
    .map((w) => w.replace(/[^\p{L}]/gu, ""))
    .filter((w) => w.length >= 4)
    .sort((a, b) => b.length - a.length);
  return [...new Set([name.trim(), ...words])].filter(Boolean).slice(0, 4);
}
