// Rezeptfotos (Phase 7): Größen, Pfade im Storage und Prüfung der gewählten Datei.
// Das Verkleinern selbst passiert im Browser (src/lib/photo-compress.ts), dabei fallen EXIF-Daten weg.

/** Längste Kante des großen Fotos (Rezeptseite) und des Vorschaubilds (Karten) in Pixeln. */
export const PHOTO_MAX_EDGE = 1600;
export const THUMB_MAX_EDGE = 800;
export const PHOTO_QUALITY = 0.82;
export const THUMB_QUALITY = 0.75;
/** Größte Datei, die wir überhaupt zum Verkleinern annehmen (Handyfotos sind selten über 15 MB). */
export const MAX_INPUT_BYTES = 25 * 1024 * 1024;

export type PhotoExt = "webp" | "jpg";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PHOTO_PATH = new RegExp(`^(${UUID})/(${UUID})/(${UUID})(-klein)?\\.(webp|jpg)$`);

/** Neue Größe, die in max × max passt; kleinere Bilder werden nicht vergrößert. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Speicherpfade: <owner>/<rezept>/<foto>.webp und das Vorschaubild <foto>-klein.webp daneben. */
export function photoPaths(userId: string, recipeId: string, photoId: string, ext: PhotoExt) {
  const base = `${userId}/${recipeId}/${photoId}`;
  return { full: `${base}.${ext}`, thumb: `${base}-klein.${ext}` };
}

/** Pfad des Vorschaubilds zu einem gespeicherten Foto (recipes.image_url). */
export function thumbPathOf(fullPath: string): string {
  return fullPath.replace(/\.(webp|jpg)$/, "-klein.$1");
}

export type ParsedPhotoPath = { ownerId: string; recipeId: string; photoId: string; isThumb: boolean; ext: PhotoExt };

/** Zerlegt einen Storage-Pfad; null, wenn er nicht unserem Schema folgt. */
export function parsePhotoPath(path: string): ParsedPhotoPath | null {
  const m = PHOTO_PATH.exec(path);
  if (!m) return null;
  return { ownerId: m[1], recipeId: m[2], photoId: m[3], isThumb: Boolean(m[4]), ext: m[5] as PhotoExt };
}

/** Darf dieser Pfad als Foto des Rezepts gespeichert werden? (großes Foto, richtiger Ordner) */
export function isOwnPhotoPath(path: string, userId: string, recipeId: string): boolean {
  const p = parsePhotoPath(path);
  return p != null && !p.isThumb && p.ownerId === userId && p.recipeId === recipeId;
}

/** Adresse, unter der die App das Foto ausliefert (Route /foto/…, prüft die Leserechte). */
export function photoUrl(path: string, size: "gross" | "klein" = "gross"): string {
  return `/foto/${size === "klein" ? thumbPathOf(path) : path}`;
}

/** Prüft die gewählte Datei vor dem Verkleinern. Gibt eine Fehlermeldung zurück oder null. */
export function checkPhotoFile(file: { type: string; size: number; name?: string }): string | null {
  const isHeic = /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name ?? "");
  if (isHeic) {
    return "HEIC-Fotos kann der Browser hier nicht lesen. Bitte als JPG wählen (iPhone: Einstellungen → Kamera → Formate → „Maximale Kompatibilität“).";
  }
  if (file.type && !file.type.startsWith("image/")) return "Bitte ein Foto (JPG, PNG oder WebP) wählen.";
  if (file.size > MAX_INPUT_BYTES) return "Das Foto ist zu groß (höchstens 25 MB).";
  if (file.size === 0) return "Die Datei ist leer.";
  return null;
}
