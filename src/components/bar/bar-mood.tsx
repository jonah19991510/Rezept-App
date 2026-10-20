/**
 * Phase 15: Bar-Stimmung (tiefes Grün, Bernstein) für die ganze Seite, solange eine Bar-Ansicht offen ist.
 * Nur ein unsichtbarer Marker: globals.css färbt per `:root:has([data-bar-mood])` die ganze Seite um,
 * schon beim ersten Bild (kein Aufblitzen) und auch Kopfzeile, Navigation und Dialoge.
 */
export function BarMood() {
  return <span data-bar-mood hidden />;
}
