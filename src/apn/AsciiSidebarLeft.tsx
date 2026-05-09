import { useEffect, useRef, useState } from "react";
import { ENERGY_TARGET, type AgentState } from "@/apn/types";

interface Props { state: AgentState; }

const BARS = 18;

export default function AsciiSidebarLeft({ state }: Props) {
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0));
  const lvlRef = useRef<number[]>(Array(BARS).fill(0));

  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      const target = ENERGY_TARGET[state];
      const next = new Array(BARS);
      for (let i = 0; i < BARS; i++) {
        const wob = 0.5 + 0.5 * Math.sin(t * (1.5 + i * 0.31) + i * 0.7);
        const v = state === "standby" ? wob * 0.18 : target * (0.4 + 0.6 * wob);
        next[i] = lvlRef.current[i] + (v - lvlRef.current[i]) * 0.25;
      }
      lvlRef.current = next;
      setLevels(next.slice());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  const renderBar = (v: number) => {
    const filled = Math.round(v * 10);
    const blocks = "▓".repeat(filled) + "░".repeat(10 - filled);
    return blocks;
  };

  return (
    <aside
      className="hidden md:flex flex-col gap-0.5 py-3 px-2 text-[10px] leading-[14px] h-full pointer-events-auto"
      style={{
        width: 88,
        background: "linear-gradient(to right, hsl(0 0% 0% / 0.78) 0%, hsl(0 0% 0% / 0.35) 65%, transparent 100%)",
      }}
      aria-hidden
    >
      <div className="text-foreground/40 uppercase tracking-widest mb-2">── AUDIO ──</div>
      {levels.map((v, i) => (
        <div key={i} className="flex items-center gap-1">
          <span className="text-foreground/30 w-3 text-right tabular-nums">{i.toString(16).toUpperCase()}</span>
          <span className="mood-text font-mono">{renderBar(v)}</span>
        </div>
      ))}
      <div className="mt-3 text-foreground/40 uppercase tracking-widest">── ENV ──</div>
      <div className="text-foreground/60">SR: 48k</div>
      <div className="text-foreground/60">CH: 02</div>
      <div className="text-foreground/60">BD: 16</div>
    </aside>
  );
}
