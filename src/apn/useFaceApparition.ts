import { useCallback, useEffect, useRef, useState } from "react";

export type FaceFrequency = "off" | "rare" | "normal" | "often";

const RANGES: Record<Exclude<FaceFrequency, "off">, [number, number]> = {
  rare:   [60_000, 120_000],
  normal: [25_000, 60_000],
  often:  [10_000, 25_000],
};

interface Options {
  /** Force the face visible (e.g. while assistant is speaking long enough). */
  pinned?: boolean;
  /** How long a one-shot apparition lasts. */
  showMs?: number;
}

/**
 * Random apparitions of the APN face overlay.
 * Returns visibility + a `trigger()` to force an immediate apparition (e.g. on orb tap).
 */
export function useFaceApparition(
  frequency: FaceFrequency = "normal",
  options: Options = {},
) {
  const { pinned = false, showMs = 3200 } = options;
  const [visible, setVisible] = useState(false);
  const timer = useRef<number | null>(null);
  const hide = useRef<number | null>(null);

  const clearTimers = () => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    if (hide.current) { window.clearTimeout(hide.current); hide.current = null; }
  };

  const trigger = useCallback((ms = showMs) => {
    clearTimers();
    setVisible(true);
    hide.current = window.setTimeout(() => setVisible(false), ms);
  }, [showMs]);

  useEffect(() => {
    if (pinned) {
      clearTimers();
      setVisible(true);
      return;
    }
    if (frequency === "off") {
      clearTimers();
      setVisible(false);
      return;
    }
    let alive = true;
    const schedule = () => {
      const [min, max] = RANGES[frequency];
      const wait = min + Math.random() * (max - min);
      timer.current = window.setTimeout(() => {
        if (!alive) return;
        setVisible(true);
        hide.current = window.setTimeout(() => {
          if (!alive) return;
          setVisible(false);
          schedule();
        }, showMs);
      }, wait);
    };
    schedule();
    return () => { alive = false; clearTimers(); };
  }, [frequency, showMs, pinned]);

  return { visible, trigger };
}
