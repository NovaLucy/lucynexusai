import { useCallback, useEffect, useRef, useState } from "react";

export type FaceFrequency = "off" | "rare" | "normal" | "often";
export type FaceMode = "ambient" | "reveal";
export type FacePhase = "in" | "hold" | "out";

const RANGES: Record<Exclude<FaceFrequency, "off">, [number, number]> = {
  rare:   [60_000, 120_000],
  normal: [25_000, 60_000],
  often:  [10_000, 25_000],
};

interface Options {
  pinned?: boolean;
  showMs?: number;
}

const VANISH_MS = 420;

export function useFaceApparition(
  frequency: FaceFrequency = "normal",
  options: Options = {},
) {
  const { pinned = false, showMs = 3200 } = options;
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<FaceMode>("ambient");
  const [phase, setPhase] = useState<FacePhase>("hold");
  const timer = useRef<number | null>(null);
  const hide = useRef<number | null>(null);
  const out = useRef<number | null>(null);

  const clearTimers = () => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    if (hide.current) { window.clearTimeout(hide.current); hide.current = null; }
    if (out.current) { window.clearTimeout(out.current); out.current = null; }
  };

  const beginShow = (ms: number, m: FaceMode) => {
    clearTimers();
    setMode(m);
    setPhase("in");
    setVisible(true);
    // After flash-in, settle into hold
    window.setTimeout(() => setPhase("hold"), 220);
    // Schedule vanish phase
    hide.current = window.setTimeout(() => {
      setPhase("out");
      out.current = window.setTimeout(() => setVisible(false), VANISH_MS);
    }, Math.max(600, ms - VANISH_MS));
  };

  const trigger = useCallback((ms = 3200, m: FaceMode = "reveal") => {
    beginShow(ms, m);
  }, []);

  useEffect(() => {
    if (pinned) {
      clearTimers();
      setMode("reveal");
      setPhase("in");
      setVisible(true);
      window.setTimeout(() => setPhase("hold"), 220);
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
        setMode("ambient");
        setPhase("in");
        setVisible(true);
        window.setTimeout(() => alive && setPhase("hold"), 220);
        hide.current = window.setTimeout(() => {
          if (!alive) return;
          setPhase("out");
          out.current = window.setTimeout(() => {
            if (!alive) return;
            setVisible(false);
            schedule();
          }, VANISH_MS);
        }, Math.max(600, showMs - VANISH_MS));
      }, wait);
    };
    schedule();
    return () => { alive = false; clearTimers(); };
  }, [frequency, showMs, pinned]);

  return { visible, mode, phase, trigger };
}
