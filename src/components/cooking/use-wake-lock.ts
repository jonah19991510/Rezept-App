"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

export type WakeLockStatus = "pending" | "active" | "unsupported" | "failed";

/**
 * Hält den Bildschirm an, solange `enabled` gilt (Screen Wake Lock API).
 * Der Browser gibt die Sperre beim Wechsel in einen anderen Tab frei; beim Zurückkommen wird sie neu angefordert.
 */
export function useWakeLock(enabled: boolean): WakeLockStatus {
  // Beim Server-Rendern unbekannt: „unterstützt“ annehmen, damit Server und Browser dasselbe HTML erzeugen
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => "wakeLock" in navigator,
    () => true,
  );
  const [status, setStatus] = useState<WakeLockStatus>("pending");

  useEffect(() => {
    if (!enabled || !supported) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          await sentinel.release();
          return;
        }
        setStatus("active");
      } catch {
        // z. B. Energiesparmodus oder fehlende Berechtigung
        if (!cancelled) setStatus("failed");
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void request();
    };

    void request();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release().catch(() => undefined);
    };
  }, [enabled, supported]);

  if (!supported) return "unsupported";
  return enabled ? status : "pending";
}

function noopSubscribe() {
  return () => undefined;
}
