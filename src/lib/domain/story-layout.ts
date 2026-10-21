// Rezeptkarte als Bild (Phase 14, mit Zubereitung seit 21.10.2026): 1080 px breit, mindestens 1920 px hoch
// (Story-Format). Passen Zutaten und Schritte nicht hinein, wird das Bild länger. Der Renderer (Satori) braucht
// die Höhe vorab; sie wird hier aus den Textlängen geschätzt, lieber etwas zu großzügig (dann bleibt unten Platz)
// als zu knapp (dann wäre das Ende abgeschnitten).

export const STORY_WIDTH = 1080;
export const STORY_MIN_HEIGHT = 1920;
/** Sehr lange Rezepte: höchstens so hoch (Messenger verkleinern noch längere Bilder bis zur Unlesbarkeit) */
export const STORY_MAX_HEIGHT = 7200;
export const STORY_PHOTO_HEIGHT = 640;

/** Maße der Karte, dieselben Werte benutzt share-images.tsx */
export const STORY = {
  margin: 48,
  padding: 56,
  gap: 32,
  /** Foto: Karte ragt so weit ins Foto hinein */
  photoOverlap: 80,
  /** ohne Foto: Farbband oben */
  band: 140,
  kicker: { size: 30, lineHeight: 1.2 },
  title: { size: 68, lineHeight: 1.1 },
  meta: { size: 30, lineHeight: 1.25 },
  heading: { size: 36, lineHeight: 1.2 },
  ingredient: { size: 28, lineHeight: 1.3, quantityWidth: 180, gap: 20, rowGap: 8 },
  step: { size: 27, lineHeight: 1.4, badge: 44, gap: 20, rowGap: 16 },
  sides: { size: 28, lineHeight: 1.35 },
  macros: 112,
  brand: 44,
  /** Ø Zeichenbreite der eingebauten Schrift im Verhältnis zur Schriftgröße (eher großzügig geschätzt) */
  charWidth: 0.52,
} as const;

/** Innere Breite der Karte */
export const STORY_INNER_WIDTH = STORY_WIDTH - 2 * STORY.margin - 2 * STORY.padding - 4;

/** Wie viele Zeichen passen bei dieser Schriftgröße in eine Zeile dieser Breite? */
export function charsPerLine(width: number, fontSize: number): number {
  return Math.max(8, Math.floor(width / (fontSize * STORY.charWidth)));
}

/** Zeilen nach Wortumbruch (gierig, wie im Browser); zu lange Wörter brechen hart um. */
export function wrappedLines(text: string, maxChars: number): number {
  let lines = 0;
  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines += 1;
      continue;
    }
    let current = 0;
    lines += 1;
    for (const word of words) {
      let w = word.length;
      if (current === 0) {
        while (w > maxChars) {
          lines += 1;
          w -= maxChars;
        }
        current = w;
      } else if (current + 1 + w <= maxChars) {
        current += 1 + w;
      } else {
        lines += 1;
        while (w > maxChars) {
          lines += 1;
          w -= maxChars;
        }
        current = w;
      }
    }
  }
  return Math.max(1, lines);
}

export type StoryContent = {
  hasPhoto: boolean;
  hasKicker: boolean;
  title: string;
  meta: string;
  hasMacros: boolean;
  /** Text je Zutatenzeile (ohne Menge) */
  ingredients: string[];
  steps: string[];
  sides: string | null;
};

const px = (size: number, lineHeight: number, lines = 1) => Math.ceil(size * lineHeight * lines);

/** Geschätzte Höhe des Bildes, zwischen STORY_MIN_HEIGHT und STORY_MAX_HEIGHT. */
export function storyHeight(c: StoryContent): number {
  const w = STORY_INNER_WIDTH;
  const top = c.hasPhoto ? STORY_PHOTO_HEIGHT - STORY.photoOverlap : STORY.band + STORY.margin;

  const blocks: number[] = [];
  // Kopf: Oberzeile, Titel, Eckdaten (Abstand 14 zwischen den Zeilen)
  let header = px(STORY.title.size, STORY.title.lineHeight, wrappedLines(c.title, charsPerLine(w, STORY.title.size)));
  if (c.hasKicker) header += px(STORY.kicker.size, STORY.kicker.lineHeight) + 14;
  if (c.meta) header += px(STORY.meta.size, STORY.meta.lineHeight, wrappedLines(c.meta, charsPerLine(w, STORY.meta.size))) + 14;
  blocks.push(header);
  if (c.hasMacros) blocks.push(STORY.macros);

  if (c.ingredients.length > 0) {
    const i = STORY.ingredient;
    const perLine = charsPerLine(w - i.quantityWidth - i.gap, i.size);
    const rows = c.ingredients.map((t) => px(i.size, i.lineHeight, wrappedLines(t, perLine)));
    blocks.push(px(STORY.heading.size, STORY.heading.lineHeight) + rows.reduce((a, b) => a + b + i.rowGap, 0));
  }

  if (c.steps.length > 0) {
    const s = STORY.step;
    const perLine = charsPerLine(w - s.badge - s.gap, s.size);
    const rows = c.steps.map((t) => Math.max(s.badge, px(s.size, s.lineHeight, wrappedLines(t, perLine))));
    blocks.push(px(STORY.heading.size, STORY.heading.lineHeight) + rows.reduce((a, b) => a + b + s.rowGap, 0));
  }

  if (c.sides) blocks.push(px(STORY.sides.size, STORY.sides.lineHeight, wrappedLines(c.sides, charsPerLine(w, STORY.sides.size))));
  blocks.push(STORY.brand);

  const content = blocks.reduce((a, b) => a + b, 0) + STORY.gap * (blocks.length - 1);
  // Sicherheitsabstand für Schätzfehler
  const total = top + STORY.padding * 2 + content + STORY.margin + 60;
  return Math.min(STORY_MAX_HEIGHT, Math.max(STORY_MIN_HEIGHT, Math.ceil(total)));
}
