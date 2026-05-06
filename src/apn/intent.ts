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

const GREETINGS = ["bonjour", "salut", "hello", "coucou", "hi", "hey", "yo", "bonsoir"];
const ACKS = ["ok", "okay", "merci", "super", "cool", "parfait", "génial", "top", "bien", "ouais", "oui"];

export type QuickReply = { content: string } | null;

export function quickReply(input: string): QuickReply {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase().replace(/[!?.,…]+$/g, "");

  if (GREETINGS.includes(lower)) {
    return { content: "Bonjour. Sur quoi veux-tu avancer aujourd'hui ? (objectif, problème, décision)" };
  }
  if (ACKS.includes(lower)) {
    return { content: "OK. Dis-moi ce que tu veux faire ensuite." };
  }
  const wordCount = trimmed.split(/\s+/).length;
  const hasPunct = /[?!.…]/.test(trimmed);
  if (wordCount <= 2 && !hasPunct) {
    return {
      content:
        "Je peux t'aider, mais je dois comprendre : qu'est-ce que tu veux faire exactement ?",
    };
  }
  return null;
}
