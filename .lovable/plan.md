## Objectif

Faire en sorte que l'œil de Lucy suive **réellement** la position du visage de l'utilisateur, capté par la webcam, et plus seulement la souris ou une heuristique de mouvement.

## État actuel

- `usePresence.ts` ouvre déjà la caméra frontale et calcule un `gazeX/gazeY`.
- Mais il ne fonctionne **vraiment** que sur Chrome desktop (API native `window.FaceDetector`). Sur Safari, iOS, Firefox → simple détection de mouvement, **sans coordonnées de visage**, donc l'œil ne suit pas.
- Le suivi est aussi désactivé par défaut (toggle dans les Réglages).
- `VolumetricFace.tsx` consomme déjà `gazeX/gazeY` correctement — rien à toucher côté rendu.

## Ce qu'on va faire

### 1. Détection de visage universelle via MediaPipe
- Ajouter `@mediapipe/tasks-vision` (léger, WebAssembly, fonctionne sur tous les navigateurs modernes y compris Safari iOS).
- Charger le modèle `FaceLandmarker` (ou `FaceDetector` plus léger) une seule fois, depuis le CDN officiel.
- Cible : ~15 fps de détection (largement suffisant pour un regard fluide), GPU si disponible.

### 2. Réécriture de `usePresence.ts`
- Pipeline unifié :
  1. `FaceDetector` natif si dispo (rapide, zéro téléchargement).
  2. Sinon MediaPipe (fallback robuste partout).
  3. Sinon heuristique de mouvement (filet de sécurité).
- Calcule un `gazeX/gazeY` normalisé `-1..1` à partir du centre du visage relatif au cadre, en miroir (caméra frontale).
- Léger smoothing au niveau du hook pour absorber le bruit de détection.

### 3. Activation par défaut + UX
- Activer le suivi automatiquement au premier lancement (avec demande de permission caméra propre).
- Si refusé → l'œil retombe doucement au centre, pas d'erreur bloquante.
- Garder le toggle dans `ControlsDrawer` pour pouvoir le couper.
- Pause auto quand l'onglet est en arrière-plan (déjà fait, à conserver).

### 4. Performance
- Vidéo cachée 320×240, downscale à 192×144 pour la détection.
- Détection en `requestVideoFrameCallback` quand dispo, sinon `requestAnimationFrame` throttlé à 60 ms.
- Libération complète du stream et du modèle quand désactivé.

## Détails techniques

- Dépendance : `@mediapipe/tasks-vision` (≈ 2 Mo WASM chargé à la demande).
- Aucun changement nécessaire dans `VolumetricFace.tsx` / `MoodBubble.tsx` : ils reçoivent déjà `gazeX/gazeY`.
- Aucun appel réseau côté backend, aucune image n'est envoyée — tout reste local dans le navigateur.

## Hors scope

- Pas de eye-tracking pupillaire (trop lourd, pas nécessaire).
- Pas de reconnaissance d'identité.
- Pas de capture/stockage d'images.
