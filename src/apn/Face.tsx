import { useEffect, useState } from "react";
import type { AgentState, Mood } from "./types";

interface Props {
  mood: Mood;
  state?: AgentState;
  size?: "xs" | "sm" | "md" | "lg";
  blink?: boolean;
  variant?: "inline" | "overlay" | "ambient";
  className?: string;
}

// Eye + mouth catalog per mood. Kept ASCII-only / pure unicode for terminal vibe.
const FACES: Record<Mood, { eyes: string; mouth: string }> = {
  calm:       { eyes: "◉ ◡ ◉", mouth: "◡" },
  empathetic: { eyes: "♡ ◡ ♡", mouth: "◡" },
  focused:    { eyes: "◉ ─ ◉", mouth: "─" },
  alert:      { eyes: "⊙ _ ⊙", mouth: "o" },
};

const STATE_OVERRIDE: Partial<Record<AgentState, { eyes: string; mouth?: string }>> = {
  thinking:  { eyes: "◐ . ◑" },
  speaking:  { eyes: "◉ ◡ ◉", mouth: "◡" },
  listening: { eyes: "◉ ◡ ◉", mouth: "○" },
};

const SIZES = {
  xs: "text-[10px] leading-none tracking-tight",
  sm: "text-xs leading-tight",
  md: "text-base leading-tight",
  lg: "text-2xl leading-tight",
};

export default function Face({
  mood,
  state,
  size = "sm",
  blink = true,
  variant = "inline",
  className = "",
}: Props) {
  const [closed, setClosed] = useState(false);
  const [thinkPhase, setThinkPhase] = useState(0);

  // Blink loop
  useEffect(() => {
    if (!blink) return;
    let alive = true;
    const loop = () => {
      if (!alive) return;
      const next = 3000 + Math.random() * 4000;
      window.setTimeout(() => {
        if (!alive) return;
        setClosed(true);
        window.setTimeout(() => {
          setClosed(false);
          loop();
        }, 130);
      }, next);
    };
    loop();
    return () => { alive = false; };
  }, [blink]);

  // Thinking eye pan
  useEffect(() => {
    if (state !== "thinking") return;
    const id = window.setInterval(() => setThinkPhase((p) => (p + 1) % 2), 600);
    return () => window.clearInterval(id);
  }, [state]);

  const base = FACES[mood];
  const override = state ? STATE_OVERRIDE[state] : undefined;
  let eyes = override?.eyes ?? base.eyes;
  const mouth = override?.mouth ?? base.mouth;

  if (state === "thinking") {
    eyes = thinkPhase === 0 ? "◐ . ◑" : "◑ . ◐";
  }
  if (closed) {
    eyes = "_ . _";
  }

  const inner = (
    <span className={`font-mono mood-text select-none whitespace-nowrap ${SIZES[size]}`}>
      ( {eyes} )
      {variant !== "inline" && (
        <>
          <br />
          <span className="opacity-70">{"  "}{mouth}{"  "}</span>
        </>
      )}
    </span>
  );

  if (variant === "overlay") {
    return (
      <div className={`pointer-events-none flex flex-col items-center justify-center ${className}`}>
        {inner}
      </div>
    );
  }
  return <span className={`inline-flex items-center ${className}`}>{inner}</span>;
}
