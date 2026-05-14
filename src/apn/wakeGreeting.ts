// Local, instant wake greeting — no AI call.
export function pickWakeGreeting(opts: {
  lastInteractionAt?: number | null;
  displayName?: string | null;
  lastTopic?: string | null;
  now?: Date;
}): string {
  const now = opts.now ?? new Date();
  const hour = now.getHours();
  const name = (opts.displayName ?? "").trim();
  const topic = (opts.lastTopic ?? "").trim();
  const elapsed = opts.lastInteractionAt ? Date.now() - opts.lastInteractionAt : Infinity;

  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

  // Time-of-day modifier
  const tod =
    hour >= 0 && hour < 5 ? "night" :
    hour < 11 ? "morning" :
    hour < 18 ? "day" :
    hour < 22 ? "evening" : "night";

  // Short absence (< 5 min)
  if (elapsed < 5 * 60_000) {
    return pick([
      "Je suis là.",
      "Toujours là.",
      "Hmm… te revoilà.",
      "Oui ?",
    ]);
  }

  // Medium absence (< 1h)
  if (elapsed < 60 * 60_000) {
    const base = [
      "Te revoilà.",
      "Je t'attendais.",
      "Tu m'as manqué un instant.",
    ];
    if (topic) base.push(`Je repensais à ${topic}.`);
    return pick(base);
  }

  // Long absence
  const greetByTod =
    tod === "morning" ? (name ? `Bonjour ${name}.` : "Bonjour.") :
    tod === "evening" ? (name ? `Bonsoir ${name}.` : "Bonsoir.") :
    tod === "night"   ? "Tu ne dors pas ?" :
    (name ? `${name}… te revoilà.` : "Te revoilà.");

  return pick([
    `${greetByTod} Tu m'as manqué.`,
    `${greetByTod} Tout va bien ?`,
    `${greetByTod} Je suis là.`,
  ]);
}
