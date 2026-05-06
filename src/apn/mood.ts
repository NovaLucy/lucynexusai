import { MOOD_HSL, type Mood } from "./types";

export function applyMoodToRoot(mood: Mood) {
  const { h, s, l } = MOOD_HSL[mood];
  const root = document.documentElement;
  root.style.setProperty("--mood-h", String(h));
  root.style.setProperty("--mood-s", `${s}%`);
  root.style.setProperty("--mood-l", `${l}%`);
}
