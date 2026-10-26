import type { Enums } from "@/lib/supabase/database.types";

// Sport & Gesundheit, Phase S1: Übungsdatenbank (Bezeichnungen, Gruppierung, Suche).

export type MuscleGroup = Enums<"muscle_group">;
export type Equipment = Enums<"exercise_equipment">;
export type Tracking = Enums<"exercise_tracking">;

/** Reihenfolge wie im Gym gedacht: Oberkörper, Rumpf, Beine, Ganzkörper, Ausdauer. */
export const MUSCLE_ORDER: MuscleGroup[] = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "core",
  "quads",
  "hamstrings",
  "glutes",
  "adductors",
  "calves",
  "full_body",
  "cardio",
];

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: "Brust",
  back: "Rücken",
  shoulders: "Schultern",
  biceps: "Bizeps",
  triceps: "Trizeps",
  forearms: "Unterarme",
  core: "Bauch",
  quads: "Beinstrecker",
  hamstrings: "Beinbeuger",
  glutes: "Gesäß",
  adductors: "Adduktoren",
  calves: "Waden",
  full_body: "Ganzkörper",
  cardio: "Ausdauer",
};

export const EQUIPMENT_ORDER: Equipment[] = [
  "barbell",
  "dumbbell",
  "ez_bar",
  "machine",
  "smith_machine",
  "cable",
  "bodyweight",
  "kettlebell",
  "band",
  "other",
];

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: "Langhantel",
  dumbbell: "Kurzhantel",
  ez_bar: "SZ-Stange",
  machine: "Maschine",
  smith_machine: "Smith-Maschine",
  cable: "Kabelzug",
  bodyweight: "Körpergewicht",
  kettlebell: "Kettlebell",
  band: "Band",
  other: "Sonstiges",
};

export const TRACKING_ORDER: Tracking[] = ["weight_reps", "bodyweight_reps", "time", "distance_time"];

export const TRACKING_LABELS: Record<Tracking, string> = {
  weight_reps: "Gewicht × Wiederholungen",
  bodyweight_reps: "Wiederholungen (Zusatzgewicht optional)",
  time: "Zeit",
  distance_time: "Strecke und Zeit",
};

export type ExerciseOption = {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  tracking: Tracking;
  /** selbst angelegt */
  own: boolean;
};

/** Zählt die Übung nach Zeit statt Wiederholungen? (Plank, Laufband) */
export function isTimed(tracking: Tracking): boolean {
  return tracking === "time" || tracking === "distance_time";
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "de");

/** Übungen nach Muskelgruppe (feste Reihenfolge), innerhalb alphabetisch; leere Gruppen fallen weg. */
export function groupByMuscle<E extends Pick<ExerciseOption, "name" | "muscleGroup">>(list: E[]): { muscle: MuscleGroup; items: E[] }[] {
  return MUSCLE_ORDER.map((muscle) => ({ muscle, items: list.filter((e) => e.muscleGroup === muscle).sort(byName) })).filter(
    (g) => g.items.length > 0,
  );
}

/** Für die Suche: klein, ohne Akzente/Umlaute-Unterschiede (ü = u), Satzzeichen als Leerzeichen. */
export function normalizeSearch(value: string): string {
  return value
    .toLocaleLowerCase("de")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Suche in Name, Muskelgruppe und Gerät: Jedes Wort muss irgendwo vorkommen („kh schräg“ findet nichts, „kurzhantel
 * schräg“ schon). Treffer am Namensanfang zuerst, sonst alphabetisch. Optional nur eine Muskelgruppe (Haupt- oder
 * Nebenmuskel).
 */
export function searchExercises<E extends ExerciseOption>(list: E[], query: string, muscle: MuscleGroup | null = null): E[] {
  const words = normalizeSearch(query).split(" ").filter(Boolean);
  const filtered = list.filter((e) => {
    if (muscle && e.muscleGroup !== muscle && !e.secondaryMuscles.includes(muscle)) return false;
    if (words.length === 0) return true;
    const haystack = normalizeSearch(`${e.name} ${MUSCLE_LABELS[e.muscleGroup]} ${EQUIPMENT_LABELS[e.equipment]}`);
    return words.every((w) => haystack.includes(w));
  });
  const first = words[0];
  return filtered.sort((a, b) => {
    // Bei gewählter Muskelgruppe: Übungen mit ihr als Hauptmuskel zuerst
    if (muscle) {
      const pa = a.muscleGroup === muscle ? 0 : 1;
      const pb = b.muscleGroup === muscle ? 0 : 1;
      if (pa !== pb) return pa - pb;
    }
    if (first) {
      const sa = normalizeSearch(a.name).startsWith(first) ? 0 : 1;
      const sb = normalizeSearch(b.name).startsWith(first) ? 0 : 1;
      if (sa !== sb) return sa - sb;
    }
    return byName(a, b);
  });
}

// ---------------------------------------------------------------------------
// Übungsdatenbank im Profilmenü
// ---------------------------------------------------------------------------

export type LibraryExercise = ExerciseOption & {
  /** Grundbestand, selbst angelegt oder von jemand anderem angelegt */
  origin: "seed" | "own" | "other";
  /** in wie vielen eigenen Plänen */
  planCount: number;
  /** in wie vielen eigenen Trainings */
  workoutCount: number;
};

export type LibraryView = "alle" | "eigene" | "plaene" | "trainiert";

export const LIBRARY_VIEW_LABELS: Record<LibraryView, string> = {
  alle: "Alle",
  eigene: "Eigene",
  plaene: "In meinen Plänen",
  trainiert: "Trainiert",
};

export function matchesLibraryView(e: LibraryExercise, view: LibraryView): boolean {
  if (view === "eigene") return e.origin === "own";
  if (view === "plaene") return e.planCount > 0;
  if (view === "trainiert") return e.workoutCount > 0;
  return true;
}

/** Übungen für die Datenbank-Seite filtern (Ansicht, Muskelgruppe inkl. Nebenmuskeln, Suche wie in der Auswahl). */
export function filterLibrary<E extends LibraryExercise>(list: E[], options: { query: string; view: LibraryView; muscle: MuscleGroup | null }): E[] {
  return searchExercises(
    list.filter((e) => matchesLibraryView(e, options.view)),
    options.query,
    options.muscle,
  );
}

/** Darf der Nutzer die Übung ändern? Eigene immer, den Grundbestand nur Admins. */
export function canEditExercise(e: Pick<LibraryExercise, "origin">, isAdmin: boolean): boolean {
  return e.origin === "own" || (e.origin === "seed" && isAdmin);
}
