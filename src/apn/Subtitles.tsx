import { useEffect, useMemo, useRef, useState } from "react";

interface Props {
  /** Sentence currently being spoken by Lucy (synchronized with TTS). */
  currentSentence?: string | null;
}

/**
 * Subtitles synchronized with Lucy's voice.
 * Only renders the sentence currently being spoken — word-by-word reveal.
 * When Lucy is silent, nothing shows: only the dark-matter orb stays visible.
 */
export default function Subtitles({ currentSentence }: Props) {
  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const text = (currentSentence && currentSentence.trim()) || "";
  const words = useMemo(() => text.split(/(\s+)/), [text]);
  const [revealed, setRevealed] = useState(0);
  const keyRef = useRef("");

  useEffect(() => {
    keyRef.current = text;
    if (!text || reduced) {
      setRevealed(words.length);
      return;
    }
    setRevealed(0);
    let i = 0;
    const tick = () => {
      if (keyRef.current !== text) return;
      i += 1;
      setRevealed(i);
      if (i < words.length) window.setTimeout(tick, 38);
    };
    const id = window.setTimeout(tick, 30);
    return () => window.clearTimeout(id);
  }, [text, words.length, reduced]);

  if (!text) return null;

  return (
    <div
      className="px-6 pb-4 text-center relative z-20"
      aria-live="polite"
      aria-atomic="true"
    >
      <p
        className="font-light tracking-tight text-foreground/90 text-xl sm:text-2xl md:text-3xl leading-snug max-w-3xl mx-auto"
        style={{
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
