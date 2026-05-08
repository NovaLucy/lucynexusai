import { useEffect, useRef, useState } from "react";

export type FaceFrequency = "off" | "rare" | "normal" | "often";

const RANGES: Record<Exclude<FaceFrequency, "off">, [number, number]> = {
  rare:   [60_000, 120_000],
  normal: [25_000, 60_000],
  often:  [10_000, 25_000],
};

/**
 * Random apparitions of the APN face overlay.
 * Returns whether the face should currently be visible.
 */
export function useFaceApparition(frequency: FaceFrequency = "normal", showMs = 3200) {
  const [visible, setVisible] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (frequency === "off") {
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
        timer.current = window.setTimeout(() => {
          if (!alive) return;
          setVisible(false);
          schedule();
        }, showMs);
      }, wait);
    };

    schedule();
    return () => {
      alive = false;
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [frequency, showMs]);

  return visible;
}
