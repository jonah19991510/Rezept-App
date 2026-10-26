"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { beep } from "@/components/cooking/use-cook-timers";

export type RestTimer = { endsAt: number; totalMs: number; label: string };

/**
 * Pausentimer nach einem Satz. Gerechnet wird mit dem Endzeitpunkt (stimmt auch, wenn der Browser drosselt). Am Ende
 * Ton und Vibration, einmal; der Timer bleibt kurz als „Weiter geht’s“ stehen.
 */
export function useRestTimer() {
  const [timer, setTimer] = useState<RestTimer | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const audio = useRef<AudioContext | null>(null);
  const rung = useRef<number | null>(null);

  // Ton muss auf iOS durch eine Nutzeraktion freigeschaltet werden: beim ersten Start
  const unlockAudio = useCallback(() => {
    if (audio.current || typeof window === "undefined") return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audio.current = new Ctx();
    void audio.current.resume();
  }, []);

  useEffect(() => {
    if (!timer) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [timer]);

  const remainingMs = timer ? timer.endsAt - now : 0;
  const finished = timer != null && remainingMs <= 0;

  useEffect(() => {
    if (!finished || !timer || rung.current === timer.endsAt) return;
    rung.current = timer.endsAt;
    if (audio.current) beep(audio.current);
    navigator.vibrate?.([300, 150, 300]);
    // Nach 10 s ohne Reaktion ausblenden
    const id = window.setTimeout(() => setTimer((t) => (t?.endsAt === timer.endsAt ? null : t)), 10_000);
    return () => window.clearTimeout(id);
  }, [finished, timer]);

  const start = useCallback(
    (seconds: number, label: string) => {
      unlockAudio();
      const t = Date.now();
      setNow(t);
      setTimer({ endsAt: t + seconds * 1000, totalMs: seconds * 1000, label });
    },
    [unlockAudio],
  );

  const add = useCallback((seconds: number) => {
    setTimer((t) => (t ? { ...t, endsAt: Math.max(Date.now(), t.endsAt) + seconds * 1000, totalMs: Math.max(1000, t.totalMs + seconds * 1000) } : t));
  }, []);

  const stop = useCallback(() => setTimer(null), []);

  return { timer, remainingMs: Math.max(0, remainingMs), finished, start, add, stop };
}
