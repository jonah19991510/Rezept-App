import type { Guide } from "@/lib/domain/body";

/**
 * Schlichte Figur von vorne mit der Messstelle: ein Maßband (Ellipse, hinten gestrichelt) bzw. eine Waage unter den
 * Füßen. Farben aus dem Thema, damit sie hell und dunkel passt.
 */
export function BodyFigure({ mark, className }: { mark: Guide["mark"]; className?: string }) {
  return (
    <svg viewBox="0 0 120 240" className={className} role="img" aria-label="Figur mit der Messstelle">
      <g fill="var(--muted)" stroke="var(--muted-foreground)" strokeOpacity={0.55} strokeWidth={1.4} strokeLinejoin="round">
        {/* Kopf und Hals */}
        <circle cx="60" cy="22" r="13" />
        <path d="M54 34 L54 44 L66 44 L66 34" />
        {/* Rumpf mit Schultern */}
        <path d="M26 54 Q28 46 40 45 L80 45 Q92 46 94 54 L90 96 Q86 104 88 116 L90 132 L30 132 L32 116 Q34 104 30 96 Z" />
        {/* Arme */}
        <path d="M26 54 Q20 58 19 70 L16 110 Q15 122 18 128 L24 128 Q26 120 26 110 L30 74" />
        <path d="M94 54 Q100 58 101 70 L104 110 Q105 122 102 128 L96 128 Q94 120 94 110 L90 74" />
        {/* Beine */}
        <path d="M30 132 Q34 160 37 186 L38 226 L54 226 L56 186 Q58 160 60 140 Q62 160 64 186 L66 226 L82 226 L83 186 Q86 160 90 132 Z" />
      </g>
      {mark.kind === "scale" ? (
        <g>
          <rect x="26" y="226" width="68" height="10" rx="3" fill="var(--sport)" opacity={0.85} />
          <rect x="54" y="228.5" width="12" height="5" rx="1" fill="var(--card)" />
        </g>
      ) : (
        <g fill="none" stroke="var(--sport)" strokeWidth={2.4} strokeLinecap="round">
          {/* hintere Hälfte gestrichelt, vordere durchgezogen */}
          <path d={`M${mark.cx - mark.rx} ${mark.cy} A${mark.rx} ${mark.ry} 0 0 1 ${mark.cx + mark.rx} ${mark.cy}`} strokeDasharray="3 3" opacity={0.7} />
          <path d={`M${mark.cx - mark.rx} ${mark.cy} A${mark.rx} ${mark.ry} 0 0 0 ${mark.cx + mark.rx} ${mark.cy}`} />
        </g>
      )}
    </svg>
  );
}
