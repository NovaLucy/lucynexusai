import { useEffect, useState } from "react";
import type { AgentState } from "./types";

interface Props {
  state: AgentState;
  micActive: boolean;
  /** Hide once the user has interacted at least once. */
  hide?: boolean;
}

/**
 * Contextual one-line hint shown softly under the orb.
 * Tells the user what they can do *right now*.
 */
export default function HintLine({ state, micActive, hide }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (hide) {
      const t = window.setTimeout(() => setVisible(false), 600);
      return () => window.clearTimeout(t);
    }
    setVisible(true);
  }, [hide]);

  if (!visible) return null;

  let text = "";
  if (micActive) text = "je t'écoute…";
  else if (state === "sleeping") text = "touche pour me réveiller";
  else if (state === "speaking" || state === "thinking") text = "";
  else text = "touche pour parler · tape pour écrire";

  if (!text) return null;

  return (
    <div
      className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-24 sm:bottom-28 z-20 select-none"
      aria-hidden
    >
      <div
        className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] text-foreground/35 font-light transition-opacity duration-700"
        style={{ opacity: hide ? 0 : 1 }}
      >
        {text}
      </div>
    </div>
  );
}
