import { useEffect, useState } from "react";
import type { AgentState, Mood } from "@/apn/types";

/**
 * AGI HUD frame — angular corner brackets, rotating telemetry rings,
 * live readouts. Wraps the central core.
 */

interface Props {
  state: AgentState;
  mood: Mood;
  msgCount: number;
  topic?: string | null;
  loops?: number;
}

export default function HUDFrame({ state, mood, msgCount, topic, loops = 0 }: Props) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const hex = (n: number) => n.toString(16).toUpperCase().padStart(2, "0");
  const heartbeat = hex((tick * 13) % 256);
  const phase = hex((tick * 7 + mood.charCodeAt(0)) % 256);

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
        <div className="absolute bottom-3 right-3 text-right text-foreground/50 max-w-[60%] truncate">
          ▸ <span className="mood-text">{topic.slice(0, 32)}</span>
        </div>
      )}

      {/* Rotating outer ring (CSS) */}
      <div
        className="absolute inset-4 rounded-full border opacity-30 animate-[spin_24s_linear_infinite]"
        style={{ borderColor: "hsl(var(--mood) / 0.5)", borderStyle: "dashed" }}
      />
      <div
        className="absolute inset-10 rounded-full border opacity-20 animate-[spin_38s_linear_infinite_reverse]"
        style={{ borderColor: "hsl(var(--mood) / 0.4)" }}
      />
    </div>
  );
}
