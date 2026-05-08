# Améliorer le visage APN

Le visage actuel est mono-ligne et statique. On le transforme en **compagnon vivant** : expressif, cinématique dans l'orbe, et interactif dans la TopBar et le Composer.

---

## 1. Refonte de `Face.tsx` — plus expressif & animé

### Composition multi-lignes (ASCII art)
Au lieu d'une seule ligne `( ◉ ◡ ◉ )`, le visage devient un mini ASCII art à 3 lignes :

```text
   ╭─────╮
   │◉ ◡ ◉│
   ╰──◡──╯
```

Avec des variantes par taille :
- `xs` (TopBar/Composer) : reste 1 ligne `(◉◡◉)` pour rester compact
- `sm` : 3 lignes compactes
- `md`/`lg` (orbe) : 5-7 lignes avec contour, sourcils, bouche animée

### Catalogue d'expressions enrichi
Pour chaque `mood` × `state`, on définit :
- **eyes** (gauche/droit séparés pour asymétrie possible)
- **brows** (sourcils : `‾`, `╱╲`, `__`, vide)
- **mouth** (états : `◡`, `○`, `─`, `◯`, `^`, `v`, séquence parlante `▁▂▃▂▁`)

Exemples :
- `calm` : sourcils neutres, yeux `◉◡◉`, bouche `◡`
- `focused` : sourcils froncés `╲ ╱`, yeux `◉─◉`, bouche `─`
- `alert` : sourcils hauts `‾ ‾`, yeux `⊙_⊙`, bouche `○`
- `empathetic` : sourcils inclinés `╲╱`, yeux `♡◡♡`, bouche `◡`

### Micro-mouvements
- **Clignement asymétrique** : 15% de chance de cligner d'un seul œil (clin d'œil)
- **Saccades oculaires** : pendant `idle`, les yeux regardent à gauche/droite/haut aléatoirement (`◐◉`, `◉◑`, `◔◔`)
- **Bouche parlante** : pendant `state === "speaking"`, la bouche s'anime en boucle `─ → ○ → ◯ → ○ → ─` (60-120ms par frame)
- **Respiration** : très léger `scale` CSS (1 → 1.02 → 1) sur 4s en boucle pour donner vie
- **Réaction au mood en temps réel** : transition CSS douce quand le mood change (fade des yeux 200ms)

### Nouveau prop `speaking?: boolean`
Déclenche l'animation de bouche peu importe le `state`.

---

## 2. Visage cinématique dans l'orbe

Actuellement `useFaceApparition` affiche un visage `xs` flou. On muscle :

### Hook `useFaceApparition` enrichi
- Variants d'apparition : `peek` (court, petit, latéral), `full` (grand, centré, 4s), `glitch` (multi-frames rapide)
- Probabilité de `full` augmente après une réponse longue de l'IA (déjà détectable via `state === "speaking"` + durée)

### Overlay orbe
- Le `<Face variant="overlay" size="lg" />` au centre de l'orbe affiche maintenant le visage **multi-lignes complet**, ~80-120px, avec :
  - Drop-shadow mood plus prononcé
  - Légère distorsion CRT (utilise `.scanlines` existant)
  - Animation d'entrée : ASCII se compose ligne par ligne (typewriter, 80ms/ligne) puis se dissout en glyphes flottants
  - Animation de sortie : explose en particules (réutilise le système `AmbientChars`)
- Quand l'IA `speaking` longtemps, le visage reste affiché en permanence avec bouche animée (mode "présence active")

### Trigger interactif
- Au tap/clic sur l'orbe → fait apparaître le visage immédiatement avec un clin d'œil (déjà un orbe tactile, on ajoute le hook)

---

## 3. TopBar — visage permanent et vivant

Aujourd'hui : `<Face xs blink />` à côté de `[APN]`.  
Refonte :
- Le visage **remplace complètement** le texte `[APN]` (plus besoin du double affichage)
- Animation continue : clignements + micro-saccades oculaires toutes les 5-10s
- Réagit au `state` global :
  - `listening` → bouche `○`, pulse mood
  - `thinking` → yeux qui pannent `◐.◑ ↔ ◑.◐` (déjà là, on accélère)
  - `speaking` → bouche qui s'anime
  - `idle` → respiration douce
- Tap sur le visage → ouvre un mini-dialogue (toast) avec le mood actuel + dernière action

---

## 4. Composer — visage réactif

Aujourd'hui : `<Face xs />` quand l'utilisateur tape.  
Refonte :
- Visage à gauche du textarea, **toujours visible** (pas seulement quand on tape)
- Réagit en temps réel :
  - Tape rapidement → yeux suivent le rythme (`◉ ◉` → `◔ ◔` → `◉ ◉`)
  - Mic actif → yeux `( ◉ ◡ ◉ )` + bouche `○` qui pulse
  - Message envoyé → clin d'œil rapide + sourire `( ^ ◡ ^ )` 1s
  - Réponse IA en cours (`speaking`) → bouche qui parle en synchro
  - Erreur → expression `alert` 2s puis retour
- Petite hitbox tactile (44px) → tap sur visage = focus textarea

---

## 5. Réglages (`ControlsDrawer`)

L'option "Visage APN" existe déjà avec fréquences. On ajoute :
- **Style** : `Compact` (1 ligne) / `Expressif` (multi-lignes) / `Cinématique` (full ASCII art dans orbe)
- **Animations** : toggle micro-mouvements (respiration, saccades) on/off pour les utilisateurs sensibles au mouvement
- Persisté `localStorage` (`apn:face:style`, `apn:face:micro`)

---

## Fichiers touchés

**Modifiés**
- `src/apn/Face.tsx` — refonte complète : multi-lignes, sourcils, bouche animée, clignements asymétriques, saccades, respiration
- `src/apn/useFaceApparition.ts` — variants `peek`/`full`/`glitch`, déclenchement par speaking long
- `src/apn/TopBar.tsx` — visage remplace `[APN]`, réactif au state, tap → toast mood
- `src/apn/Composer.tsx` — visage permanent à gauche, réactions au typing/mic/send/speaking/error
- `src/apn/OrbCanvas.tsx` (ou wrapper Index) — overlay multi-lignes, animation typewriter d'entrée
- `src/apn/ControlsDrawer.tsx` — options Style + micro-animations
- `src/index.css` — keyframes : `face-breath`, `face-typewriter`, `mouth-talk`, `face-wink`
- `src/pages/Index.tsx` — passer `speaking` & last-error au Composer/Face

**Pas touché**
- Backend, DB, edge functions, auth, mobile layout (déjà fait dans la passe précédente)

---

## Hors scope
- Visage 3D / WebGL
- Synchronisation labiale réelle sur l'audio TTS (on simule avec un cycle de bouche)
- Émotions générées par IA (on garde le mapping `mood`/`state` actuel)

Une fois validé, j'implémente d'une seule passe.
