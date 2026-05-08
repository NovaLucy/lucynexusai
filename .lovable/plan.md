# Refonte APN — Brutalist Mono / Terminal Riche

Direction : terminal hacker chic. Noir pur, blanc, accent mono par humeur. Typo monospace partout. Lignes 1px nettes. Aucun glassmorphism, aucun glow flou. À la place : grilles, brackets `[ ]`, séparateurs `─────`, badges encadrés, indicateurs ASCII.

## 1. Nouvelle orbe — `OrbCanvas.tsx`

Remplacer le shader plasma actuel par une **sphère wireframe** mi-3D mi-ASCII :

- Sphère filaire rotative (latitudes/longitudes) en lignes 1px monochromes
- Surimpression de **caractères ASCII** (`. : ; + * # @`) mappés sur la profondeur, comme un renderer terminal — densité variant selon `uEnergy`
- Trame de scan horizontale (CRT) qui défile lentement
- Couleur unique = couleur d'humeur (cyan/rose/violet/ambre) sur fond noir
- Respiration = légère pulsation du rayon + variation de densité ASCII
- États :
  - `standby` : rotation lente, ASCII clairsemé
  - `thinking` : rotation accélère, glitch ponctuel (lignes décalées)
  - `speaking` : ondes concentriques qui partent du centre
  - `listening` : sphère qui "respire" + petites barres VU autour
- Mood `alert` : trame de scan rouge plus dense + flicker
- Mood `focused` : sphère devient un vortex ASCII spiralé

Technique : on garde Three.js. Deux passes — `THREE.LineSegments` pour le wireframe + un canvas 2D overlay (texture) qui dessine les caractères ASCII, samplée dans le shader. Plus simple : tout en shader fragment qui simule l'ASCII via lookup d'un atlas (8 glyphes packés dans une texture). Je pencherais pour la deuxième : 1 seul plan, perf max.

## 2. Refonte interface complète

### Layout général
- Fond `#000` pur (plus de `#03040a`)
- Grille de fond invisible 8px (debug-friendly)
- Marges franches, alignements stricts gauche/droite (pas de centrage flottant sauf l'orbe)
- Tout en monospace : `JetBrains Mono` (display + body)
- Accent par humeur via une seule variable `--mood` (déjà en place)

### Top bar (remplace le HUD actuel)
```text
[APN] ──────── STATE: SPEAKING ──── MOOD: FOCUSED ──── 14:23:07 ─── [LOG] [CFG]
```
- Une seule ligne, bordure bas 1px
- Horloge live monospace
- Boutons texte encadrés `[LOG]` `[CFG]` (pas d'icônes rondes)

### Bandeau gauche — visualiseur audio (densité riche)
- Colonne fine 60px à gauche
- VU-meter vertical ASCII pendant `speaking`/`listening` :
  ```
  ▓▓▓▓▓▓▓░░░
  ▓▓▓▓▓░░░░░
  ▓▓▓▓▓▓▓▓░░
  ```
- Fréquences temps réel via `AnalyserNode` du Web Audio sur le micro/TTS

### Bandeau droit — mémoire & state
- Colonne fine 60px à droite
- Indicateurs ASCII verticaux :
  - `MSG: 042`
  - `MEM: ████░░░ 57%`
  - `LOOP: 2`
  - `TOPIC: travail`
- Mises à jour live depuis `apn.profile`

### Centre — orbe ASCII
- Carré central avec bordure pointillée 1px : `┌─ NEURAL CORE ─┐`
- Coordonnées coin sup-droit `[x: 0.42  y: -0.18]` (joli détail terminal)
- Caption sous l'orbe en mono majuscules : `> THINKING ABOUT TRAVAIL...`

### Particules ambiantes
- Caractères ASCII flottants très subtils en background (`. ` `* ` `' `) qui dérivent lentement, opacité 5%
- Ne perturbent pas la lisibilité

### Composer (bas)
- Plus de pilule ronde glassy. À la place :
  ```
  > _ |                                        [MIC] [CAM] [SEND ↵]
  ─────────────────────────────────────────────────────────────────
  ```
- Bordure haute 1px, fond noir, prompt `>` clignotant
- Boutons = texte entre crochets `[MIC]`, deviennent `[●REC]` rouge quand actif
- Curseur block clignotant (CSS `animate-pulse`)

### Chat log (drawer)
- Plein écran overlay noir avec scanlines très légères
- Chaque message préfixé : `[USR 14:22:01] >` ou `[APN 14:22:04] $`
- Pas de bulles arrondies, juste du texte aligné gauche avec bordure gauche 2px couleur humeur pour user / blanche pour APN
- En haut : `── JOURNAL ──────── 042 MESSAGES ───── [X CLOSE]`

### Controls drawer
- Même esthétique : panneau noir, sliders ASCII style `[━━━━━●━━━] 0.75`
- Toggles : `[X] VOICE ENABLED` / `[ ] VOICE DISABLED`
- Section headers : `── VOICE ──`, `── RENDER ──`

## 3. Système de design

### `index.css`
- Variables : `--bg: 0 0% 0%`, `--fg: 0 0% 95%`, `--dim: 0 0% 50%`, `--line: 0 0% 20%`
- `--mood-h/s/l` conservé (déjà là)
- Font family : `'JetBrains Mono', monospace` partout
- Nouvelles utilities : `.ascii-border`, `.scanlines`, `.cursor-blink`, `.bracket-btn`

### `tailwind.config.ts`
- Ajouter family `mono` = JetBrains Mono
- Couleurs sémantiques : `bg`, `fg`, `dim`, `line`, `mood`
- Désactiver tous les `rounded-*` arrondis dans les composants custom (on garde shadcn intact)

### Suppression progressive
- Classes `.glass`, `.mood-ring`, drop-shadows, blurs → remplacées par bordures 1px + couleurs plates

## 4. Fichiers touchés

```text
src/apn/OrbCanvas.tsx          ← réécriture totale (wireframe + ASCII shader)
src/apn/MicroHUD.tsx           ← devient TopBar pleine largeur
src/apn/Composer.tsx           ← refonte terminal prompt
src/apn/ChatLog.tsx            ← refonte log style
src/apn/ControlsDrawer.tsx     ← refonte sliders ASCII
src/apn/AsciiSidebarLeft.tsx   ← NOUVEAU (VU-meter)
src/apn/AsciiSidebarRight.tsx  ← NOUVEAU (mémoire/state)
src/apn/AmbientChars.tsx       ← NOUVEAU (particules ASCII fond)
src/pages/Index.tsx            ← réagencement layout 3 colonnes
src/index.css                  ← refonte tokens + utilities
tailwind.config.ts             ← font mono, couleurs flat
index.html                     ← preload JetBrains Mono
```

## 5. Conservé tel quel

- Toute la logique : `useAPN`, `useVoice`, `intent.ts`, `notifications.ts`, edge functions
- Types `Mood` / `AgentState` / `MOOD_HUE` / `MOOD_HSL`
- Hooks haptics, photo, STT/TTS

## 6. Question résiduelle

Pour l'orbe ASCII, deux variantes possibles — dis-moi laquelle tu préfères, sinon je pars sur la **B** :

- **A.** Wireframe pur (lignes lat/long visibles) + caractères ASCII clairsemés en surimpression
- **B.** Pure ASCII : la sphère **est** faite de caractères (rendu terminal style donut.c rotatif), pas de lignes du tout
- **C.** Hybride : wireframe en fond, ASCII dense devant qui forme la "matière" de la sphère
