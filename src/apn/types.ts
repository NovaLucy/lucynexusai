export type AgentState = "standby" | "thinking" | "speaking" | "listening" | "sleeping";
export type Mood =
  | "calm"
  | "empathetic"
  | "focused"
  | "alert"
  | "tender"
  | "playful"
  | "melancholic"
  | "proud"
  | "worried";

export type Role = "user" | "assistant";

export interface Message {
  id: string;
  role: Role;
  content: string;
  mood?: Mood;
  ts: number;
  imageDataUrl?: string;
  imagePath?: string;
}

export const MOOD_HUE: Record<Mood, number> = {
  calm: 195,
  empathetic: 330,
  focused: 270,
  alert: 20,
  tender: 350,
  playful: 50,
  melancholic: 220,
  proud: 40,
  worried: 240,
};

export const MOOD_HSL: Record<Mood, { h: number; s: number; l: number }> = {
  calm:        { h: 195, s: 95, l: 55 },
  empathetic:  { h: 330, s: 85, l: 62 },
  focused:     { h: 270, s: 90, l: 65 },
  alert:       { h: 20,  s: 95, l: 58 },
  tender:      { h: 350, s: 70, l: 70 },
  playful:     { h: 50,  s: 95, l: 60 },
  melancholic: { h: 220, s: 45, l: 55 },
  proud:       { h: 40,  s: 90, l: 58 },
  worried:     { h: 240, s: 55, l: 55 },
};

export const STATE_DOT: Record<AgentState, string> = {
  standby:   "#9aa3b2",
  thinking:  "#a78bfa",
  speaking:  "#6ee7ff",
  listening: "#34d399",
  sleeping:  "#3b4252",
};

export const STATE_LABEL: Record<AgentState, string> = {
  standby:   "Standby",
  thinking:  "Réflexion",
  speaking:  "Parole",
  listening: "Écoute",
  sleeping:  "Veille",
};

export const ENERGY_TARGET: Record<AgentState, number> = {
  standby: 0.30,
  thinking: 0.72,
  speaking: 1.00,
  listening: 0.50,
  sleeping: 0.08,
};
