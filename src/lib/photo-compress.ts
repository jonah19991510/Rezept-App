import { fitWithin, PHOTO_MAX_EDGE, PHOTO_QUALITY, THUMB_MAX_EDGE, THUMB_QUALITY, type PhotoExt } from "@/lib/domain/photo";

// Nur im Browser verwenden. Das Foto wird in ein Canvas gezeichnet und neu kodiert:
// Dabei gehen ALLE Metadaten verloren (EXIF mit GPS-Standort, Kameramodell, Aufnahmezeit …),
// nur die Pixel bleiben. Die Drehung aus dem EXIF wird vorher angewendet, damit das Bild richtig steht.

export type CompressedPhoto = { full: Blob; thumb: Blob; ext: PhotoExt; contentType: "image/webp" | "image/jpeg" };

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // ältere Browser kennen die Option nicht → unten über ein <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode(); // Browser drehen <img> heute selbst nach EXIF (image-orientation: from-image)
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function sizeOf(source: ImageBitmap | HTMLImageElement) {
  return source instanceof HTMLImageElement
    ? { width: source.naturalWidth, height: source.naturalHeight }
    : { width: source.width, height: source.height };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function render(
  source: ImageBitmap | HTMLImageElement,
  maxEdge: number,
  quality: number,
  preferWebp: boolean,
): Promise<{ blob: Blob; ext: PhotoExt }> {
  const { width, height } = fitWithin(sizeOf(source).width, sizeOf(source).height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nicht verfügbar");
  // Weißer Hintergrund für transparente PNGs (JPEG kennt keine Transparenz)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);

  if (preferWebp) {
    const webp = await toBlob(canvas, "image/webp", quality);
    // Safari kann (noch) kein WebP kodieren und liefert dann PNG → JPEG nehmen
    if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp" };
  }
  const jpeg = await toBlob(canvas, "image/jpeg", quality);
  if (!jpeg) throw new Error("Das Foto konnte nicht umgewandelt werden.");
  return { blob: jpeg, ext: "jpg" };
}

/** Verkleinert ein Foto auf 1600 px (und ein Vorschaubild auf 800 px), ohne Metadaten. */
export async function compressPhoto(file: Blob): Promise<CompressedPhoto> {
  const source = await decode(file);
  try {
    const full = await render(source, PHOTO_MAX_EDGE, PHOTO_QUALITY, true);
    // Vorschaubild im selben Format, damit beide Pfade dieselbe Endung haben
    const thumb = await render(source, THUMB_MAX_EDGE, THUMB_QUALITY, full.ext === "webp");
    if (thumb.ext !== full.ext) throw new Error("Uneinheitliches Bildformat");
    return {
      full: full.blob,
      thumb: thumb.blob,
      ext: full.ext,
      contentType: full.ext === "webp" ? "image/webp" : "image/jpeg",
    };
  } finally {
    if (!(source instanceof HTMLImageElement)) source.close();
  }
}
