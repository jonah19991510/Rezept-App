"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { beep } from "@/components/cooking/use-cook-timers";
import { locate, phaseStartMs, previousTargetMs, totalSeconds, type IntervalPhase } from "@/lib/domain/interval-timer";

/** Ton muss auf iOS durch eine Nutzeraktion freigeschaltet werden: beim Tippen auf „Start“ aufrufen. */
export function unlockAudio(audio: RefObject<AudioContext | null>) {
  if (typeof window === "undefined") return;
  if (!audio.current) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audio.current = new Ctx();
  }
  void audio.current.resume();
}

/** Kurze Töne mit der Web-Audio-API: `count` Töne gleicher Höhe hintereinander. */
function tone(ctx: AudioContext, frequency: number, count = 1, length = 0.14) {
  void ctx.resume();
  const now = ctx.currentTime;
  for (let i = 0; i < count; i++) {
    const at = now + i * (length + 0.08);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.4, at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + length + 0.02);
  }
}

/**
 * Ablauf eines Intervall-Trainings; startet beim Einbinden. Gerechnet wird mit Zeitpunkten statt mit Zählern, damit die
 * Zeit auch dann stimmt, wenn der Browser die Seite drosselt. Ton und Vibration bei jedem Phasenwechsel, kurze Töne in
 * den letzten drei Sekunden, Gong am Ende.
 */
export function useIntervalTimer(phases: IntervalPhase[], audio: RefObject<AudioContext | null>) {
  // anchor: Zeitpunkt, zu dem der Ablauf bei 0 gewesen wäre; null = pausiert, dann zählt `elapsed`
  const [clock, setClock] = useState(() => ({ anchor: Date.now() as number | null, elapsed: 0 }));
  const [now, setNow] = useState(() => Date.now());
  const elapsedMs = Math.max(0, clock.anchor != null ? now - clock.anchor : clock.elapsed);
  const { index, remainingMs, done } = locate(phases, elapsedMs);
  const running = clock.anchor != null && !done;
  const secondsLeft = Math.ceil(remainingMs / 1000);
  const lastCue = useRef({ index: -1, second: -1, done: false });

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    const last = lastCue.current;
    const ctx = audio.current;
    if (done) {
      if (last.done) return;
      last.done = true;
      if (ctx) beep(ctx);
      navigator.vibrate?.([400, 200, 400]);
      return;
    }
    last.done = false;
    if (!running) return;
    const phase = phases[index];
    if (last.index !== index) {
      last.index = index;
      last.second = secondsLeft;
      if (ctx) tone(ctx, phase.kind === "work" ? 1046 : 660, phase.kind === "work" ? 2 : 1, 0.2);
      navigator.vibrate?.(phase.kind === "work" ? [200, 100, 200] : 300);
    } else if (last.second !== secondsLeft) {
      last.second = secondsLeft;
      if (ctx && secondsLeft >= 1 && secondsLeft <= 3) tone(ctx, 880);
    }
  }, [audio, done, index, phases, running, secondsLeft]);

  const toggle = useCallback(() => {
    const t = Date.now();
    setNow(t);
    setClock((c) => (c.anchor != null ? { anchor: null, elapsed: t - c.anchor } : { anchor: t - c.elapsed, elapsed: c.elapsed }));
  }, []);

  const seek = useCallback((ms: number) => {
    const t = Date.now();
    setNow(t);
    setClock((c) => (c.anchor != null ? { anchor: t - ms, elapsed: 0 } : { anchor: null, elapsed: ms }));
  }, []);

  return {
    phase: phases[index],
    nextPhase: phases[index + 1] ?? null,
    index,
    elapsedMs,
    remainingMs,
    secondsLeft,
    remainingTotal: Math.max(0, totalSeconds(phases) - Math.floor(elapsedMs / 1000)),
    done,
    running,
    toggle,
    next: () => seek(phaseStartMs(phases, index + 1)),
    previous: () => seek(previousTargetMs(phases, elapsedMs)),
  };
}
