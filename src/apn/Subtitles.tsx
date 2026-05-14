import { useEffect, useMemo, useRef, useState } from "react";

interface Props {
  /** Full assistant text being streamed (used as live caption while voice catches up). */
  streamingText?: string;
  /** Sentence currently being spoken by Lucy (synchronized with TTS). */
  currentSentence?: string | null;
  /** Fallback caption when Lucy is silent. */
  idleCaption?: string;
  /** True while Lucy is producing speech. */
  speaking?: boolean;
}

/**
 * Subtitles synchronized with Lucy's voice.
 * - When a sentence is being spoken, reveals it word-by-word.
 * - Otherwise shows the live streaming text or the idle caption.
 */
export default function Subtitles({
  streamingText,
  currentSentence,
  idleCaption,
  speaking,
}: Props) {
  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const text =
    (currentSentence && currentSentence.trim()) ||
    (speaking && streamingText && streamingText.trim()) ||
    idleCaption ||
    "";

  // Word-by-word reveal for the *current sentence*
  const words = useMemo(() => text.split(/(\s+)/), [text]);
  const [revealed, setRevealed] = useState(0);
  const keyRef = useRef("");

  useEffect(() => {
    keyRef.current = text;
    if (!currentSentence || reduced) {
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
  }, [text, words.length, currentSentence, reduced]);

  const isLive = !!currentSentence;

  return (
    <div
      className="px-6 pb-4 text-center relative z-20"
      aria-live="polite"
      aria-atomic="true"
    >
      <p
        className="font-light tracking-tight text-foreground/90 text-xl sm:text-2xl md:text-3xl leading-snug max-w-3xl mx-auto"
        style={{
          textShadow: isLive
            ? "0 0 24px hsl(var(--mood) / 0.35), 0 1px 2px hsl(0 0% 0% / 0.6)"
            : "0 1px 2px hsl(0 0% 0% / 0.5)",
          minHeight: "1.6em",
          transition: "text-shadow 400ms ease",
        }}
      >
        {isLive
          ? words.map((w, i) => (
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
            ))
          : text}
        {speaking && !isLive && (
          <span
            className="inline-block ml-1 w-[2px] h-[1em] align-[-0.15em]"
            style={{
              background: "hsl(var(--mood) / 0.7)",
              animation: "subtitle-cursor 1s steps(2) infinite",
            }}
            aria-hidden
          />
        )}
      </p>
      <div
        className="mt-3 h-px w-12 mx-auto"
        style={{
          background:
            "linear-gradient(90deg, transparent, hsl(var(--mood) / 0.5), transparent)",
        }}
      />
      <style>{`
        @keyframes subtitle-cursor { 0%,100% { opacity: 1 } 50% { opacity: 0 } }
      `}</style>
    </div>
  );
}
