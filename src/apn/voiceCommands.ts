// Voice command parser — match user text to UI actions.
// Returns null if no command matched.

export type CommandAction =
  | { type: "medical"; value: boolean }
  | { type: "openLog" }
  | { type: "openCfg" }
  | { type: "voice"; value: boolean }
  | { type: "polish"; value: boolean }
  | { type: "report" }
  | { type: "wakeWord"; value: boolean }
  | { type: "rateDelta"; value: number }   // +/- 0.1 etc
  | { type: "pitchDelta"; value: number }
  | { type: "stopSpeaking" }
  | { type: "repeat" }
  | { type: "shorter" }
  | { type: "clearChat" }
  | { type: "turnTaking"; value: boolean };

export interface MatchedCommand {
  action: CommandAction;
  label: string;
  /** Petit mot prononcé en confirmation (1-2 syllabes idéalement). */
  ack?: string;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,!?;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function matchCommand(input: string): MatchedCommand | null {
  const t = norm(input);
  if (!t) return null;
  const s = t.replace(/^(apn|hey apn|ok apn|lucy|lucie|hey lucy|ok lucy)\s*/i, "");

  // Stop / silence immédiat
  if (/^(tais\s*toi|chut|silence|stop|arrete|arrete\s+toi)\b/.test(s) ||
      /(coupe|stop)\s+(ta\s+)?voix/.test(s))
    return { action: { type: "stopSpeaking" }, label: "Silence", ack: "ok" };

  // Voix on/off
  if (/(coupe|desactive|enleve|mute).*(voix|son)|parle\s+plus|parle\s+pas/.test(s))
    return { action: { type: "voice", value: false }, label: "Voix coupée", ack: "ok" };
  if (/(active|remets|allume|reprends|remet).*(voix|son)|parle\s*moi|reparle/.test(s))
    return { action: { type: "voice", value: true }, label: "Voix activée", ack: "voilà" };

  // Vitesse / pitch
  if (/parle.*(plus\s+lent|lentement|moins\s+vite)|ralenti/.test(s))
    return { action: { type: "rateDelta", value: -0.1 }, label: "Plus lent", ack: "ok" };
  if (/parle.*(plus\s+vite|rapide)|accelere/.test(s))
    return { action: { type: "rateDelta", value: 0.1 }, label: "Plus rapide", ack: "ok" };
  if (/(voix|ton).*(plus\s+grave|plus\s+bas)|baisse.*(ton|pitch)/.test(s))
    return { action: { type: "pitchDelta", value: -0.1 }, label: "Voix plus grave", ack: "ok" };
  if (/(voix|ton).*(plus\s+aigu|plus\s+haut)|monte.*(ton|pitch)/.test(s))
    return { action: { type: "pitchDelta", value: 0.1 }, label: "Voix plus aiguë", ack: "ok" };

  // Répéter / plus court
  if (/^(repete|redis|recommence)\b/.test(s))
    return { action: { type: "repeat" }, label: "Je répète", ack: "voilà" };
  if (/(plus\s+court|abrege|abrege\s+toi|fais\s+court|sois\s+brève|sois\s+bref)/.test(s))
    return { action: { type: "shorter" }, label: "Plus court", ack: "ok" };

  // Wake-word
  if (/(arrete|coupe|desactive).*(ecout|wake|mot\s+cle)|n['e]\s*ecoute\s+plus/.test(s))
    return { action: { type: "wakeWord", value: false }, label: "Wake-word désactivé", ack: "ok" };
  if (/(active|allume|reactive).*(ecout|wake|mot\s+cle)|ecoute\s+(en\s+)?continu|reste\s+a\s+l['e]coute/.test(s))
    return { action: { type: "wakeWord", value: true }, label: "Wake-word activé", ack: "voilà" };

  // Mode médecin
  if (/(stop|coupe|desactive|quitte|arrete).*(mode\s+)?(med|medecin|medical|sante)/.test(s))
    return { action: { type: "medical", value: false }, label: "Mode médecin désactivé", ack: "ok" };
  if (/(active|lance|passe|ouvre|mode)\s+(en\s+)?(mode\s+)?(med|medecin|medical|sante)/.test(s) ||
      /\b(mode\s+)(med|medecin|medical|sante)\b/.test(s))
    return { action: { type: "medical", value: true }, label: "Mode médecin activé", ack: "voilà" };

  // Polish / correction
  if (/(desactive|coupe|stop).*(correction|polish)/.test(s))
    return { action: { type: "polish", value: false }, label: "Correction désactivée", ack: "ok" };
  if (/(active|lance|allume).*(correction|polish)/.test(s))
    return { action: { type: "polish", value: true }, label: "Correction activée", ack: "ok" };

  // Journal / log
  if (/(ouvre|montre|affiche).*(journal|historique|log|conversation)/.test(s))
    return { action: { type: "openLog" }, label: "Journal ouvert", ack: "voilà" };
  if (/(efface|vide|supprime|nettoie).*(conversation|chat|historique|memoire)/.test(s))
    return { action: { type: "clearChat" }, label: "Conversation effacée", ack: "ok" };

  // Réglages / config
  if (/(ouvre|montre|affiche).*(reglage|parametre|config|option)/.test(s))
    return { action: { type: "openCfg" }, label: "Réglages ouverts", ack: "voilà" };

  // Compte-rendu médical
  if (/(ouvre|genere|fais|montre).*(compte\s*rendu|rapport|bilan)/.test(s))
    return { action: { type: "report" }, label: "Compte-rendu ouvert", ack: "voilà" };

  return null;
}
