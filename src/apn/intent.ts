import type { Mood } from "./types";

export function inferMood(text: string): Mood {
  const s = text.toLowerCase();

  // Alerte d'abord — priorité haute
  const exclam = s.match(/!/g)?.length ?? 0;
  if (
    ["urgent", "immédiat", "attention", "alerte", "danger", "risque", "critique"]
      .some((w) => s.includes(w)) || exclam >= 3
  ) return "alert";

  // Inquiétude (sans urgence)
  if (
    ["inquiet", "j'ai peur", "ça m'angoisse", "anxieux", "anxieuse", "stressé", "stressée"]
      .some((w) => s.includes(w))
  ) return "worried";

  // Tendresse
  if (
    ["je t'aime", "tendresse", "câlin", "doux", "douce", "chéri", "chérie", "tendre"]
      .some((w) => s.includes(w))
  ) return "tender";

  // Empathie
  if (
    ["désolé", "je comprends", "courage", "je suis là", "ça va aller", "navré"]
      .some((w) => s.includes(w))
  ) return "empathetic";

  // Mélancolie
  if (
    ["triste", "seul", "vide", "fatigué", "épuisé", "déçu", "manque", "regret"]
      .some((w) => s.includes(w))
  ) return "melancholic";

  // Fierté
  if (
    ["bravo", "fier", "fière", "réussi", "j'ai gagné", "génial pour toi", "félicitations"]
      .some((w) => s.includes(w))
  ) return "proud";

  // Légèreté
  if (
    [" haha", "lol", "mdr", " ptdr", "drôle", "rigolo", "amusant", "😂", "😄"]
      .some((w) => s.includes(w)) || exclam === 1
  ) return "playful";

  // Long → focus
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
