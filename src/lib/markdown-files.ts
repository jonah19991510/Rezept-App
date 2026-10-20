import { unzip, type Unzipped, type UnzipFileInfo } from "fflate";
import { MAX_FILE_CHARS, MAX_IMPORT_FILES, type MarkdownFile } from "@/lib/domain/markdown-import";

// Markdown-Import (Phase 13), nur im Browser: liest ausgewählte .md-Dateien oder einen ZIP-Export
// (Notion „Markdown & CSV“; große Exporte stecken dort noch einmal in „…-Part-1.zip“). Bilder, CSV usw.
// werden nicht entpackt. Nichts davon geht an den Server, nur die erkannten Zutatenzeilen später.

const MD = /\.(md|markdown)$/i;
const ZIP = /\.zip$/i;
/** Schutz vor ZIP-Bomben: höchstens so viel entpackter Text insgesamt */
const MAX_TOTAL_BYTES = 30 * 1024 * 1024;

export class MarkdownFileError extends Error {}

function unzipAsync(data: Uint8Array, filter: (file: UnzipFileInfo) => boolean): Promise<Unzipped> {
  return new Promise((resolve, reject) => unzip(data, { filter }, (err, result) => (err ? reject(err) : resolve(result))));
}

const decoder = new TextDecoder("utf-8");

async function readZip(data: Uint8Array, depth: number, out: MarkdownFile[], budget: { bytes: number }) {
  let entries: Unzipped;
  try {
    entries = await unzipAsync(data, (file) => {
      const wanted = MD.test(file.name) || (ZIP.test(file.name) && depth < 2);
      if (!wanted) return false;
      budget.bytes += file.originalSize;
      if (budget.bytes > MAX_TOTAL_BYTES) throw new MarkdownFileError("Das Archiv ist zu groß (mehr als 30 MB Text).");
      return true;
    });
  } catch (e) {
    if (e instanceof MarkdownFileError) throw e;
    throw new MarkdownFileError("Das ZIP-Archiv konnte nicht gelesen werden.");
  }
  // Notion legt Unterseiten in Ordner; sortiert bleibt die Reihenfolge stabil (Übersicht zuerst)
  for (const name of Object.keys(entries).sort((a, b) => a.localeCompare(b, "de"))) {
    if (out.length >= MAX_IMPORT_FILES) break;
    if (ZIP.test(name)) await readZip(entries[name], depth + 1, out, budget);
    else if (!name.split("/").some((part) => part.startsWith("__MACOSX") || part.startsWith("._"))) {
      out.push({ name, text: decoder.decode(entries[name]).slice(0, MAX_FILE_CHARS) });
    }
  }
}

/** Ausgewählte Dateien (Markdown oder ZIP) in Markdown-Texte verwandeln. */
export async function readMarkdownFiles(files: File[]): Promise<MarkdownFile[]> {
  const out: MarkdownFile[] = [];
  const budget = { bytes: 0 };
  for (const file of files) {
    if (ZIP.test(file.name) || file.type === "application/zip") {
      await readZip(new Uint8Array(await file.arrayBuffer()), 0, out, budget);
    } else if (MD.test(file.name) || /\.txt$/i.test(file.name) || file.type.startsWith("text/")) {
      budget.bytes += file.size;
      if (budget.bytes > MAX_TOTAL_BYTES) throw new MarkdownFileError("Die Dateien sind zu groß (mehr als 30 MB Text).");
      out.push({ name: file.name, text: (await file.text()).slice(0, MAX_FILE_CHARS) });
    }
    if (out.length >= MAX_IMPORT_FILES) break;
  }
  return out;
}
