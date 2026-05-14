import { useEffect, useState } from "react";
import { STATE_LABEL, type AgentState, type Mood } from "@/apn/types";
import SyncIndicator from "@/apn/SyncIndicator";
import type { SyncStatus } from "@/apn/useAPN";
import { supabase } from "@/integrations/supabase/client";
import { Archive, Settings, LogOut, Stethoscope } from "lucide-react";

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

export default function TopBar({
  state, mood, name, onOpenLog, onOpenCfg, medicalMode, onToggleMedical,
  syncStatus, lastSyncAt, sessionId,
}: Props) {
  const [time, setTime] = useState(clock());
  useEffect(() => {
    const id = setInterval(() => setTime(clock()), 1000);
    return () => clearInterval(id);
  }, []);

  const iconBtn =
    "p-2 rounded-full text-foreground/40 hover:text-foreground/90 hover:bg-foreground/[0.04] transition-colors";

  return (
    <div className="dark-matter !border-0 rounded-full mx-3 sm:mx-6 mt-2 flex items-center justify-between px-4 sm:px-6 py-2.5 text-[10px] uppercase tracking-[0.3em] font-light text-drop">
      {/* Left: status */}
      <div className="flex items-center gap-3 text-foreground/40">
        <span className="hidden sm:inline">Status</span>
        <span className="flex items-center gap-2 text-foreground/70">
          <span
            className="w-1 h-1 rounded-full"
            style={{
              background: "hsl(var(--mood))",
              boxShadow: "0 0 8px hsl(var(--mood) / 0.8)",
            }}
          />
          {STATE_LABEL[state]}
        </span>
      </div>

      {/* Right: mood, time, actions */}
      <div className="flex items-center gap-3 sm:gap-6 text-foreground/40">
        <span className="hidden md:inline">
          Mood <span className="ml-2 mood-text font-normal">{mood}</span>
        </span>
        <span className="tabular-nums hidden xs:inline sm:inline normal-case tracking-normal text-xs text-foreground/50">
          {time}
        </span>

        {name && (
          <span className="hidden lg:inline text-foreground/40 normal-case tracking-normal">
            {name}
          </span>
        )}

        <SyncIndicator status={syncStatus} lastSyncAt={lastSyncAt} sessionId={sessionId} />

        {onToggleMedical && (
          <button
            onClick={onToggleMedical}
            className={`${iconBtn} ${medicalMode ? "text-red-300/90 bg-red-950/30" : ""}`}
            aria-label="Mode pré-médecin"
            title="Mode pré-médecin"
          >
            <Stethoscope className="w-3.5 h-3.5" />
          </button>
        )}
        <button onClick={onOpenLog} className={iconBtn} aria-label="Journal" title="Journal">
          <Archive className="w-3.5 h-3.5" />
        </button>
        <button onClick={onOpenCfg} className={iconBtn} aria-label="Configuration" title="Réglages">
          <Settings className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/auth";
          }}
          className={iconBtn}
          aria-label="Déconnexion"
          title="Déconnexion"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
