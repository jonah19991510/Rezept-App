// Kurze Anzeigenamen für Zutaten (Vorrat). Open-Food-Facts-Namen sind oft lang, z. B. „Bio Staudensellerie
// Klasse II (Edeka)“: In der Zeile steht „Staudensellerie“, der Rest wandert in die graue Zusatzzeile
// („Bio · Klasse II · Edeka“). Eine Korrektur von Hand steht in ingredients.display_name und geht immer vor.

export type IngredientLabel = { short: string; detail: string | null };

/** Siegel und Angaben, die nichts über die Zutat selbst sagen (kanonische Schreibweise für die Zusatzzeile) */
const QUALIFIERS = ["Bio", "Demeter", "Bioland", "Naturland", "Fairtrade", "lose", "unverpackt", "regional"];
const QUALIFIER = new RegExp(`(^|\\s)(${QUALIFIERS.join("|")})(?=\\s|$)`, "gi");
const BIO_PREFIX = /^bio-(?=\p{L})/iu;
const GRADE = /(^|\s)((?:handels)?klasse\s+(?:i{1,3}|[1-3]|extra))(?=\s|$)/gi;
const AMOUNT = /(^|\s)(\d+(?:[.,]\d+)?\s*(?:x\s*\d+(?:[.,]\d+)?\s*)?(?:kg|g|mg|l|ml|cl|stück|stk\.?|st\.?))(?=\s|$)/gi;
// Komma trennt, außer in Zahlen wie „3,8 %“
const SEPARATOR = /\s+[-–|/]\s+|,(?!\d)\s*/;

const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const canonical = (word: string) => QUALIFIERS.find((q) => q.toLowerCase() === word.toLowerCase()) ?? word;
const grade = (text: string) => {
  const [word, value] = norm(text).split(" ");
  const w = word.toLowerCase() === "handelsklasse" ? "Handelsklasse" : "Klasse";
  return `${w} ${/^[ivx]+$/i.test(value) ? value.toUpperCase() : value.toLowerCase() === "extra" ? "Extra" : value}`;
};

/** Langen Produktnamen in Kurzname und Zusatzinfo zerlegen. Bleibt nichts übrig, gilt der ganze Name. */
export function splitIngredientName(name: string): IngredientLabel {
  const full = norm(name);
  const brackets: string[] = [];
  let rest = full.replace(/\(([^)]*)\)|\[([^\]]*)\]/g, (_, a: string | undefined, b: string | undefined) => {
    const inner = norm(a ?? b ?? "");
    if (inner) brackets.push(inner);
    return " ";
  });
  const [base = "", ...segments] = rest.split(SEPARATOR).map(norm);

  const qualifiers: string[] = [];
  rest = base.replace(BIO_PREFIX, () => {
    qualifiers.push("Bio");
    return "";
  });
  rest = rest.replace(QUALIFIER, (_, lead: string, word: string) => {
    qualifiers.push(canonical(word));
    return lead;
  });
  rest = rest.replace(GRADE, (_, lead: string, text: string) => {
    qualifiers.push(grade(text));
    return lead;
  });
  rest = rest.replace(AMOUNT, (_, lead: string, text: string) => {
    qualifiers.push(norm(text));
    return lead;
  });

  const short = norm(rest);
  if (!short) return { short: full, detail: null };
  const seen = new Set([short.toLowerCase()]);
  const detail = [...qualifiers, ...segments, ...brackets].filter((p) => {
    const key = p.toLowerCase();
    if (!p || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { short, detail: detail.length ? detail.join(" · ") : null };
}

/**
 * Was der Vorrat zeigt: Korrektur von Hand (display_name) vor automatischer Kürzung. Automatisch gekürzt werden nur
 * Open-Food-Facts-Namen; selbst angelegte Zutaten und der Grundbestand heißen, wie man sie genannt hat.
 */
export function ingredientLabel(i: { name: string; displayName?: string | null; source?: string | null }): IngredientLabel {
  const manual = i.displayName ? norm(i.displayName) : "";
  if (manual) {
    const auto = splitIngredientName(i.name);
    const detail = auto.detail ?? (norm(i.name).toLowerCase() !== manual.toLowerCase() ? norm(i.name) : null);
    return { short: manual, detail };
  }
  if (i.source === "openfoodfacts") return splitIngredientName(i.name);
  return { short: norm(i.name), detail: null };
}
