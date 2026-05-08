// Voice command parser — match user text to UI actions.
// Returns null if no command matched.

export type CommandAction =
  | { type: "medical"; value: boolean }
  | { type: "openLog" }
  | { type: "openCfg" }
  | { type: "voice"; value: boolean }
  | { type: "polish"; value: boolean }
  | { type: "report" };

export interface MatchedCommand {
  action: CommandAction;
  label: string;
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

  // Optional "apn," prefix tolerated
  const s = t.replace(/^(apn|hey apn|ok apn)\s*/i, "");

  // Mode médecin
  if (/(stop|coupe|desactive|quitte|arrete).*(mode\s+)?(med|medecin|medical|sante)/.test(s))
    return { action: { type: "medical", value: false }, label: "Mode médecin désactivé" };
  if (/(active|lance|passe|ouvre|mode)\s+(en\s+)?(mode\s+)?(med|medecin|medical|sante)/.test(s) ||
      /\b(mode\s+)(med|medecin|medical|sante)\b/.test(s))
    return { action: { type: "medical", value: true }, label: "Mode médecin activé" };

  // Voix
  if (/(coupe|tais|silence|stop)\s+(ta\s+)?voix|tais\s*toi/.test(s))
    return { action: { type: "voice", value: false }, label: "Voix coupée" };
  if (/(active|remets|allume|reprends).*(voix|parle)|parle\s*moi/.test(s))
    return { action: { type: "voice", value: true }, label: "Voix activée" };

  // Polish / correction
  if (/(desactive|coupe|stop).*(correction|polish)/.test(s))
    return { action: { type: "polish", value: false }, label: "Correction désactivée" };
  if (/(active|lance|allume).*(correction|polish)/.test(s))
    return { action: { type: "polish", value: true }, label: "Correction activée" };

  // Journal / log
  if (/(ouvre|montre|affiche).*(journal|historique|log|conversation)/.test(s))
    return { action: { type: "openLog" }, label: "Journal ouvert" };

  // Réglages / config
  if (/(ouvre|montre|affiche).*(reglage|parametre|config|option)/.test(s))
    return { action: { type: "openCfg" }, label: "Réglages ouverts" };

  // Compte-rendu médical
  if (/(ouvre|genere|fais|montre).*(compte\s*rendu|rapport|bilan)/.test(s))
    return { action: { type: "report" }, label: "Compte-rendu ouvert" };

  return null;
}
