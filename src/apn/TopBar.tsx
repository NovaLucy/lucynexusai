import { useEffect, useState } from "react";
import { STATE_LABEL, type AgentState, type Mood } from "@/apn/types";

interface Props {
  state: AgentState;
  mood: Mood;
  name?: string | null;
  onOpenLog: () => void;
  onOpenCfg: () => void;
  medicalMode?: boolean;
  onToggleMedical?: () => void;
}

function clock() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function TopBar({ state, mood, name, onOpenLog, onOpenCfg, medicalMode, onToggleMedical }: Props) {
  const [time, setTime] = useState(clock());
  useEffect(() => {
    const id = setInterval(() => setTime(clock()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="w-full flex items-center gap-3 px-3 py-2 text-[11px] uppercase tracking-widest border-b ascii-border bg-black/80"
      style={{ height: 36 }}
      aria-live="polite"
    >
      <span className="mood-text font-medium">[APN]</span>
      <span className="text-foreground/30 flex-1 truncate">
        {"─".repeat(120)}
      </span>
      <span className="text-foreground/60 hidden sm:inline">
        STATE: <span className="text-foreground">{STATE_LABEL[state].toUpperCase()}</span>
      </span>
      <span className="text-foreground/30 hidden sm:inline">│</span>
      <span className="text-foreground/60 hidden sm:inline">
        MOOD: <span className="mood-text">{mood.toUpperCase()}</span>
      </span>
      <span className="text-foreground/30 hidden md:inline">│</span>
      {name && (
        <>
          <span className="text-foreground/60 hidden md:inline">
            USR: <span className="text-foreground">{name.toUpperCase()}</span>
          </span>
          <span className="text-foreground/30 hidden md:inline">│</span>
        </>
      )}
      <span className="text-foreground/80 tabular-nums">{time}</span>
      {onToggleMedical && (
        <button
          onClick={onToggleMedical}
          className={`bracket-btn ${medicalMode ? "bracket-btn-rec" : ""}`}
          aria-label="Mode pré-médecin"
          title="Mode pré-médecin"
        >
          [MED]
        </button>
      )}
      <button onClick={onOpenLog} className="bracket-btn">[LOG]</button>
      <button onClick={onOpenCfg} className="bracket-btn">[CFG]</button>
    </div>
  );
}
