import { useEffect, useState } from "react";
import { toast } from "sonner";
import { STATE_LABEL, type AgentState, type Mood } from "@/apn/types";
import Face from "@/apn/Face";
import SyncIndicator from "@/apn/SyncIndicator";
import type { SyncStatus } from "@/apn/useAPN";

interface Props {
  state: AgentState;
  mood: Mood;
  name?: string | null;
  onOpenLog: () => void;
  onOpenCfg: () => void;
  medicalMode?: boolean;
  onToggleMedical?: () => void;
  syncStatus: SyncStatus;
  lastSyncAt: number | null;
  sessionId: string;
}

function clock() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function TopBar({ state, mood, name, onOpenLog, onOpenCfg, medicalMode, onToggleMedical, syncStatus, lastSyncAt, sessionId }: Props) {
  const [time, setTime] = useState(clock());
  useEffect(() => {
    const id = setInterval(() => setTime(clock()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="w-full flex items-center gap-2 px-2 sm:px-3 py-2 text-[11px] uppercase tracking-widest border-b ascii-border bg-black/80"
      aria-live="polite"
    >
      <span className="shrink-0 flex items-center gap-1">
        <Face
          mood={mood}
          state={state}
          size="xs"
          blink
          variant="inline"
          onClick={() =>
            toast.message(`APN · ${STATE_LABEL[state]}`, {
              description: `mood: ${mood}${name ? ` · usr: ${name}` : ""}`,
            })
          }
        />
      </span>

      <span className="text-foreground/30 flex-1 truncate hidden sm:inline">
        {"─".repeat(120)}
      </span>
      <span className="flex-1 sm:hidden" />

      <span className="text-foreground/60 hidden md:inline">
        STATE: <span className="text-foreground">{STATE_LABEL[state].toUpperCase()}</span>
      </span>
      <span className="text-foreground/30 hidden md:inline">│</span>
      <span className="text-foreground/60 hidden md:inline">
        MOOD: <span className="mood-text">{mood.toUpperCase()}</span>
      </span>
      <span className="text-foreground/30 hidden lg:inline">│</span>
      {name && (
        <>
          <span className="text-foreground/60 hidden lg:inline">
            USR: <span className="text-foreground">{name.toUpperCase()}</span>
          </span>
          <span className="text-foreground/30 hidden lg:inline">│</span>
        </>
      )}
      <span className="text-foreground/80 tabular-nums hidden xs:inline sm:inline">{time}</span>
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
      <button onClick={onOpenLog} className="bracket-btn" aria-label="Journal">[LOG]</button>
      <button onClick={onOpenCfg} className="bracket-btn" aria-label="Configuration">[CFG]</button>
    </div>
  );
}
