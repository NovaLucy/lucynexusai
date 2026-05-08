import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { SyncStatus } from "@/apn/useAPN";

interface Props {
  status: SyncStatus;
  lastSyncAt: number | null;
  sessionId: string;
}

const LABEL: Record<SyncStatus, string> = {
  idle: "IDLE",
  loading: "LOAD…",
  saving: "SAVE…",
  saved: "SYNC",
  error: "ERR",
};

const DOT: Record<SyncStatus, string> = {
  idle: "○",
  loading: "◐",
  saving: "◓",
  saved: "●",
  error: "✕",
};

function ago(ts: number | null) {
  if (!ts) return "—";
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 5) return "now";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}

export default function SyncIndicator({ status, lastSyncAt, sessionId }: Props) {
  // tick to refresh "ago"
  const [, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((v) => v + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const sid = sessionId.slice(0, 8);
  const isErr = status === "error";
  const isBusy = status === "loading" || status === "saving";

  const onTap = async () => {
    try {
      await navigator.clipboard?.writeText(sessionId);
      toast.success("Session ID copié", { description: sessionId });
    } catch {
      toast.message("Session", { description: sessionId });
    }
  };

  return (
    <button
      type="button"
      onClick={onTap}
      title={`Sync ${LABEL[status]} · last: ${ago(lastSyncAt)} · session ${sessionId}`}
      className={`bracket-btn tabular-nums gap-1 ${isErr ? "bracket-btn-rec" : ""}`}
      aria-label="Statut synchronisation"
    >
      <span className={isBusy ? "animate-spin inline-block" : ""}>{DOT[status]}</span>
      <span className="hidden sm:inline">{LABEL[status]}</span>
      <span className="text-foreground/40 hidden md:inline">·</span>
      <span className="text-foreground/60 hidden md:inline">{ago(lastSyncAt)}</span>
      <span className="text-foreground/40">·</span>
      <span className="text-foreground/70">{sid}</span>
    </button>
  );
}
