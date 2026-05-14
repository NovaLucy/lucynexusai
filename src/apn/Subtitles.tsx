import { useEffect, useMemo, useRef, useState } from "react";

interface Props {
  /** Sentence currently being spoken by Lucy. Null = fade out. */
  currentSentence?: string | null;
}

/**
 * Subtitles synchronized with Lucy's voice.
 * Word-by-word reveal while a sentence is active, soft fade-out when it clears.
 */
export default function Subtitles({ currentSentence }: Props) {
  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  // Hold the last non-empty sentence so we can fade it out gracefully.
  const [held, setHeld] = useState<string>("");
  const [visible, setVisible] = useState(false);
  const fadeRef = useRef<number | null>(null);

  useEffect(() => {
    const t = (currentSentence ?? "").trim();
    if (t) {
      if (fadeRef.current) {
        window.clearTimeout(fadeRef.current);
        fadeRef.current = null;
      }
      setHeld(t);
      setVisible(true);
    } else {
      setVisible(false);
      if (fadeRef.current) window.clearTimeout(fadeRef.current);
      fadeRef.current = window.setTimeout(() => setHeld(""), 900);
    }
    return () => {
      if (fadeRef.current) window.clearTimeout(fadeRef.current);
    };
  }, [currentSentence]);

  const words = useMemo(() => held.split(/(\s+)/), [held]);
  const [revealed, setRevealed] = useState(0);
  const keyRef = useRef("");

  useEffect(() => {
    keyRef.current = held;
    if (!held || reduced) {
      setRevealed(words.length);
      return;
    }
    setRevealed(0);
    let i = 0;
    const tick = () => {
      if (keyRef.current !== held) return;
      i += 1;
      setRevealed(i);
      if (i < words.length) window.setTimeout(tick, 38);
    };
    const id = window.setTimeout(tick, 30);
    return () => window.clearTimeout(id);
  }, [held, words.length, reduced]);

  if (!held) return null;

  return (
    <div
      className="px-6 pb-4 text-center relative z-20"
      aria-live="polite"
      aria-atomic="true"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(6px)",
        transition: "opacity 800ms ease, transform 800ms ease",
        filter: visible ? "blur(0)" : "blur(2px)",
      }}
    >
      <p
        className="font-light tracking-tight text-foreground/90 text-xl sm:text-2xl md:text-3xl leading-snug max-w-3xl mx-auto italic"
        style={{
          fontFamily: "'Manrope', system-ui, sans-serif",
          textShadow:
            "0 0 24px hsl(var(--mood) / 0.35), 0 1px 2px hsl(0 0% 0% / 0.6)",
          minHeight: "1.6em",
          transition: "text-shadow 400ms ease",
        }}
      >
        {words.map((w, i) => (
          <span
            key={`${i}-${w}`}
            style={{
              opacity: i < revealed ? 1 : 0,
              transform: i < revealed ? "translateY(0)" : "translateY(4px)",
              transition: "opacity 280ms ease, transform 280ms ease",
              display: "inline",
            }}
          >
            {w}
          </span>
        ))}
      </p>
      <div
        className="mt-3 h-px w-12 mx-auto"
        style={{
          background:
            "linear-gradient(90deg, transparent, hsl(var(--mood) / 0.5), transparent)",
        }}
      />
    </div>
  );
}
