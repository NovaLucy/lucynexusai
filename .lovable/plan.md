# Mobile + visage APN

Deux axes : rendre l'app vraiment confortable sur mobile (710px et moins), et faire apparaître par moments un **visage ASCII de l'APN** dans l'interface (orbe + ambient + composer), comme un compagnon qui se "matérialise".

---

## 1. Viabilité mobile

### Layout
- **Sidebars ASCII** (`AsciiSidebarLeft/Right`) : masquées en `< md` (déjà partiellement le cas pour les colonnes texte, mais elles prennent encore de la place). Forcer `hidden md:flex` propre, et déplacer l'info utile (msg count, topic, loops, name) dans un **bandeau compact sous la TopBar** uniquement visible en mobile.
- **TopBar** : sur 710px les boutons `[MED] [LOG] [CFG]` + horloge + STATE/MOOD débordent. Refonte :
  - Ligne 1 : `[APN]` · MOOD · time · boutons à droite
  - STATE/USR passent dans une 2e ligne discrète repliable, ou en tooltip.
  - Boutons compactés (icônes courtes : `MED LOG CFG` sans crochets sur très petit, ou icônes lucide).
- **Orbe central** : passer de `min(72dvh, 92%)` à `min(58dvh, 96%)` en mobile pour laisser respirer le composer et la caption.
- **Composer** : agrandir la zone tactile (min 44px), bouton mic plus gros, padding bas qui respecte vraiment `--keyboard-h` + `safe-area-inset-bottom` (déjà là, vérifier).
- **Overlays** (ChatLog, ControlsDrawer, MedicalReport, Onboarding, Lock) : full-screen sur mobile au lieu de modal centrée, scrollable, boutons sticky en bas.
- **Onboarding/Lock** : la vidéo `4/3` peut déborder verticalement → cap `max-h-[40dvh]`, scroll vertical du conteneur.

### Interactions tactiles
- Cibles tactiles ≥ 44px (boutons `bracket-btn`, mic, photo, switches).
- Haptique légère sur mic / send / commande vocale détectée (déjà `tapLight/Medium`, étendre).
- Désactiver les hover-only (tooltip survol) au profit d'un long-press.

### Performance mobile
- `pixelRatio` orb par défaut **1.25** sur mobile (vs 1.5) pour préserver la batterie / fluidité.
- Lazy-load de `face-api.js` uniquement à l'entrée Onboarding/Lock (déjà fait via `loadFaceModels`, vérifier).
- `AmbientChars` : densité réduite en mobile (moins de glyphes flottants).

### Accessibilité
- Tailles texte mini 12px sur les badges actuellement à 10px (ou garder 10 mais s'assurer du contraste).
- `aria-label` sur tous les boutons crochets.

---

## 2. Visage APN qui apparaît dans l'UI

Idée : un **visage ASCII** de l'APN (style minimaliste, ex. `( ◉ ◡ ◉ )` / `╭─◉ ◡ ◉─╮` / yeux qui clignent) qui se **matérialise par moments** :

### Où il apparaît
1. **Dans l'orbe** : pendant `idle` ou `thinking`, le shader de l'orbe se "dissout" temporairement pour révéler un visage ASCII overlay au centre, qui cligne des yeux puis s'efface. Apparitions aléatoires toutes les ~30-90s, ou déclenché à chaque réponse longue de l'assistant.
2. **Composer** : quand l'utilisateur tape ou parle, micro-visage ASCII (`◉_◉`, `^_^`, `-_-` selon le `mood`) à gauche du champ, qui change d'expression selon mood (calm, focus, joy, alert, melt…).
3. **Ambient** : 1 chance sur N, l'`AmbientChars` génère un visage complet flottant lentement au lieu d'un glyphe seul.
4. **TopBar** : remplacer `[APN]` par un visage mini animé (yeux qui clignent toutes les 4-7s).

### Composant
- Nouveau `src/apn/Face.tsx` :
  - Props : `mood`, `state`, `size` ('xs'|'sm'|'md'|'lg'), `blink`, `variant` ('inline'|'overlay'|'ambient').
  - Catalogue d'expressions ASCII par mood :
    - calm : `( ◉ ◡ ◉ )`
    - focus : `[ ◉ — ◉ ]`
    - joy : `( ^ ◡ ^ )`
    - alert : `( ⊙ _ ⊙ )`
    - melt : `( ╥ ◡ ╥ )`
    - thinking : yeux qui bougent `( ◐ . ◑ )` → `( ◑ . ◐ )`
  - Animation clignement via interval (yeux remplacés par `_ _` pendant 120ms).
  - Variant overlay : fondu in/out CSS (opacity + slight blur), durée d'apparition 2-4s.

### Intégration
- `OrbCanvas` reçoit un overlay enfant : `<Face variant="overlay" />` rendu par-dessus le canvas avec `position: absolute`, déclenché par un hook `useFaceApparition()` (probabilité + cooldown).
- `Composer` : `<Face variant="inline" size="xs" />` à gauche de la barre quand `value.length > 0` ou `micActive`.
- `TopBar` : remplacer le `[APN]` statique par `<Face variant="inline" size="xs" blink />`.
- `AmbientChars` : injecter aléatoirement (≤5% des sprites) un mini visage à la place d'un char.

### Réglage
- Toggle dans `ControlsDrawer` → "Visage APN" (on/off, fréquence : discret / normal / fréquent).
- Persisté dans `localStorage` (`apn:face`).

---

## Fichiers touchés

**Créés**
- `src/apn/Face.tsx`
- `src/apn/useFaceApparition.ts`

**Modifiés**
- `src/apn/TopBar.tsx` — refonte responsive + visage `[APN]`
- `src/apn/Composer.tsx` — visage inline + cibles tactiles
- `src/apn/OrbCanvas.tsx` (ou wrapper dans `Index.tsx`) — overlay visage
- `src/apn/AsciiSidebarLeft.tsx` / `Right.tsx` — `hidden md:flex`
- `src/apn/AmbientChars.tsx` — densité mobile + injection visages
- `src/apn/ControlsDrawer.tsx` — toggle Visage APN, slider fréquence
- `src/apn/auth/Onboarding.tsx` / `Lock.tsx` — vidéo cap + scroll mobile
- `src/apn/ChatLog.tsx` / `MedicalReport.tsx` — full-screen mobile
- `src/pages/Index.tsx` — nouveau bandeau mobile compact, pixelRatio adaptatif
- `src/index.css` — utilitaires `tap-target`, animations clignement/fondu

**Pas touché**
- Backend / edge functions / DB / auth logique.

---

## Hors scope
- Refonte visuelle complète du design system.
- Visage 3D / WebGL avancé (on reste ASCII pour rester cohérent avec l'esthétique terminale).
- Multi-utilisateur, sync.

Une fois validé, j'implémente les deux axes en une passe.
