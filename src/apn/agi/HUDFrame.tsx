import { useEffect, useState } from "react";
import type { AgentState, Mood } from "@/apn/types";

/**
 * AGI HUD frame — angular brackets, rotating telemetry rings, live readouts,
 * and a faux-live waveform. Glows brighter when APN speaks.
 */

interface Props {
  state: AgentState;
  mood: Mood;
  msgCount: number;
  topic?: string | null;
  loops?: number;
}

const WAVE_POINTS = 64;

export default function HUDFrame({ state, mood, msgCount, topic, loops = 0 }: Props) {
  const [tick, setTick] = useState(0);
  const [wave, setWave] = useState<number[]>(() => Array(WAVE_POINTS).fill(0));

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const loop = () => {
      const t = (performance.now() - t0) / 1000;
      const amp =
        state === "speaking" ? 0.85 : state === "thinking" ? 0.5 : state === "listening" ? 0.4 : 0.18;
      const speed = state === "speaking" ? 4.5 : state === "thinking" ? 2.2 : 1.0;
      const next = new Array(WAVE_POINTS);
      for (let i = 0; i < WAVE_POINTS; i++) {
        const x = i / WAVE_POINTS;
        const v =
          Math.sin(t * speed + x * 8) * 0.5 +
          Math.sin(t * speed * 1.7 + x * 14) * 0.3 +
          Math.sin(t * speed * 0.4 + x * 3) * 0.2;
        next[i] = v * amp;
      }
      setWave(next);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  const hex = (n: number) => n.toString(16).toUpperCase().padStart(2, "0");
  const heartbeat = hex((tick * 13) % 256);
  const phase = hex((tick * 7 + mood.charCodeAt(0)) % 256);
  const speaking = state === "speaking";

  // Build waveform path
  const wavePath = (() => {
    const w = 100, h = 18, mid = h / 2;
    return wave
      .map((v, i) => {
        const x = (i / (WAVE_POINTS - 1)) * w;
        const y = mid + v * (h / 2 - 1);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(2)}`;
      })
      .join(" ");
  })();

  const ringStyle = (op: number): React.CSSProperties =>
    speaking
      ? {
          borderColor: "hsl(var(--mood) / " + (op + 0.25) + ")",
          boxShadow: "0 0 30px hsl(var(--mood) / 0.35) inset, 0 0 40px hsl(var(--mood) / 0.25)",
        }
      : { borderColor: `hsl(var(--mood) / ${op})` };

  return (
    <div className="absolute inset-0 pointer-events-none font-mono text-[9px] uppercase tracking-[0.18em]">
      {/* Corner brackets */}
      <div className="absolute top-0 left-0 w-8 h-8 border-l border-t" style={{ borderColor: "hsl(var(--mood) / 0.6)" }} />
      <div className="absolute top-0 right-0 w-8 h-8 border-r border-t" style={{ borderColor: "hsl(var(--mood) / 0.6)" }} />
      <div className="absolute bottom-0 left-0 w-8 h-8 border-l border-b" style={{ borderColor: "hsl(var(--mood) / 0.6)" }} />
      <div className="absolute bottom-0 right-0 w-8 h-8 border-r border-b" style={{ borderColor: "hsl(var(--mood) / 0.6)" }} />

      {/* Top center label */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 mood-text">
        ◇ APN.CORE / {state.toUpperCase()} ◇
      </div>

      {/* Top-left telemetry */}
      <div className="absolute top-3 left-3 space-y-0.5 text-foreground/55">
        <div>SYS <span className="mood-text">{state.slice(0, 3).toUpperCase()}</span></div>
        <div>HRT <span className="mood-text tabular-nums">{heartbeat}</span></div>
        <div>PHS <span className="mood-text tabular-nums">{phase}</span></div>
      </div>

      {/* Top-right telemetry */}
      <div className="absolute top-3 right-3 space-y-0.5 text-right text-foreground/55">
        <div>MSG <span className="mood-text tabular-nums">{String(msgCount).padStart(4, "0")}</span></div>
        <div>LPS <span className="mood-text tabular-nums">{String(loops).padStart(2, "0")}</span></div>
        <div>MOOD <span className="mood-text">{mood.slice(0, 4).toUpperCase()}</span></div>
      </div>

      {/* Bottom-left tickline */}
      <div className="absolute bottom-3 left-3 text-foreground/50">
        ░▒▓ NEURAL.LINK <span className="mood-text">ACTIVE</span>
      </div>

      {/* Bottom-right topic */}
      {topic && (
        <div className="absolute bottom-12 right-3 text-right text-foreground/50 max-w-[60%] truncate">
          ▸ <span className="mood-text">{topic.slice(0, 32)}</span>
        </div>
      )}

      {/* Bottom waveform — faux-live */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[42%] max-w-[260px] h-[18px] opacity-80">
        <svg viewBox="0 0 100 18" preserveAspectRatio="none" className="w-full h-full">
          <path
            d={wavePath}
            fill="none"
            stroke="hsl(var(--mood))"
            strokeWidth={speaking ? 0.8 : 0.5}
            strokeLinecap="round"
            style={{ filter: speaking ? "drop-shadow(0 0 2px hsl(var(--mood)))" : "none" }}
          />
        </svg>
      </div>

      {/* Rotating outer ring */}
      <div
        className="absolute inset-4 rounded-full border opacity-40 animate-[spin_24s_linear_infinite]"
        style={{ ...ringStyle(0.5), borderStyle: speaking ? "solid" : "dashed" }}
      />
      <div
        className="absolute inset-10 rounded-full border opacity-25 animate-[spin_38s_linear_infinite_reverse]"
        style={ringStyle(0.4)}
      />
    </div>
  );
}
