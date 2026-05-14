## Direction retenue

**Onde — Sora (titres) + Manrope (corps)** · traitement **Immersif**

L'idée : tout le **chrome** de Lucy (statuts, boutons, en-têtes drawers, journal, réglages) passe en typo spatiale avec micro-glow couleur humeur et tracking étiré. Les **bulles de conversation** restent en Manrope doux pour la lisibilité — pas de glow sur le contenu lu, seulement sur les habillages.

## Changements

### 1. Polices (chargement)
- `index.html` : remplacer le bundle Google Fonts actuel (Syne + JetBrains Mono) par **Sora 300/400/600** + **Manrope 300/400/500/600** (avec `display=swap`, preconnect conservé).
- Garder JetBrains Mono uniquement pour les zones strictement techniques (timestamps, IDs de session) si nécessaire — sinon supprimer.

### 2. Tokens typo (`tailwind.config.ts` + `src/index.css`)
- Ajouter dans `theme.fontFamily` :
  - `display: ['Sora', 'system-ui', 'sans-serif']`
  - `sans: ['Manrope', 'system-ui', 'sans-serif']`
  - `hud: ['Sora', 'system-ui', 'sans-serif']` (alias pour le chrome)
- Variables CSS dans `:root` :
  - `--font-display`, `--font-body`, `--font-hud`
  - `--track-hud: 0.28em` (tracking large pour labels)
  - `--track-title: 0.04em`

### 3. Classes utilitaires « matière noire » pour le texte (`src/index.css`)
- `.hud-label` : Sora 300, MAJUSCULES, `letter-spacing: 0.28em`, taille 10–11 px, `color: hsl(var(--foreground)/0.55)`, micro `text-shadow: 0 0 12px hsl(var(--mood)/0.18)`.
- `.hud-title` : Sora 400, taille 13–15 px, tracking léger, glow puls­é doux (animation `glow-pulse 4s ease-in-out infinite`).
- `.dm-text` (dark-matter text) : dégradé subtil `background: linear-gradient(180deg, hsl(var(--foreground)/0.95), hsl(var(--foreground)/0.7)); -webkit-background-clip: text;` + `text-shadow: 0 0 10px hsl(var(--mood)/0.15)` — pour les titres de drawer / sections.
- `.chat-text` : Manrope 400, line-height 1.55, **pas de glow** — lisibilité avant tout.
- Keyframe `glow-pulse` : amplitude faible (0.10 → 0.22 sur l'opacité du shadow).

### 4. Application aux composants
- **Status bars / HUD** (`MicroHUD.tsx`, `Subtitles.tsx`, `HintLine.tsx`, `SyncIndicator.tsx`, `TopBar.tsx`) → `.hud-label` ou `.hud-title`.
- **Journal** (`ChatLog.tsx`) → en-tête en `.dm-text`, métadonnées (timestamps, rôles) en `.hud-label`, contenu des messages en `.chat-text`.
- **Réglages** (`ControlsDrawer.tsx`) → titre du drawer en `.dm-text`, libellés de sections en `.hud-label`, valeurs et descriptions en `.chat-text`.
- **Composer** (`Composer.tsx`) → placeholder en `.hud-label` faible opacité, input en Manrope.
- **Menu flottant** (`Index.tsx` top-right + bouton journal top-left) → entrées en `.hud-label`.
- **Boutons** (`.ghost-btn` quand ils portent du texte → ex. « Écrire » sur le FAB clavier) → `.hud-label`.
- **`Onboarding3` / `FirstRunIntro.tsx`** → titre en `.dm-text`, items en `.chat-text`.
- **Subtitles** (ce que Lucy dit) → Manrope 300, italique léger, **pas de mono** — la voix doit respirer.

### 5. Garde-fous lisibilité
- Bulles de chat et long texte : **jamais** en mono ni en MAJUSCULES.
- Glow plafonné à `0.22` opacité max pour ne pas baver sur fond sombre.
- Tracking large uniquement sur libellés ≤ 3 mots.

## Fichiers touchés

- `index.html` (polices)
- `tailwind.config.ts` (`fontFamily`)
- `src/index.css` (variables, `.hud-label`, `.hud-title`, `.dm-text`, `.chat-text`, keyframes)
- `src/apn/MicroHUD.tsx`, `Subtitles.tsx`, `HintLine.tsx`, `SyncIndicator.tsx`, `TopBar.tsx`
- `src/apn/ChatLog.tsx`
- `src/apn/ControlsDrawer.tsx`
- `src/apn/Composer.tsx`
- `src/apn/FirstRunIntro.tsx`
- `src/pages/Index.tsx` (menus flottants, FAB « Écrire », bouton journal)

Pas de changement de logique métier — purement typographie + classes.

Dis-moi « go » et j'enchaîne.
