// Timer im Kochmodus (Phase 9): Zeitangaben im Schritttext erkennen („10 Minuten“, „1 Std.“,
// „ca. 20–25 Min.“, „eine halbe Stunde“, „1 Std. 30 Min.“, englisch „10 minutes“) und Restzeiten anzeigen.

export type DetectedTimer = {
  start: number;
  end: number;
  /** Text, wie er im Schritt steht, z. B. „ca. 20–25 Min.“ */
  label: string;
  /** Untere Grenze in Sekunden (bei Bereichen wird zuerst zur kürzeren Zeit erinnert) */
  seconds: number;
  /** Obere Grenze bei Bereichen, sonst null */
  maxSeconds: number | null;
};

export type StepSegment = { type: "text"; text: string } | { type: "timer"; timer: DetectedTimer };

const WORD_NUMBERS: Record<string, number> = {
  ein: 1, eine: 1, einen: 1, einer: 1, einem: 1, a: 1, an: 1, one: 1,
  zwei: 2, two: 2, drei: 3, three: 3, vier: 4, four: 4, fünf: 5, five: 5, sechs: 6, six: 6,
  sieben: 7, acht: 8, neun: 9, zehn: 10, ten: 10, zwölf: 12, fünfzehn: 15, fifteen: 15,
  zwanzig: 20, twenty: 20, dreißig: 30, thirty: 30, vierzig: 40, forty: 40, sechzig: 60, anderthalb: 1.5,
};

const NUM = `(?:\\d+(?:[.,]\\d+)?(?:\\s*½)?|½|${Object.keys(WORD_NUMBERS).sort((a, b) => b.length - a.length).join("|")})`;
const UNIT = `(?:std\\.?|stunden?|stdn\\.?|h|hours?|hrs?\\.?|min\\.?|minuten?|mins?\\.?|minutes?|sek\\.?|sekunden?|secs?\\.?|seconds?)`;
const PREFIX = `(?:(?:ca\\.?|circa|etwa|ungefähr|about|approx\\.?|approximately)\\s+)?`;
const NOT_LETTER_BEFORE = `(?<![\\p{L}\\d])`;
const NOT_LETTER_AFTER = `(?![\\p{L}])`;

const DURATION = new RegExp(
  `${NOT_LETTER_BEFORE}${PREFIX}(${NUM})(?:\\s*(?:-|–|bis|to|or|oder)\\s*(${NUM}))?\\s*(${UNIT})${NOT_LETTER_AFTER}`,
  "giu",
);
const SPECIAL = new RegExp(
  `${NOT_LETTER_BEFORE}${PREFIX}(eine\\s+halbe\\s+stunde|einer\\s+halben\\s+stunde|halbe\\s+stunde|half\\s+an\\s+hour|dreiviertelstunde|viertelstunde)${NOT_LETTER_AFTER}`,
  "giu",
);
const JOIN = /^\s*(?:,|und|and)?\s*$/i;

function parseNum(token: string): number | null {
  const t = token.trim().toLowerCase();
  if (t in WORD_NUMBERS) return WORD_NUMBERS[t];
  if (t === "½") return 0.5;
  const half = t.endsWith("½");
  const n = Number(t.replace("½", "").trim().replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return half ? n + 0.5 : n;
}

function unitSeconds(unit: string): number {
  const u = unit.toLowerCase();
  if (/^(std|stunde|stdn|h|hour|hr)/.test(u)) return 3600;
  if (/^(min)/.test(u)) return 60;
  return 1;
}

const MAX_SECONDS = 12 * 3600;

/** Alle Zeitangaben im Text, in Reihenfolge. Angaben wie „1 Std. 30 Min.“ werden zu einem Timer. */
export function detectTimers(text: string): DetectedTimer[] {
  const raw: DetectedTimer[] = [];
  for (const m of text.matchAll(DURATION)) {
    const lo = parseNum(m[1]);
    const hi = m[2] != null ? parseNum(m[2]) : null;
    if (lo == null || lo <= 0) continue;
    const factor = unitSeconds(m[3]);
    raw.push({
      start: m.index,
      end: m.index + m[0].length,
      label: m[0].trim(),
      seconds: Math.round(lo * factor),
      maxSeconds: hi != null && hi > lo ? Math.round(hi * factor) : null,
    });
  }
  for (const m of text.matchAll(SPECIAL)) {
    const word = m[1].toLowerCase();
    const seconds = word.startsWith("dreiviertel") ? 2700 : word.startsWith("viertel") ? 900 : 1800;
    raw.push({ start: m.index, end: m.index + m[0].length, label: m[0].trim(), seconds, maxSeconds: null });
  }
  raw.sort((a, b) => a.start - b.start);

  // Stunden + Minuten (+ Sekunden) direkt hintereinander zusammenfassen
  const merged: DetectedTimer[] = [];
  for (const t of raw) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.maxSeconds == null &&
      t.maxSeconds == null &&
      t.seconds < prev.seconds &&
      JOIN.test(text.slice(prev.end, t.start))
    ) {
      prev.end = t.end;
      prev.label = text.slice(prev.start, t.end).trim();
      prev.seconds += t.seconds;
      continue;
    }
    if (prev && t.start < prev.end) continue; // Überschneidung
    merged.push({ ...t });
  }
  return merged.filter((t) => t.seconds >= 5 && t.seconds <= MAX_SECONDS);
}

/** Zerlegt den Schritttext in normale Textstücke und antippbare Timer. */
export function splitStepText(text: string): StepSegment[] {
  const segments: StepSegment[] = [];
  let pos = 0;
  for (const timer of detectTimers(text)) {
    if (timer.start > pos) segments.push({ type: "text", text: text.slice(pos, timer.start) });
    segments.push({ type: "timer", timer });
    pos = timer.end;
  }
  if (pos < text.length) segments.push({ type: "text", text: text.slice(pos) });
  return segments;
}

/** Restzeit als „4:05“ bzw. „1:02:03“. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Dauer als „10 Min.“, „1 Std. 30 Min.“ oder „45 Sek.“ (für Timer aus timer_seconds). */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} Std.`);
  if (m) parts.push(`${m} Min.`);
  if (s && !h) parts.push(`${s} Sek.`);
  return parts.join(" ") || "0 Sek.";
}
