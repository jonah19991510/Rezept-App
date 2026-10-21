// Beilagen (21.10.2026): Vorschläge, die nicht zum Rezept gehören (z. B. Spätzle zum Gulasch).
// Gespeichert als Texte in recipes.side_dishes; heißt eine Beilage wie ein eigenes Rezept, wird sie verlinkt.

export type SideDish = { name: string; recipeId: string | null };

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");
}

/**
 * Beilagen mit passenden Rezepten verbinden (gleicher Titel, ohne Groß-/Kleinschreibung und doppelte Leerzeichen).
 * Das Rezept selbst wird nie verlinkt; bei mehreren gleichnamigen Rezepten gilt das erste.
 */
export function linkSideDishes(
  sides: string[],
  recipes: { id: string; title: string }[],
  selfId?: string,
): SideDish[] {
  const byTitle = new Map<string, string>();
  for (const r of recipes) {
    if (r.id === selfId) continue;
    const key = normalize(r.title);
    if (!byTitle.has(key)) byTitle.set(key, r.id);
  }
  return sides
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => ({ name, recipeId: byTitle.get(normalize(name)) ?? null }));
}
