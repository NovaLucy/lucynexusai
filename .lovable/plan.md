## Refonte UI cinématique 4K — adaptative à l'humeur

Direction : **bio-organique cinématique**, le centre devient massif et magnétique, tout le reste respire avec l'humeur. Aucune logique métier touchée, uniquement présentation.

---

### 1. Centre — un cœur qui domine l'écran

**`src/apn/agi/VolumetricFace.tsx`**
- Caméra plus serrée (fov 38), géométrie principale plus dense (icosahedron 1.2 / 96).
- 3 couches additives au lieu d'une : noyau + halo Fresnel volumétrique + voile externe gazeux (3 sphères avec shaders distincts).
- Bloom-like via post-processing peu coûteux (`@react-three/drei` `EffectComposer` + `Bloom`) — ou faux bloom shader si on veut zéro dépendance.
- Veines lumineuses dans le shader (FBM 3 octaves au lieu de 2 octaves) → texture "cellulaire".
- Particules orbitales (~120 points) qui s'orientent vers la caméra, drift lent, accélération sur `speaking`.
- Anneaux : passer de 3 fins à 2 anneaux + 1 disque équatorial flou (effet Saturne).
- Couleur : double couleur (mood + mood-complémentaire) qui se mélange par Fresnel — donne profondeur cinéma.

**`src/pages/Index.tsx`**
- Centre passe de `min(78dvh, 92%)` → `min(92dvh, 100%)` desktop, `min(78dvh, 100%)` mobile.
- Sidebars deviennent **overlays** semi-transparents par-dessus le centre (au lieu de colonnes qui le compriment), via `position: absolute` sur les côtés.
- Halo radial CSS derrière le canvas qui pulse avec mood (`box-shadow` énorme + `filter: blur`).

---

### 2. Adaptatif à l'humeur — partout

**`src/index.css`** (nouveau bloc)
- Variables CSS pilotées par mood déjà présentes (`--mood-h/s/l`) → étendre :
  - `--ambient-intensity` (0.3 → 1.2 selon `state`)
  - `--bg-pulse-speed` (8s calme, 2s parlant)
- Background `<main>` : gradient radial animé qui suit `--mood-h`, vignette dynamique 4K.
- Grain SVG noir 4% en overlay (texture pellicule).

**`src/apn/agi/NeuralNetwork.tsx`**
- Densité adaptive : 70 nœuds idle → 140 nœuds en `thinking/speaking`.
- Edges pulsent en suivant le rythme de la voix (lecture `apn.state` déjà en place).
- Couleur mixée mood + son complémentaire.

**`src/apn/HUDFrame.tsx`**
- Opacité globale liée à `--ambient-intensity` (s'efface en idle, s'allume quand APN parle).
- Anneaux dashed deviennent solides + glow quand `speaking`.
- Telemetry : ajouter une **waveform** SVG faussement live (sinus modulé) en bas du HUD pour effet "vivant".

---

### 3. Ambiance cinéma 4K

**`src/index.css`**
- Vignette plein écran via `radial-gradient` après `<main>` (pseudo-élément).
- Léger chromatic aberration sur le centre (filter `drop-shadow` + offset RGB) — uniquement pendant `speaking`.
- Letterbox subtil (barres noires 2% haut/bas) qui apparaît en `thinking` pour effet "moment important".

**`src/apn/AmbientChars.tsx`**
- Réduire l'opacité des chars (0.04 → 0.025) pour ne pas concurrencer le centre.
- Densité adaptative selon viewport.

---

### 4. Conversation — discrète et intégrée

**`src/apn/Composer.tsx`** + **caption**
- Composer : fond `backdrop-blur-xl` plus prononcé, bordure mood-tinted, glow doux quand focus.
- Caption (sous le centre) : typo plus large en desktop, fade-in lettre par lettre (déjà partiellement présent), tracking augmenté.

**`src/apn/ChatLog.tsx`** (overlay)
- Pas de refonte structurelle, juste glassmorphism + bordure mood.

---

### 5. Sidebars repensées

**`src/apn/AsciiSidebarLeft.tsx` / `Right.tsx`**
- Largeur réduite (de ~16rem à ~11rem desktop), padding aéré.
- Devient `absolute` left-0 / right-0 avec `pointer-events-none` sur le wrapper, `pointer-events-auto` sur les éléments interactifs.
- Fond : `bg-gradient-to-r from-black/80 via-black/20 to-transparent` (gauche, inverse à droite) — fond qui se fond dans le centre.
- Cachées totalement < md (déjà le cas, on garde la stat strip mobile).

---

### Détails techniques

- **Aucune nouvelle dépendance obligatoire.** Si l'on veut bloom propre : `@react-three/postprocessing@^2.16` (compat fiber 8). Sinon faux bloom via shader.
- Toutes les couleurs via tokens HSL existants (`--mood-h/s/l`, design system intact).
- Performance : particules en `Points` + `BufferGeometry`, neural network reste sur canvas 2D, dpr cap 1.75 mobile.
- Respect viewport mobile 710×710 actuel : centre passe en plein écran, sidebars masquées, stat strip conservée.

---

### Fichiers touchés

- `src/apn/agi/VolumetricFace.tsx` — refonte shaders + particules + double couleur
- `src/apn/agi/NeuralNetwork.tsx` — densité adaptative
- `src/apn/agi/HUDFrame.tsx` — opacité réactive + waveform
- `src/pages/Index.tsx` — layout (sidebars overlay, centre élargi, halo, vignette)
- `src/index.css` — variables ambient, vignette, grain, letterbox, halo
- `src/apn/AsciiSidebarLeft.tsx` & `AsciiSidebarRight.tsx` — fond fondu, largeur
- `src/apn/AmbientChars.tsx` — opacité réduite
- `src/apn/Composer.tsx` — glass mood-tinted

Aucun fichier supprimé, aucune logique backend touchée.