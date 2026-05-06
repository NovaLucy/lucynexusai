# Brume douce — orb volumétrique par humeur

Objectif : remplacer le shader plasma actuel de `src/apn/OrbCanvas.tsx` par une **brume volumétrique douce** qui ressemble aux 4 images de référence (calm/empathetic/focused/alert), avec couleurs pilotées par l'humeur en temps réel.

## Rendu visé (par humeur)

- **calm** — cyan/aqua, volutes lentes, méditatif
- **empathetic** — rose poudré / lavande, chaleureux
- **focused** — violet/indigo, cœur blanc lumineux, spirale concentrée
- **alert** — ambre / orange brûlé, pulsations vives

Aucune image n'est embarquée : tout est procédural (FBM + domain warp), donc instantané et léger.

## Modifications

### 1. `src/apn/OrbCanvas.tsx` — nouveau fragment shader

Remplacer entièrement le `FRAG` actuel par une brume volumétrique :

- **Masque sphérique très doux** : `smoothstep` large (rayon 0.0 → 1.1), aucun bord net, fondu progressif vers le noir
- **Brume volumétrique** : 5 octaves de FBM avec **domain warp auto-advecté** (`p += warp(p, t*0.15)`) → volutes organiques type fumée
- **Cœur lumineux** : noyau gaussien blanc (`exp(-r*r*6)`) qui s'intensifie avec `uEnergy` — particulièrement visible en mode `focused`
- **Particules / bokeh** : couche de hash multi-échelle, seuil élevé → points lumineux flous autour de l'orbe
- **Couleurs par humeur** :
  - 2 teintes HSV par mood (sombre + claire), mélangées par la densité de brume
  - palette dérivée de `uHue` (déjà fourni par `MOOD_HUE`) avec offsets adaptés
  - rim léger angle-based pour iridescence subtile
- **Animation** :
  - vitesse de base lente (`t * 0.12`)
  - en mode `alert` : tremblement haute fréquence + pulse plus rapide
  - en mode `focused` : rotation lente du domain warp (effet spirale)
- **Alpha** : `densité * masque_sphère`, fade très doux sur les bords (pas de halo dur)

### 2. Conserver

- structure React/Three.js (uniforms, animation loop, resize, lerp énergie/teinte)
- `pixelRatioCap = 4` (4K)
- types `AgentState` / `Mood` et `MOOD_HUE` (`src/apn/types.ts`) — inchangés
- `src/apn/mood.ts` — inchangé (CSS vars d'accent)

### 3. Aucun changement ailleurs

Pas de nouveau fichier, pas d'asset, pas de dépendance. Uniquement le shader dans `OrbCanvas.tsx`.

## Détails techniques

```text
fragment pipeline:
  uv → p (-1..1)
  ─ sphere mask (smoothstep doux)
  ─ warp = vec2(fbm(p+t), fbm(p-t)) * 0.6
  ─ density = fbm(p*1.3 + warp, 5 octaves)
  ─ core = exp(-r²*6) * uEnergy
  ─ bokeh = pow(hash(p*8 + t*0.1), 14) * 1.5
  ─ color = mix(moodDark, moodLight, density) + core*white + bokeh*tint
  ─ alpha = (density*0.7 + core*0.9 + bokeh*0.4) * sphereMask
```

Coût GPU : ~5 octaves FBM + warp = OK 60fps mobile à `pixelRatioCap=4` (sphère couvre une petite zone).

## À valider

Cette proposition garde **un seul shader unifié** qui s'adapte aux 4 moods via `uHue`. Si tu préfères 4 presets visuellement très différents (ex. focused = vraie spirale, alert = vraies pulsations radiales), dis-le et je découpe le shader en branches `if (uMood == ...)` plus marquées.
