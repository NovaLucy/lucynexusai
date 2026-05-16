import { useEffect, useRef } from "react";

/**
 * useWakeWord — écoute passive et continue d'un mot-clé ("lucy", "lucie"…).
 *
 * S'appuie sur le Web Speech API (SpeechRecognition) — gratuit, local au navigateur,
 * faible empreinte. Tourne uniquement quand `enabled` est vrai (en veille typiquement),
 * et appelle `onWake(matched)` dès qu'un des patterns est détecté.
 *
 * Patterns par défaut : variantes phonétiques de "Lucy".
 * Ne tourne pas en natif Capacitor (utiliser un wake-word natif si besoin plus tard).
 */

const DEFAULT_PATTERNS = [
  /\bluc(y|ie|i|ille)\b/i,
  /\bluce\b/i,
  /\bloocy\b/i,
  /\bhey\s+luc(y|ie)\b/i,
  /\b(ok|okay|ohé|hé|eh)\s+luc(y|ie)\b/i,
];

type Options = {
  enabled: boolean;
  onWake: (matchedText: string) => void;
  patterns?: RegExp[];
  /** ms de cool-down entre deux déclenchements pour éviter les rebonds */
  cooldownMs?: number;
  /** Quand Lucy parle, on suspend l'écoute du wake-word (évite l'auto-déclenchement). */
  muteWhileSpeaking?: boolean;
};

export function useWakeWord({ enabled, onWake, patterns, cooldownMs = 2200, muteWhileSpeaking = false }: Options) {
  const recRef = useRef<any>(null);
  const lastFireRef = useRef<number>(0);
  const restartTimerRef = useRef<number | null>(null);
  const onWakeRef = useRef(onWake);
  const patternsRef = useRef(patterns ?? DEFAULT_PATTERNS);

  useEffect(() => { onWakeRef.current = onWake; }, [onWake]);
  useEffect(() => { patternsRef.current = patterns ?? DEFAULT_PATTERNS; }, [patterns]);

  useEffect(() => {
    if (!enabled) return;
    const SR: any =
      (typeof window !== "undefined" &&
        ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
    if (!SR) return; // pas supporté (Firefox, certains mobiles) — silencieux

    let stopped = false;

    const start = () => {
      if (stopped) return;
      try {
        const r = new SR();
        r.lang = "fr-FR";
        r.continuous = true;
        r.interimResults = true;
        r.maxAlternatives = 1;

        r.onresult = (ev: any) => {
          const now = Date.now();
          if (now - lastFireRef.current < cooldownMs) return;
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            const transcript = (ev.results[i][0]?.transcript ?? "").toLowerCase();
            if (!transcript) continue;
            for (const p of patternsRef.current) {
              if (p.test(transcript)) {
                lastFireRef.current = now;
                try { r.stop(); } catch {}
                onWakeRef.current(transcript.trim());
                return;
              }
            }
          }
        };

        r.onerror = (e: any) => {
          // "no-speech" / "aborted" → on relance simplement
          if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
            stopped = true;
            return;
          }
        };

        r.onend = () => {
          if (stopped) return;
          // relance avec un petit délai pour respirer (et respecter cool-down)
          restartTimerRef.current = window.setTimeout(start, 600);
        };

        r.start();
        recRef.current = r;
      } catch (e) {
        // souvent : "already started" — ignore
      }
    };

    start();

    return () => {
      stopped = true;
      if (restartTimerRef.current != null) {
        window.clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      try { recRef.current?.stop(); } catch {}
      try { recRef.current?.abort?.(); } catch {}
      recRef.current = null;
    };
  }, [enabled, cooldownMs]);
}
