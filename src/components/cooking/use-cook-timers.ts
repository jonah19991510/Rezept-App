"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CookTimer = {
  id: number;
  label: string;
  /** Schritt, aus dem der Timer stammt (für die Anzeige „Schritt 3“) */
  step: number;
  totalMs: number;
  /** Zeitpunkt, an dem der Timer abläuft; null = pausiert */
  endsAt: number | null;
  /** Restzeit beim Pausieren */
  pausedRemainingMs: number;
};

let nextId = 1;

/** Kurzer Gong mit der Web-Audio-API (keine Audiodatei, funktioniert offline). */
function beep(ctx: AudioContext) {
  const now = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = i === 2 ? 1046 : 880;
    gain.gain.setValueAtTime(0.0001, now + i * 0.35);
    gain.gain.exponentialRampToValueAtTime(0.4, now + i * 0.35 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.35 + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + i * 0.35);
    osc.stop(now + i * 0.35 + 0.32);
  }
}

/**
 * Mehrere Timer parallel. Gerechnet wird mit Endzeitpunkten, damit die Timer auch dann stimmen,
 * wenn der Browser die Seite kurz drosselt. Läuft einer ab: Ton (wiederholt, bis bestätigt) und Vibration.
 */
export function useCookTimers() {
  const [timers, setTimers] = useState<CookTimer[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const audio = useRef<AudioContext | null>(null);

  // Audio muss auf iOS durch eine Nutzeraktion freigeschaltet werden: beim ersten Timerstart
  const unlockAudio = useCallback(() => {
    if (audio.current || typeof window === "undefined") return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audio.current = new Ctx();
    void audio.current.resume();
  }, []);

  const isFinished = useCallback((t: CookTimer) => t.endsAt != null && t.endsAt <= now, [now]);
  const ticking = timers.some((t) => t.endsAt != null);
  const ringing = timers.some(isFinished);

  // Takt, solange ein Timer läuft oder klingelt
  useEffect(() => {
    if (!ticking) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [ticking]);

  // Klingeln und vibrieren, bis der Nutzer bestätigt (höchstens 2 Minuten)
  useEffect(() => {
    if (!ringing) return;
    const ring = () => {
      if (audio.current) beep(audio.current);
      navigator.vibrate?.([400, 200, 400, 200, 400]);
    };
    ring();
    let count = 0;
    const id = window.setInterval(() => {
      if (++count > 60) return window.clearInterval(id);
      ring();
    }, 2000);
    return () => window.clearInterval(id);
  }, [ringing]);

  const start = useCallback(
    (label: string, seconds: number, step: number) => {
      unlockAudio();
      const totalMs = seconds * 1000;
      const startedAt = Date.now();
      setNow(startedAt);
      setTimers((prev) => [
        ...prev,
        { id: nextId++, label, step, totalMs, endsAt: startedAt + totalMs, pausedRemainingMs: totalMs },
      ]);
    },
    [unlockAudio],
  );

  const togglePause = useCallback((id: number) => {
    const at = Date.now();
    setNow(at);
    setTimers((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        if (t.endsAt != null) return t.endsAt <= at ? t : { ...t, endsAt: null, pausedRemainingMs: t.endsAt - at };
        return { ...t, endsAt: at + t.pausedRemainingMs };
      }),
    );
  }, []);

  const remove = useCallback((id: number) => setTimers((prev) => prev.filter((t) => t.id !== id)), []);

  const remainingMs = (t: CookTimer) => (t.endsAt != null ? Math.max(0, t.endsAt - now) : t.pausedRemainingMs);
  const running = timers.some((t) => t.endsAt != null && t.endsAt > now);

  return { timers, start, togglePause, remove, remainingMs, isFinished, running, ringing, unlockAudio };
}
