"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { syncWorkoutAction } from "@/app/(app)/sport/training-actions";
import { toSyncPayload, type Session } from "@/lib/domain/workout";

// Training auf dem Handy: Jede Änderung landet sofort im Speicher des Browsers (localStorage) und wird danach
// hochgeladen. Ohne Netz bleibt sie dort, bis wieder Netz da ist (Ereignis „online“, sonst neuer Versuch alle 15 s).

const PREFIX = "training:";
const RETRY_MS = 15_000;
const DEBOUNCE_MS = 700;

export type SyncState = "saved" | "saving" | "offline";

function storageKey(id: string) {
  return `${PREFIX}${id}`;
}

function readLocal(id: string): Session | null {
  try {
    const raw = window.localStorage.getItem(storageKey(id));
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function writeLocal(session: Session) {
  try {
    window.localStorage.setItem(storageKey(session.id), JSON.stringify(session));
  } catch {
    // Speicher voll oder gesperrt (privater Modus): dann nur online
  }
}

/** Lokale Kopie und die gespeicherte Seite des Trainings entfernen (nach dem Abschluss oder Verwerfen). */
export function clearLocalWorkout(id: string) {
  try {
    window.localStorage.removeItem(storageKey(id));
  } catch {
    // egal
  }
  if ("caches" in window) void caches.open("rezeptbuch-training").then((c) => c.delete(`/training/${id}`)).catch(() => undefined);
}

/** Alle lokalen Trainings entfernen (beim Abmelden, damit auf geteilten Geräten nichts liegen bleibt). */
export function clearAllLocalWorkouts() {
  try {
    for (const key of Object.keys(window.localStorage)) if (key.startsWith(PREFIX)) window.localStorage.removeItem(key);
  } catch {
    // egal
  }
  if ("caches" in window) void caches.delete("rezeptbuch-training").catch(() => undefined);
}

/**
 * Stand des Trainings mit Speichern auf dem Handy und Hochladen. `update` zählt die Version hoch; neuere lokale
 * Stände (z. B. nach einem Funkloch und Neuladen) gewinnen gegen den Stand vom Server.
 */
function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function useWorkoutSession(initial: Session) {
  const [session, setSession] = useState(initial);
  const [syncedVersion, setSyncedVersion] = useState(initial.version);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const sending = useRef(false);
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );

  // Lokaler Stand neuer als der vom Server? Dann gilt er (noch nicht hochgeladen)
  useEffect(() => {
    const local = readLocal(initial.id);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- einmalig nach dem Laden (localStorage gibt es erst im Browser)
    if (local && local.version > initial.version) setSession(local);
  }, [initial.id, initial.version]);

  const update = useCallback((change: (prev: Session) => Session) => {
    setSession((prev) => ({ ...change(prev), version: prev.version + 1 }));
  }, []);

  // Jeden Stand sofort auf dem Handy sichern
  useEffect(() => {
    if (session.version > syncedVersion) writeLocal(session);
  }, [session, syncedVersion]);

  // Hochladen (entprellt); bei Fehler später erneut, ohne Netz erst, wenn es wieder da ist
  useEffect(() => {
    if (session.version <= syncedVersion || !online) return;
    const timer = window.setTimeout(async () => {
      if (sending.current) return;
      sending.current = true;
      const sent = session;
      try {
        const result = await syncWorkoutAction(toSyncPayload(sent));
        if (result.ok) {
          if (result.version > sent.version) {
            // Auf einem anderen Gerät wurde weitertrainiert: dieser Stand soll trotzdem gelten
            setSession((prev) => ({ ...prev, version: result.version + 1 }));
          } else setSyncedVersion((v) => Math.max(v, sent.version));
          setFailed(false);
        } else {
          setFailed(true);
          window.setTimeout(() => setRetry((n) => n + 1), RETRY_MS);
        }
      } catch {
        // kein Netz oder Server nicht erreichbar
        setFailed(true);
        window.setTimeout(() => setRetry((n) => n + 1), RETRY_MS);
      } finally {
        sending.current = false;
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [session, syncedVersion, retry, online]);

  const synced = session.version <= syncedVersion;
  const state: SyncState = synced ? "saved" : !online || failed ? "offline" : "saving";
  return { session, update, state, synced };
}
