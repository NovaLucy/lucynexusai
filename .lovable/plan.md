# Lucy — un seul flux, comme un humain

## Failles repérées dans la conversation actuelle

1. **Pas de barge-in** : on ne peut pas couper Lucy en parlant. Il faut taper l'orbe.
2. **Voix qui change en cours de réponse** : pendant le streaming, les phrases sont dites par la voix browser (`speechSynthesis`) ; à la fin, si rien n'a été parlé, ElevenLabs prend le relais. On peut donc entendre deux Lucy différentes dans la même réponse.
3. **Wake-word « Lucy » s'écoute lui-même** : quand Lucy dit son propre nom, le mot d'éveil peut se redéclencher → boucles parasites.
4. **Pas de tour de parole** : après une réponse, le micro se referme. L'utilisateur doit re-tapoter pour répondre. Ce n'est pas une conversation, c'est un walkie-talkie.
5. **VAD trop agressive** : un silence d'1.8 s envoie le message. Si l'utilisateur réfléchit, son message part coupé.
6. **L'orbe ne respire pas avec l'utilisateur** : la couleur d'humeur ne change qu'après la réponse de Lucy. Pendant qu'on parle, elle reste figée sur la dernière humeur.
7. **Commandes vocales muettes quand la voix est coupée** : un toast minuscule s'affiche, mais aucune trace dans le journal — l'utilisateur ne sait pas si Lucy a entendu.
8. **Capacités déconnectées** : Lucy « sait » qu'elle a vue/lieu/micro mais ne réagit jamais à un changement (caméra qu'on vient d'activer, lieu nouvellement partagé). Le système prompt le mentionne mais n'a aucun signal d'événement.
9. **Wake-greeting fragile** : `setTimeout(1400)` après la salutation pour ouvrir le micro — si Lucy parle encore, le micro capte sa voix.
10. **Aucune mémoire de l'instant** : pendant l'écoute, Lucy n'utilise pas l'audio partiel pour anticiper l'humeur ni pour préparer la suite.

## Cap : un seul flux

Tout passe par une **boucle conversationnelle unique** :
écoute → humeur live → pensée → parole → écoute… avec barge-in possible à chaque seconde.

```text
   ┌────────── BARGE-IN ──────────┐
   │                              ▼
USER ►► STT (partial) ►► mood live ►► CHAT ►► TTS (1 voix) ►► USER
   ▲                                                          │
   └────── auto-listen 6 s (turn-taking) ◄────────────────────┘
```

## Changements

### 1. Voix unifiée (`src/apn/useVoice.ts`)
- `speakSentence` : sur web, **garder ElevenLabs** quand dispo (file d'attente d'`Audio` séquentielle) avec fallback `speechSynthesis` ; sur natif, file `nativeSpeak`. Une seule voix de bout en bout.
- Supprimer le « replay complet » à la fin (`voice.speak(full)` quand `ttsSpokenRef === 0`) → si rien n'a été streamé, parler une seule fois ; sinon laisser couler.
- Exposer `speaking` (boolean) + `onSpeechEnd` callback global.

### 2. Barge-in (`src/pages/Index.tsx`)
- Détecter parole utilisateur pendant que `voice.speaking` est vrai :
  - Wake-word match → `voice.stop()` + ouverture immédiate du STT (pas de greeting).
  - Volume mic > seuil pendant 250 ms (via `AudioContext` analyzer dans `useReality` ou nouveau hook léger) → idem.
- Visuel : l'orbe revient instantanément en `listening`, ritual de fermeture rapide.

### 3. Wake-word qui ne s'entend pas (`src/apn/useWakeWord.ts`)
- Nouveau prop `muteWhileSpeaking: boolean`. Quand `voice.speaking` est vrai, on suspend la reconnaissance (`r.abort()`), puis on relance 400 ms après la fin.
- Cooldown réduit à 2 s (plus naturel).

### 4. Tour de parole (turn-taking)
- Nouveau réglage **« Conversation continue »** (toggle Réglages, défaut ON, persisté `lucy:turnTaking`).
- À la fin de `onAssistantEnd` + fin TTS : ouvrir une fenêtre d'écoute douce (6 s). Si activité vocale détectée → bascule plein STT. Sinon → standby silencieux.
- Désactivable via voix : « Lucy, ne m'attends pas » / « reste à l'écoute ».

### 5. Humeur en direct pendant l'écoute
- Dans `handleMic` → `voice.startListening` → callback `onPartial` :
  - Toutes les 600 ms, appeler `inferMood(partial)` et `apn.setMoodAndApply(mood)` avec un lissage (transition douce CSS).
  - L'orbe respire avec l'utilisateur.

### 6. VAD plus humaine
- Augmenter le silence VAD côté Scribe à **2.6 s** (réflexion permise).
- Ajouter une pression longue sur l'orbe = push-to-talk strict (déjà en place) → la VAD est ignorée ; on ne finalise qu'au relâchement.

### 7. Commandes vocales tracées
- Quand `runCommand` matche : insérer un message assistant éphémère dans `apn.messages` (`{ role: "assistant", content: "(ok — " + cmd.label.toLowerCase() + ")", mood: "calm" }`) **sans** persistance backend, juste pour le journal local.
- Si voix activée : speakLine(ack) ; sinon : afficher la ligne comme sous-titre 1.5 s.

### 8. Capacités vivantes (signal d'événement)
- Dans `useReality`, exposer `recentlyChanged: { cam?, loc?, mic? }` qui passe à `true` 30 s après un toggle puis revient à `false`.
- Passer ce flag au backend dans `capabilities`. Le system prompt reçoit une nouvelle ligne :
  > « Une capacité vient d'être (ré)activée par elle/lui : **caméra**. Tu peux le mentionner avec naturel une seule fois, comme on remarque qu'on a rouvert un volet. »
- Côté `chat/index.ts` : ajouter `buildCapabilityChangeBlock(capabilities)`.

### 9. Wake-greeting chaîné sur fin de TTS
- `wakeWithGreeting` → `speakLine(line, { onEnd: () => openMic() })` au lieu de `setTimeout(1400)`.
- Ajouter un `onEnd` à `speakLine` (déjà possible via `voice.speak` ; à propager).

### 10. Indices contextuels (`HintLine`)
- Afficher un mini-bandeau discret quand utile :
  - première ouverture : « appuie sur l'orbe pour parler · maintiens pour push-to-talk »
  - juste après une réponse en mode conversation : « je t'écoute encore… »
  - sleeping : « touche l'orbe ou dis "Lucy" »

## Fichiers touchés

- `src/apn/useVoice.ts` — file ElevenLabs séquentielle, `speaking`, `onSpeechEnd`, suppression du double-speak.
- `src/apn/useWakeWord.ts` — `muteWhileSpeaking`, cooldown 2 s.
- `src/apn/useReality.ts` — `recentlyChanged`.
- `src/apn/useAPN.ts` — exposer `setMoodAndApply` ; injecter une commande locale (`appendLocalAssistant(text)`).
- `src/pages/Index.tsx` — barge-in, turn-taking, humeur live, hints, chaînage greeting/TTS.
- `src/apn/ControlsDrawer.tsx` — toggle « Conversation continue », slider « Patience d'écoute » (1.5 → 4 s).
- `src/apn/HintLine.tsx` — nouveaux hints contextuels.
- `supabase/functions/chat/index.ts` — `buildCapabilityChangeBlock` + signal `barged_in` éventuel pour ajuster le ton (« — pardon, je t'écoute »).
- `src/apn/voiceCommands.ts` — ajouter « ne m'attends pas » / « reste à l'écoute » / « interromps-toi ».

## Garde-fous

- Pas de touche aux fichiers générés (`integrations/supabase/*`, `.env`).
- Pas de migration DB nécessaire.
- Le backend reste backward-compatible : tous les nouveaux champs (`capabilities.recentlyChanged`, `barged_in`) sont optionnels.
- Toggle « Conversation continue » par défaut ON mais désactivable en un tap.
- Le wake-word reste opt-in — rien ne change pour les utilisateurs qui ne l'activent pas.

## Hors scope (à proposer plus tard si tu veux)

- Détection de plusieurs voix (parole ≠ utilisateur principal).
- Déclenchement spontané de Lucy quand le « regard ambiant » repère un changement marquant.
- Mémoire vectorielle vraie (au lieu du keyword recall actuel).
