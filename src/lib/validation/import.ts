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
