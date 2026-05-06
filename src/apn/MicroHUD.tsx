import { STATE_DOT, STATE_LABEL, type AgentState } from "@/apn/types";

interface Props { state: AgentState; }

export default function MicroHUD({ state }: Props) {
  return (
    <div
      className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-xs uppercase tracking-widest"
      aria-live="polite"
    >
      <span
        className="inline-block h-2 w-2 rounded-full transition-colors"
        style={{ backgroundColor: STATE_DOT[state], boxShadow: `0 0 10px ${STATE_DOT[state]}` }}
      />
      <span className="text-foreground/80">{STATE_LABEL[state]}</span>
    </div>
  );
}
