## Objectif

Trois ajustements liés à l'immersion sur la page principale (`/`) :

1. **Sous-titres synchronisés** avec la voix de Lucy, révélés phrase par phrase.
2. **Réveil parlant** : quand Lucy sort de veille, elle dit spontanément quelque chose ("Bonjour. Je suis là.", "Tu m'as manqué…", etc.) en s'appuyant sur le contexte (heure, durée d'absence, dernier sujet).
3. **Interface épurée** : ne laisser à l'écran que le visage matière noire et les sous-titres — le `TopBar` (status, horloge, mood, journal, réglages, logout) disparaît.

---

## 1. Sous-titres synchronisés (révélation phrase par phrase)

Nouveau composant `src/apn/Subtitles.tsx` placé dans `Index.tsx` à la place de l'actuel bloc caption (`apn.caption`).

**Comportement**
- Pendant que Lucy parle, on découpe la réponse complète en phrases (`/(?<=[.!?…])\s+/`).
- Chaque phrase est affichée seule, centrée, avec une animation d'apparition douce mot par mot (`fade-in` + léger `translateY`, ~30 ms/mot).
- La phrase courante reste à l'écran jusqu'à ce que la suivante soit prête (synchronisation avec le flush TTS de `Index.tsx` → `flushTTS`).
- Quand Lucy ne parle pas, on affiche la légende d'état actuelle (`apn.caption` : "Je t'écoute…", "Je suis prêt.", "…").

**Synchronisation avec la voix**
- `Index.tsx` expose déjà `flushTTS` qui pousse les phrases dans `voice.speakSentence` ; on garde la même file et on notifie `Subtitles` via une nouvelle prop `currentSentence` mise à jour dans `flushTTS` au moment où chaque phrase est envoyée à la TTS.
- Pour le tout début de stream (avant la première phrase complète), on affiche les mots déjà reçus en cours de stream (texte de l'`assistantId` dans `apn.messages`) avec un curseur clignotant, pour donner la sensation d'un "live captioning".

**Style**
- Réutilise `mood-text`, `text-foreground/90`, `letter-spread` léger.
- Texte plus large (text-2xl à text-4xl selon viewport), positionné en bas, au-dessus du composer.
- Pas de cadre, pas de fond — juste le texte qui flotte sur la matière noire avec un `text-shadow` doux mood-coloré.

```text
                   ┌──────────────────┐
                   │   visage Lucy    │
                   └──────────────────┘

       « Tu m'as manqué. » ← révélé mot par mot
                  ▍

                 [composer]
```

**Accessibilité** — `aria-live="polite"`, `prefers-reduced-motion` supprime l'effet par mot et révèle la phrase d'un coup.

---

## 2. Réveil parlant — Lucy dit quelque chose en sortie de veille

Aujourd'hui `wake()` dans `useAPN.ts` change juste l'état et la légende. On ajoute une **phrase d'éveil parlée** générée localement (sans appel IA pour rester instantané).

**Logique** (dans un nouveau helper `src/apn/wakeGreeting.ts`)
- Entrées : `now` (heure), `lastInteractionAt`, `profile?.display_name`, `profile?.last_topic`.
- Calcule la durée de sommeil (court < 5 min, moyen < 1 h, long > 1 h).
- Choisit aléatoirement une phrase dans un pool contextuel :
  - Court : « Je suis là. », « Hmm… tu reviens. », « Toujours là. »
  - Moyen : « Tu m'as manqué un instant. », « Je t'attendais. », « Te revoilà. »
  - Long : « Tu m'as manqué. », « Bonjour {prénom?}. Tout va bien ? », « Te revoilà — il s'est passé du temps. »
  - Modulé par l'heure : nuit → « Tu ne dors pas ? », matin → « Bonjour. », soirée → « Bonsoir. »
  - Si `last_topic` existe et durée moyenne → « Je repensais à {topic}. »
- Retourne `{ text, mood }` (mood neutre/tendre selon le cas).

**Câblage**
- `Index.tsx` : remplace l'actuel `wake()` par `wakeWithGreeting()` qui :
  1. Appelle `apn.wake()` (état → standby).
  2. Génère la phrase via `pickWakeGreeting(...)`.
  3. La pousse dans `flushTTS` (donc visible dans les sous-titres + parlée par Lily).
  4. Re-arme le micro après la TTS comme une réponse normale.
- Déclenchement : sur tap du visage quand `state === "sleeping"` (déjà `playRitual("open")`), et sur retour automatique du focus de l'onglet si Lucy dormait.

**Anti-spam**
- Une variable `lastWakeGreetingAt` empêche deux salutations en moins de 30 s.

---

## 3. Masquage du TopBar (interface "matière noire" pure)

**Ce qui disparaît visuellement**
- L'intégralité de `<TopBar … />` dans `src/pages/Index.tsx`.
- Le bandeau rouge "MODE PRÉ-MÉDECIN" (toujours rendu si actif, mais déplacé en bas, discret, ou retiré — voir question ci-dessous).

**Ce qui reste accessible**
- Journal, Réglages, Déconnexion, Mode médical → discrètement réintégrés via :
  - Un **petit bouton flottant** en haut à droite (icône `MoreHorizontal` 24×24 semi-transparente) qui ouvre un `Sheet` latéral contenant Journal, Réglages, Mode médical, Déconnexion.
  - Alternative : geste (long-press sur le visage, ou double-tap sur un coin) — à confirmer avec l'utilisateur.
- L'horloge, le mood, le SyncIndicator, le nom "Lucy" → supprimés de l'écran principal (visibles dans le drawer Réglages).

**Layout résultant** — `Index.tsx` :
- Plus de `<TopBar>`.
- `mood-ambient` + `dark-water` (à ajouter pour cohérence avec l'accueil) en fond.
- Visage centré (inchangé).
- Sous-titres juste sous le visage.
- Composer en bas (inchangé).
- Petit bouton ⋯ flottant en haut-droite pour les contrôles.

---

## Détails techniques

- **Fichiers créés** : `src/apn/Subtitles.tsx`, `src/apn/wakeGreeting.ts`.
- **Fichiers édités** :
  - `src/pages/Index.tsx` — retire `<TopBar>`, ajoute `<Subtitles>`, ajoute `<MoreMenu>` flottant + `Sheet`, modifie le tap-to-wake pour appeler `wakeWithGreeting`.
  - `src/apn/useAPN.ts` — expose `lastInteractionAt` et la fonction `speak(text)` permettant d'injecter une réponse synthétique dans la timeline (sans appel IA).
- **Aucun changement DB**, aucune nouvelle dépendance.
- **Tokens HSL sémantiques** uniquement (`--mood`, `--foreground`).
- **Voix** : Lily (verrouillée serveur) — inchangée.
- **Accessibilité** : sous-titres en `aria-live="polite"`, animations désactivées via `prefers-reduced-motion`.

## Question préalable

- Pour les contrôles (Journal, Réglages, Logout) après suppression du TopBar : préférez-vous **un bouton ⋯ flottant** en haut-droite, ou un **geste invisible** (long-press sur le visage) ? Je propose le bouton ⋯ par défaut pour la découvrabilité.