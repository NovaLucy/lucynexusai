
## Objectif

Rendre la prise de parole plus fiable, les commandes vocales plus naturelles, et l'accès à la conversation plus évident — sans casser ce qui fonctionne déjà (wake-word, halo, rituels).

## 1. Prise de voix (mic) — plus fluide et tolérante

**Problèmes actuels**
- `nativeStartListening` coupe brutalement après **6 s fixes**, même si l'utilisateur parle encore.
- Sur le web, Scribe se déconnecte sur silence VAD mais **aucun garde-fou** si la connexion ws tombe (1006 vu dans les logs) → le mic reste "listening" en UI.
- Pas d'indicateur clair "je t'écoute" quand le micro s'ouvre.

**Propositions**
- **Silence-detect natif** : remplacer le `setTimeout(6000)` par une boucle qui prolonge tant que `last` change (reset du timer à chaque partial), max 20 s. Couper après 1.8 s sans nouveau partial.
- **Auto-recovery web** : sur erreur Scribe / WebSocket 1006, repasser proprement en `listening = false` + toast discret « micro coupé, retape pour reprendre ».
- **Onde audible courte** (existant `tapMedium` + petit son optionnel) à l'ouverture du micro pour confirmer.
- **Push-to-talk long-press** sur l'orbe : appui court = toggle (actuel), appui maintenu = micro ouvert tant que doigt posé, ferme à relâchement → utile en environnement bruyant.

## 2. Commandes vocales — plus naturelles

**Problèmes actuels**
- `voiceCommands.ts` n'a que ~10 patterns rigides ; toute variante échoue silencieusement.
- Les commandes sont exécutées **avant** d'arriver à Lucy : impossible d'enchaîner « ouvre le journal et parle moins fort ».
- Pas de feedback vocal — juste un toast.

**Propositions**
- **Élargir les patterns** : ajouter
  - couper / réactiver le wake-word (« arrête de m'écouter », « écoute en continu »)
  - voix plus douce / plus forte / plus lente / plus rapide (mappés sur `prefs.rate`/`pitch`)
  - mode sombre/clair si pertinent
  - « répète », « plus court », « tais-toi » (= `voice.stop()` immédiat)
  - « efface la conversation » (confirm via toast action)
- **Confirmation vocale courte** : au lieu d'un toast seul, Lucy dit 1 mot (« voilà », « ok », « coupé ») via `speakLine`, puis exécute.
- **Fallback LLM** : si `matchCommand` échoue mais que la phrase commence par un verbe d'action court (« ouvre… », « coupe… »), envoyer au chat avec un flag `intent: "command"` — laisser Lucy interpréter et répondre via une `client_tool_call`-like (déjà partiellement en place côté chat).

## 3. Accès à la conversation — plus intuitif

**Problèmes actuels**
- Le bouton clavier en bas-droite est petit, sans label, opacifié quand Lucy parle.
- L'orbe est cliquable mais rien ne dit qu'on peut **taper** au lieu de parler.
- Le composer s'ouvre auto au clavier physique mais sur mobile, rien n'invite à taper.
- `ChatLog` (le journal) est caché derrière un menu « … ».

**Propositions**

a. **Hint contextuel sous l'orbe** (à côté de Subtitles) — micro-texte qui change selon l'état :
- standby : « tape pour écrire · touche pour parler »
- listening : « je t'écoute… »
- sleeping : « touche pour me réveiller »
S'efface dès la première interaction.

b. **Double-tap orbe = ouvre le composer** (au lieu de devoir viser le petit bouton clavier). Tap simple reste = mic.

c. **Swipe-up depuis le bas** = ouvre le composer (geste mobile naturel). Swipe-down sur le composer = referme.

d. **Bouton clavier élargi** : passer en pill « Écrire » avec icône + label sur mobile, plutôt qu'un rond opaque. Devient un FAB plus lisible.

e. **Raccourci journal** : ajouter un swipe latéral (gauche→droite) ou un bouton discret en haut-gauche (pendant du « … » à droite) qui ouvre directement le `ChatLog`, vu que c'est l'élément le plus consulté.

f. **Premier lancement** : un petit onboarding 3-cards (« touche pour parler · tape pour écrire · dis "Lucy" pour me réveiller ») affiché 1 fois, dismissible, stocké dans localStorage.

## Découpage des fichiers

- `src/apn/nativeVoice.ts` — silence-detect intelligent
- `src/apn/useVoice.ts` — auto-recovery WebSocket
- `src/apn/voiceCommands.ts` — patterns étendus + retour parlé
- `src/apn/Composer.tsx` + `src/pages/Index.tsx` — hint contextuel, double-tap, swipe-up, FAB élargi
- `src/apn/Onboarding.tsx` (nouveau composant léger ou réutilise l'existant) — 3-cards intro

## Priorité suggérée

1. Silence-detect + auto-recovery (impact immédiat sur fiabilité)
2. Hint contextuel + FAB élargi (clarté UX)
3. Patterns commandes étendus + retour parlé
4. Double-tap / swipe-up + onboarding (raffinements)

Dis-moi si tu veux que je fasse les **4 d'un coup** ou seulement les **priorités 1-2** d'abord.
