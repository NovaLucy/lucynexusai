# Vérification complète — Lucy

## Failles trouvées (réelles, vérifiées dans le code)

### 1. Tour de parole cassé (`src/pages/Index.tsx` l.396-407)
Aujourd'hui le code dit "fenêtre 6s d'écoute" mais en pratique :
- `setTimeout(open, 350)` ouvre le micro 350 ms après la fin TTS, **quoi qu'il arrive**.
- Le `setTimeout` de 6500 ms ne fait que vider `turnTakingActive`, il ne ferme jamais rien et **ne peut pas être annulé** si l'utilisateur tape entre-temps.
- Résultat : le micro s'ouvre toujours, la conversation "continue" est en fait une auto-écoute systématique, et le hint "je t'écoute encore" ne s'affiche jamais.

→ Réécrire : `turnTakingActive = true` pendant 6 s, ouvrir le micro **uniquement après ce délai si rien ne s'est passé**, annuler proprement si l'utilisateur écrit, parle, ou si Lucy repart en thinking/speaking.

### 2. `voice.stop()` ne vide pas la file TTS (`src/apn/useVoice.ts` l.91-109 + l.146-197)
`ttsQueueRef` est une chaîne de promesses. Quand on appelle `stop()` (barge-in, "tais-toi"), l'audio en cours est coupé, **mais les phrases déjà en queue continuent d'être fetch puis jouées** une fois la requête revenue.

→ Ajouter un token d'invalidation (`genRef`) capturé à chaque `speakSentence` : à `stop()`, on bump le token, et chaque maillon de la queue vérifie qu'il est encore valide avant de jouer / fetcher. Idem pour `nativeSpeak`.

### 3. Hint contextuel non câblé (`src/pages/Index.tsx` l.728-732)
`HintLine` accepte `turnTakingActive` et `speaking` mais Index ne les passe pas. Les messages "parle, je m'arrête" et "je t'écoute encore…" sont morts.

→ Passer `turnTakingActive={turnTakingActive}` et `speaking={voice.speaking}`.

### 4. Wake-word qui se redémarre en boucle (`src/pages/Index.tsx` l.350-353 + `useWakeWord.ts`)
`wakeWordActive` dépend de `voice.speaking`, qui flip à chaque phrase TTS streamée. L'effet de `useWakeWord` se ré-exécute à chaque flip → `recognition.stop()` puis `new SR()` plusieurs fois par tour. Sur Chrome ça finit par renvoyer "aborted" et le wake-word meurt silencieusement.

→ Découpler : démarrer la recognition une seule fois quand `enabled` change, gérer la pause interne via un `pausedRef` mis à jour par un second effet sur `muteWhileSpeaking`.

### 5. `recentlyChanged` faux-positifs au boot (`src/apn/useReality.ts` l.120-121)
`markChange("loc")` et `markChange("cam")` sont appelés au tout premier render des effets de persistance, donc Lucy reçoit "la caméra vient d'être activée" à chaque démarrage, même si rien n'a changé.

→ Sauter le premier run avec un `firstRunRef` par toggle.

### 6. Mute micro pendant TTS trop étroit (`src/pages/Index.tsx` l.142-147)
Le mute se base sur `apn.state === "speaking"/"thinking"`, mais la voix peut encore jouer après que l'état soit repassé en `standby` (file TTS qui draine). Le micro peut alors s'allumer et capturer la fin de la propre voix de Lucy.

→ Aussi suspendre tant que `voice.speaking` est vrai.

## Détails techniques (pour info)

```text
useVoice.stop()      ─┐
                      ├──► bump genRef
ttsQueueRef chain ────┘    chaque .then() : if (gen !== myGen) return
```

```text
TurnTaking timeline correct :
  TTS end ─► turnTakingActive = true ─┐
                                       ├─ 6000 ms ─► si idle: open mic
  user typing / Lucy thinking ─cancel ─┘
```

## Hors scope (volontairement)
- Pas de refonte UI/visuel.
- Pas de changement de modèle IA ni du prompt système.
- Pas de migration BDD.

Tous les changements restent dans 4 fichiers : `useVoice.ts`, `useReality.ts`, `useWakeWord.ts`, `pages/Index.tsx`.
