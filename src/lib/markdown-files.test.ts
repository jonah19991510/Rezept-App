import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { MarkdownFileError, readMarkdownFiles } from "./markdown-files";

// new Uint8Array(…) ergibt einen Puffer vom Typ ArrayBuffer, wie ihn File erwartet
const fileOf = (name: string, data: Uint8Array | string, type = "") =>
  new File([typeof data === "string" ? data : new Uint8Array(data)], name, { type });

describe("readMarkdownFiles", () => {
  it("liest einzelne Markdown-Dateien und ignoriert andere", async () => {
    const result = await readMarkdownFiles([fileOf("a.md", "# A"), fileOf("bild.jpg", "x", "image/jpeg")]);
    expect(result).toEqual([{ name: "a.md", text: "# A" }]);
  });

  it("entpackt Notion-ZIPs samt verschachteltem Teil-Archiv, ohne Bilder und CSV", async () => {
    const inner = zipSync({
      "Rezepte/Pasta Alfredo 49d86cd950e94a41b90219ebd07bd607.md": strToU8("# Pasta Alfredo\n"),
      "Rezepte/Pasta Alfredo 49d86cd950e94a41b90219ebd07bd607/bild.jpg": new Uint8Array([1, 2, 3]),
    });
    const outer = zipSync({
      "Rezepte ba1135fadd254b79aae5353755a1393a.md": strToU8("# Rezepte\n"),
      "Rezepte 4a003a20514b4e308f346d3655ffdca8.csv": strToU8("Name\nPasta Alfredo\n"),
      "ExportBlock-Part-1.zip": inner,
    });
    const result = await readMarkdownFiles([fileOf("export.zip", outer, "application/zip")]);
    expect(result.map((f) => f.name)).toEqual([
      "Rezepte/Pasta Alfredo 49d86cd950e94a41b90219ebd07bd607.md",
      "Rezepte ba1135fadd254b79aae5353755a1393a.md",
    ]);
    expect(result[0].text).toBe("# Pasta Alfredo\n");
  });

  it("meldet kaputte Archive verständlich", async () => {
    await expect(readMarkdownFiles([fileOf("kaputt.zip", "kein zip")])).rejects.toBeInstanceOf(MarkdownFileError);
  });
});
