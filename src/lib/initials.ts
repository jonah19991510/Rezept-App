/** Initialen für den Avatar, z. B. „Anna Beispiel“ → „AB“, „Jo“ → „JO“. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2);
  return letters.toLocaleUpperCase("de-DE");
}
