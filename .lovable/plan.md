## Objectif

Pousser `NeuronCore` vers un rendu de tissu cérébral vivant : dendrites épaisses et myélinisées, soma organique pulsé, flashs synaptiques, et interactivité directe (souris/clic) — ambiance plus chaude et organique. Performance non prioritaire.

## 1. Réalisme neuronal (centre)

**Dendrites épaisses & myélinisées** (`NeuronCore.tsx`)
- Remplacer `LineSegments` par des **tubes** : pour chaque branche, générer une `TubeGeometry` à partir d'une `CatmullRomCurve3` lissée des points existants.
- Rayon variable : épais à la base (~0.025), s'affine vers la pointe (~0.005) — passé en attribut `aRadius` ou via taper dans la curve.
- Shader tube : gaine de myéline (bandes claires périodiques le long de l'axe avec `fract(vU * N)`), cœur plus sombre, fresnel sur les bords pour effet 3D charnu.
- Garder un fallback `LineSegments` très fin en additive par-dessus pour la lueur.

**Soma organique**
- Remplacer la sphère lisse par un mesh icosaèdre (subdiv 5) déplacé par bruit FBM 3D dans le vertex shader (déformation lente, amplitude qui respire avec `uPulse`).
- Membrane semi-translucide : fresnel chaud (rouge-ambre vers le rim), cœur lumineux qui bat en sinus (rythme cardiaque ~1.2Hz au repos, ~3Hz en speaking).
- Ajouter un noyau interne (petite sphère plus brillante) visible par transparence.

**Flashs synaptiques aux terminaisons**
- Étendre le pool de pulses : quand `p.t` atteint 1 (arrivée à la terminaison), déclencher un **flash** (sprite point taille x4, vie ~250ms, fade) à la position du bouton synaptique.
- Géométrie supplémentaire `flashGeom` (Points) avec attribut `aLife` mis à jour côté CPU.
- Couleur du flash = couleur chaude mood + blanc saturé au pic.

**Bruit organique global**
- Ajouter `glow volumétrique` : sphère externe r=1.8 avec shader noise FBM lent qui simule de la matière nerveuse en suspension (très faible alpha, additive).

## 2. Interactivité directe

**Parallaxe au mouvement souris** (`NeuronCore.tsx`)
- `onPointerMove` sur le `<Canvas>` : stocker `mouseX/mouseY` normalisés (-1..1) dans une ref.
- Dans `useFrame`, lerp `groupRef.rotation.y/x` vers `mouse * 0.35` en plus de la rotation auto. Sensation que le réseau "regarde" le curseur.

**Déformation locale**
- Passer la position souris monde (raycast plan z=0) en uniform `uMouse` au shader des tubes.
- Vertex shader : déplace légèrement les points proches de `uMouse` (gauss falloff, amplitude ~0.08) — donne l'impression que le tissu se déforme sous le doigt.

**Onde de choc au clic**
- `onPointerDown` : enregistrer `clickPos` + `clickTime` dans uniforms `uShockPos`, `uShockTime`.
- Dans le shader des tubes et du shader pulse : booster intensité et déplacement radial pour les points dont `distance(vPos, uShockPos) ≈ (now - clickTime) * speed`. Anneau lumineux qui se propage.
- En plus : forcer ~30 nouveaux pulses à spawner (t=0) sur les paths les plus proches du clic — vague d'activité visible sur les dendrites concernées.

## 3. Ambiance plus organique / vivante

**Palette `MOOD_HSL`** (`src/apn/types.ts` ou `index.css` selon où c'est défini — à vérifier)
- Décaler les teintes vers chaud : ambre/rouge brique pour le cœur (color2), rose-violet tissu pour les extrémités (color). Saturation +10%, luminance soma +15%.

**Brume volumétrique** (Canvas)
- Ajouter `<fog attach="fog" args={[hexBg, 3.5, 8]} />` couleur sombre chaude — donne profondeur et atténue les dendrites lointaines naturellement.

**Halo respirant**
- Halo actuel : remplacer `MeshBasicMaterial` par un shader radial gradient chaud + bruit subtil, opacité modulée par `uPulse` ET sinusoïde lente indépendante.

## 4. Détails techniques

```text
Géométries:
  somaCore       Icosahedron(0.28, 5)  + custom shader (FBM displace + fresnel)
  somaNucleus    Sphere(0.12, 32)       additive bright
  halo           Sphere(0.7, 48)        radial shader
  dendrites      ~180 TubeGeometry merged en BufferGeometry unique
  dendritesGlow  LineSegments fines     additive (existant retravaillé)
  pulses         Points × 380           shader existant amélioré
  terminals      Points × ~180          shader existant
  flashes        Points × 64 pool       nouveau, vie courte
  volumeNoise    Sphere(1.8, 32)        shader noise très faible alpha

Uniforms ajoutés:
  uMouse vec3, uShockPos vec3, uShockTime float, uTime float (existant)
```

**Fichiers touchés**
- `src/apn/agi/NeuronCore.tsx` — refonte majeure (tubes, soma organique, interactions, flashs)
- `src/apn/types.ts` — ajustement palette MOOD_HSL vers chaud (si exposé là)

**Pas d'install** — tout fonctionne avec `three` et `@react-three/fiber` déjà présents (`TubeGeometry`, `CatmullRomCurve3`, `Raycaster` font partie de three core).

## Hors scope

- Audio-réactivité (FFT voix) — gardé pour une prochaine itération
- Optimisations mobile / instancing GPU — explicitement non prioritaire
- Refonte UI conversation (composer, chat) — non sélectionné
