import { z } from "zod";

/** Adresse für den Import per Link (die genaue Prüfung auf öffentliche Adressen macht der Server). */
export const importUrlSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "Bitte eine Webadresse eingeben.")
    .max(2000, "Die Adresse ist zu lang.")
    // „chefkoch.de/…“ ohne https:// ist auch in Ordnung
    .transform((v) => (/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`))
    .pipe(z.url({ protocol: /^https?$/, error: "Bitte eine Webadresse mit http(s):// angeben." })),
});

/** Markdown-Import: Zutatenzeilen eines Pakets ausgewählter Rezepte zum Zuordnen. */
export const MARKDOWN_MATCH_BATCH = 10;

export const markdownMatchSchema = z.object({
  recipes: z
    .array(
      z.object({
        ingredients: z
          .array(z.object({ text: z.string().trim().min(1).max(300), extraNote: z.string().max(200) }))
          .max(100),
      }),
    )
    .min(1)
    .max(MARKDOWN_MATCH_BATCH),
});

export type MarkdownMatchInput = z.infer<typeof markdownMatchSchema>;
