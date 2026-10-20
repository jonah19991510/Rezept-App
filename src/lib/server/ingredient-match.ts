import "server-only";
import type { ImportLine } from "@/lib/domain/import-draft";
import { parseIngredientLine, searchTermsFor } from "@/lib/domain/ingredient-line";
import { toIngredientOption, type IngredientOption } from "@/lib/domain/ingredient-option";
import { createClient } from "@/lib/supabase/server";

const normalize = (s: string) => s.toLocaleLowerCase("de-DE").normalize("NFKD").replace(/\p{Diacritic}/gu, "").trim();

/**
 * Zutatenzeilen zerlegen und je Zeile einen Vorschlag aus der Zutatentabelle suchen (Import per Link und
 * aus Markdown). Ein Matcher hält einen Cache, damit gleiche Suchbegriffe nur einmal abgefragt werden.
 */
export async function createIngredientMatcher() {
  const supabase = await createClient();
  const cache = new Map<string, Promise<IngredientOption | null>>();

  function search(term: string): Promise<IngredientOption | null> {
    const key = normalize(term);
    let hit = cache.get(key);
    if (!hit) {
      hit = Promise.resolve(supabase.rpc("search_ingredients", { p_query: term, p_limit: 1 })).then(({ data }) =>
        data?.[0] ? toIngredientOption(data[0]) : null,
      );
      cache.set(key, hit);
    }
    return hit;
  }

  return async function matchLine(raw: string): Promise<ImportLine> {
    const line = parseIngredientLine(raw);
    for (const term of searchTermsFor(line.name)) {
      const match = await search(term);
      if (match) return { ...line, match, exact: normalize(match.name) === normalize(line.name) };
    }
    return { ...line, match: null, exact: false };
  };
}
