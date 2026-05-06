export type AgentState = "standby" | "thinking" | "speaking" | "listening";
export type Mood = "calm" | "empathetic" | "focused" | "alert";

export type Role = "user" | "assistant";

export interface Message {
  id: string;
  role: Role;
  content: string;
  mood?: Mood;
  ts: number;
}

export const MOOD_HUE: Record<Mood, number> = {
  calm: 195,
  empathetic: 330,
  focused: 270,
  alert: 20,
};

export const MOOD_HSL: Record<Mood, { h: number; s: number; l: number }> = {
  calm:       { h: 195, s: 95, l: 55 },
  empathetic: { h: 330, s: 85, l: 62 },
  focused:    { h: 270, s: 90, l: 65 },
  alert:      { h: 20,  s: 95, l: 58 },
};

export const STATE_DOT: Record<AgentState, string> = {
  standby:   "#9aa3b2",
  thinking:  "#a78bfa",
  speaking:  "#6ee7ff",
  listening: "#34d399",
};

export const STATE_LABEL: Record<AgentState, string> = {
  standby:   "Standby",
  thinking:  "Réflexion",
  speaking:  "Parole",
  listening: "Écoute",
};

export const ENERGY_TARGET: Record<AgentState, number> = {
  standby: 0.30,
  thinking: 0.72,
  speaking: 1.00,
  listening: 0.50,
};
