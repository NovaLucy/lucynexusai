import { useCallback, useEffect, useRef } from "react";

const POLISH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/text-polish`;

/**
 * Returns a debounced polisher. Call polish(text) — after `delay` ms of
 * inactivity, it sends the latest text to the edge function and invokes
 * onCorrected with the result if it differs.
 */
export function usePolish(
  enabled: boolean,
  onCorrected: (corrected: string, original: string) => void,
  delay = 1500,
) {
  const tRef = useRef<number | null>(null);
  const pendingRef = useRef<string>("");
  const inflightRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    if (tRef.current) window.clearTimeout(tRef.current);
    inflightRef.current?.abort();
  }, []);

  return useCallback((text: string) => {
    if (!enabled) return;
    if (!text || text.trim().length < 4) return;
    pendingRef.current = text;
    if (tRef.current) window.clearTimeout(tRef.current);
    tRef.current = window.setTimeout(async () => {
      const original = pendingRef.current;
      inflightRef.current?.abort();
      const ctrl = new AbortController();
      inflightRef.current = ctrl;
      try {
        const r = await fetch(POLISH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text: original }),
          signal: ctrl.signal,
        });
        if (!r.ok) return;
        const j = await r.json();
        const corrected = (j?.corrected ?? "").trim();
        if (corrected && corrected !== original.trim()) {
          onCorrected(corrected, original);
        }
      } catch {}
    }, delay) as unknown as number;
  }, [enabled, onCorrected, delay]);
}
