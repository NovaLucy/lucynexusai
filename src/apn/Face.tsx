import { useEffect, useRef, useState } from "react";
import type { AgentState, Mood } from "./types";

interface Props {
  mood: Mood;
  state?: AgentState;
  size?: "xs" | "sm" | "md" | "lg";
  blink?: boolean;
  variant?: "inline" | "overlay" | "ambient";
  speaking?: boolean;
  micro?: boolean;
  expression?: "neutral" | "wink" | "smile" | "alert";
  className?: string;
  onClick?: () => void;
}

type EyeChar = string;
type Brow = string;

interface MoodFace {
  brows: [Brow, Brow];
  eyeL: EyeChar;
  eyeR: EyeChar;
  mouth: string;
}

const MOODS: Record<Mood, MoodFace> = {
  calm:       { brows: [" ", " "], eyeL: "◉", eyeR: "◉", mouth: "◡" },
  empathetic: { brows: ["╲", "╱"], eyeL: "♥", eyeR: "♥", mouth: "◡" },
  focused:    { brows: ["╲", "╱"], eyeL: "◉", eyeR: "◉", mouth: "─" },
  alert:      { brows: ["‾", "‾"], eyeL: "⊙", eyeR: "⊙", mouth: "○" },
};

const SIZE_CLASS = {
  xs: "text-[11px] leading-[1] tracking-tight",
  sm: "text-xs leading-[1.05] tracking-tight",
  md: "text-base leading-[1.05]",
  lg: "text-2xl leading-[1.05]",
};

const MOUTH_TALK = ["─", "○", "◯", "○", "─", "▁", "▂", "▁"];
const SACCADES: Array<[EyeChar, EyeChar]> = [
  ["◉", "◉"],
  ["◐", "◉"],
  ["◉", "◑"],
  ["◔", "◔"],
  ["◉", "◉"],
];

export default function Face({
  mood,
  state,
  size = "sm",
  blink = true,
  variant = "inline",
  speaking,
  micro = true,
  expression = "neutral",
  className = "",
  onClick,
}: Props) {
  const base = MOODS[mood];
  const isSpeaking = speaking || state === "speaking";
  const isThinking = state === "thinking";
  const isListening = state === "listening";

  // Blink (with ~15% chance of single-eye wink)
  const [closedL, setClosedL] = useState(false);
  const [closedR, setClosedR] = useState(false);
  useEffect(() => {
    if (!blink) return;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      const wait = 2800 + Math.random() * 4200;
      window.setTimeout(() => {
        if (!alive) return;
        const wink = Math.random() < 0.15;
        if (wink) {
          if (Math.random() < 0.5) setClosedL(true); else setClosedR(true);
        } else {
          setClosedL(true); setClosedR(true);
        }
        window.setTimeout(() => {
          if (!alive) return;
          setClosedL(false); setClosedR(false);
          tick();
        }, 130);
      }, wait);
    };
    tick();
    return () => { alive = false; };
  }, [blink]);

  // Saccades (idle eye drift)
  const [sacc, setSacc] = useState<[EyeChar, EyeChar] | null>(null);
  useEffect(() => {
    if (!micro) return;
    if (isThinking || isSpeaking) return;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      const wait = 4000 + Math.random() * 5000;
      window.setTimeout(() => {
        if (!alive) return;
        const pick = SACCADES[Math.floor(Math.random() * SACCADES.length)];
        setSacc(pick);
        window.setTimeout(() => {
          if (!alive) return;
          setSacc(null);
          tick();
        }, 280);
      }, wait);
    };
    tick();
    return () => { alive = false; };
  }, [micro, isThinking, isSpeaking]);

  // Thinking pan
  const [thinkPhase, setThinkPhase] = useState(0);
  useEffect(() => {
    if (!isThinking) return;
    const id = window.setInterval(() => setThinkPhase((p) => (p + 1) % 2), 500);
    return () => window.clearInterval(id);
  }, [isThinking]);

  // Mouth talking cycle
  const [mouthIdx, setMouthIdx] = useState(0);
  useEffect(() => {
    if (!isSpeaking) return;
    const id = window.setInterval(() => setMouthIdx((i) => (i + 1) % MOUTH_TALK.length), 90);
    return () => window.clearInterval(id);
  }, [isSpeaking]);

  // Determine eyes
  let eyeL = base.eyeL;
  let eyeR = base.eyeR;
  if (isThinking) {
    eyeL = thinkPhase === 0 ? "◐" : "◑";
    eyeR = thinkPhase === 0 ? "◑" : "◐";
  } else if (sacc) {
    eyeL = sacc[0]; eyeR = sacc[1];
  }
  if (expression === "wink") { eyeL = "◡"; }
  if (expression === "smile") { eyeL = "^"; eyeR = "^"; }
  if (expression === "alert") { eyeL = "⊙"; eyeR = "⊙"; }
  if (closedL) eyeL = "_";
  if (closedR) eyeR = "_";

  // Mouth
  let mouth = base.mouth;
  if (isListening) mouth = "○";
  if (isSpeaking) mouth = MOUTH_TALK[mouthIdx];
  if (expression === "smile") mouth = "◡";
  if (expression === "alert") mouth = "○";

  const breathStyle = micro ? { animation: "face-breath 4.2s ease-in-out infinite" } : undefined;

  // Render — multi-line for sm/md/lg, single line for xs
  let inner: React.ReactNode;
  if (size === "xs") {
    inner = <span className="whitespace-nowrap">({eyeL}{base.eyeL === eyeL && base.eyeR === eyeR ? mouth : "."}{eyeR})</span>;
    // Simpler xs: (eye mouth eye) but use just (eyeL mouth eyeR) compact
    inner = <span className="whitespace-nowrap">({eyeL}{mouth}{eyeR})</span>;
  } else if (size === "sm") {
    inner = (
      <span className="inline-flex flex-col items-center leading-[1.05]">
        <span className="opacity-60 text-[0.8em]">{base.brows[0]} {base.brows[1]}</span>
        <span>({eyeL} {mouth} {eyeR})</span>
      </span>
    );
  } else {
    // md / lg — full ASCII art
    const w = size === "lg" ? 11 : 9;
    const dash = "─".repeat(w - 4);
    inner = (
      <span className="inline-flex flex-col items-center leading-[1.05] font-mono">
        <span className="opacity-50">╭{dash}╮</span>
        <span className="opacity-60 text-[0.85em]">│ {base.brows[0]}   {base.brows[1]} │</span>
        <span>│ {eyeL} {" "} {eyeR} │</span>
        <span className="opacity-80">│  {mouth}{mouth === "─" ? " " : ""}  │</span>
        <span className="opacity-50">╰{dash}╯</span>
      </span>
    );
  }

  const wrapperBase = `font-mono mood-text select-none ${SIZE_CLASS[size]}`;
  const interactive = onClick ? "cursor-pointer hover:opacity-80 active:scale-95 transition-transform" : "";

  if (variant === "overlay") {
    return (
      <div
        className={`pointer-events-${onClick ? "auto" : "none"} flex items-center justify-center ${interactive} ${className}`}
        onClick={onClick}
        role={onClick ? "button" : undefined}
        aria-label={onClick ? "APN" : undefined}
        style={breathStyle}
      >
        <span className={wrapperBase} style={{ filter: "drop-shadow(0 0 12px hsl(var(--mood) / 0.55))" }}>
          {inner}
        </span>
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center ${wrapperBase} ${interactive} ${className}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      aria-label={onClick ? "APN" : undefined}
      style={breathStyle}
    >
      {inner}
    </span>
  );
}
