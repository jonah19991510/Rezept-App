import { ImageResponse } from "next/og";

// App-Icon (Topf aus lucide „CookingPot“, wie im Logo) in Terrakotta mit cremefarbenem Strich.
// Wird beim Bauen als PNG erzeugt: Favicon, Apple-Touch-Icon und die Icons im Web-App-Manifest.

export const BRAND_TERRACOTTA = "#c45e3d"; // oklch(0.6 0.14 38) = --primary
export const BRAND_CREAM = "#fefaf3"; // oklch(0.985 0.01 80) = --primary-foreground
export const BRAND_BACKGROUND = "#fbf5ed"; // oklch(0.973 0.013 80) = --background

const POT_PATHS = [
  "M2 12h20",
  "M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8",
  "m4 8 16-4",
  "m8.86 6.78-.45-1.81a2 2 0 0 1 1.45-2.43l1.94-.48a2 2 0 0 1 2.43 1.46l.45 1.8",
];

/**
 * @param size Kantenlänge in Pixeln
 * @param rounded abgerundete Ecken (für „any“); maskable/Apple-Icons füllen die Fläche, das System rundet selbst
 * @param glyph Anteil des Symbols an der Kantenlänge (maskable kleiner, wegen der Sicherheitszone)
 */
export function appIconResponse(size: number, { rounded, glyph }: { rounded: boolean; glyph: number }) {
  const glyphSize = Math.round(size * glyph);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND_TERRACOTTA,
          borderRadius: rounded ? size * 0.22 : 0,
        }}
      >
        <svg
          width={glyphSize}
          height={glyphSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke={BRAND_CREAM}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {POT_PATHS.map((d) => (
            <path key={d} d={d} />
          ))}
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
