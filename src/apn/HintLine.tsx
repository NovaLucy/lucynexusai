import type { AgentState } from "./types";

interface Props {
  state: AgentState;
  micActive: boolean;
  /** Hide once the user has interacted at least once. */
  hide?: boolean;
  /** Fenêtre de tour de parole ouverte (auto-listen passif). */
  turnTakingActive?: boolean;
  /** Lucy parle en ce moment — l'utilisateur peut l'interrompre. */
  speaking?: boolean;
}

/**
 * Contextual one-line hint shown softly under the orb.
 * Tells the user what they can do *right now*.
 */
export default function HintLine({ state, micActive, hide, turnTakingActive, speaking }: Props) {
  // Indice toujours visible — il s'efface en douceur seulement quand le composer
  // est ouvert (les actions sont alors évidentes via l'input bar).
  let text = "";
  if (speaking) text = "parle, je m'arrête";
  else if (micActive) text = "je t'écoute…";
  else if (turnTakingActive) text = "je t'écoute encore…";
  else if (state === "sleeping") text = "touche l'orbe ou dis « Lucy »";
  else if (state === "speaking" || state === "thinking") text = "";
  else text = "touche l'orbe pour parler · maintiens pour push-to-talk";

  if (!text) return null;

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 bottom-20 sm:bottom-28 z-20 select-none flex justify-center px-16"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-hidden
    >
      <div
        className="hud-label transition-opacity duration-700 text-center max-w-full"
        style={{ opacity: hide ? 0 : 1 }}
      >
        {text}
      </div>
    </div>
  );
}
