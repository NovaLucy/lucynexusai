import type { Mood } from "./types";

export function inferMood(text: string): Mood {
  const s = text.toLowerCase();
  if (
    ["désolé", "je comprends", "courage", "je suis là", "ça va aller", "navré", "tendresse"]
      .some((w) => s.includes(w))
  ) return "empathetic";
  const exclam = s.match(/!/g)?.length ?? 0;
  if (
    ["urgent", "immédiat", "attention", "alerte", "danger", "risque", "critique"]
      .some((w) => s.includes(w)) || exclam >= 2
  ) return "alert";
  if (text.length > 260) return "focused";
  return "calm";
}

export type QuickReply = { content: string } | null;

// On laisse le LLM gérer les salutations et acquittements pour qu'APN réponde
// avec naturel, variété et contexte. Les "quick replies" rigides cassaient
// l'illusion de présence humaine.
export function quickReply(_input: string): QuickReply {
  return null;
}
