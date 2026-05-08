## Objectif
Garder l'idée du visage Matrix qui révèle un visage réaliste, mais le rendre **bien plus présent et spectaculaire au tap**, avec une **animation de transition** quand il apparaît/disparaît, et **améliorer l'intelligence d'APN** (mémoire + qualité conversationnelle).

---

## 1. Visage accentué au clic — `FaceMatrix.tsx` + `Index.tsx`

### Mode "REVEAL" (déclenché au tap sur l'orbe)
- Nouveau prop `intensity: "ambient" | "reveal"` sur `FaceMatrix`.
- En `reveal` : visage **2× plus visible** (luminance boostée `Math.pow(lum, 0.6) * 1.6`), trail plus long (24 au lieu de 14), densité de glyphes doublée temporairement, vignette plus serrée.
- **Pulsation circulaire** : onde de glyphes qui irradie depuis le centre du visage au moment du tap (calcul de distance radiale, glyphes plus brillants sur la crête de l'onde qui s'éloigne en 800ms).
- **Saturation mood ↑** : couleur du mood très saturée pendant 1.5s puis retombe.

### Animation de transition (apparition / disparition)
- Nouvelle keyframe `face-reveal` dans `index.css` : 
  - 0% → opacity 0, scale 0.7, blur(12px)
  - 20% → opacity 1, scale 1.05, blur(0) — *flash*
  - 100% → opacity 1, scale 1, blur(0)
- Et `face-vanish` symétrique : scanlines qui se contractent, opacité qui chute avec un petit "glitch" (translate horizontal aléatoire 2px sur 200ms).
- Au tap : haptique `tapMedium()` + remplacement de la classe `face-apparition` par `face-reveal`.
- Quand le visage disparaît : applique `face-vanish` 400ms avant le démontage (via état local `phase: "in" | "hold" | "out"`).

### Tap qui amplifie
- `triggerFace(2200)` devient `triggerFace(3200, "reveal")` — durée plus longue + mode reveal.
- Apparitions ambiantes spontanées restent en mode `ambient` (subtiles, comme aujourd'hui).
- Pendant que l'IA parle (`pinned`), le visage reste en mode `reveal` doux (entre les deux).

---

## 2. Intelligence d'APN — `supabase/functions/chat/index.ts` + `useAPN.ts`

### Modèle plus puissant par défaut
- Passer de `google/gemini-3-flash-preview` à `google/gemini-3.1-pro-preview` (raisonnement nettement meilleur), avec fallback automatique sur flash si 429/timeout.

### Mémoire conversationnelle élargie
- Inclure les **20 derniers messages** dans le contexte au lieu de la fenêtre actuelle (vérifier la limite côté `useAPN`).
- Ajouter un résumé glissant : avant chaque appel, si `messages.length > 30`, injecter un bloc `## Résumé des échanges précédents` (généré une fois via le LLM en arrière-plan et caché sur `profile.summary`).

### Prompt système enrichi
- Ajouter une section **« Comment penser »** qui demande à APN de :
  - Identifier l'intention réelle (besoin émotionnel vs. info vs. action) avant de répondre.
  - Faire des liens explicites avec ce qu'il sait (`profile.traits`, `open_loops`, dernier sujet) quand c'est pertinent.
  - Proposer parfois (10% des tours) une observation spontanée, une question qui ouvre un angle nouveau, ou un rappel d'un sujet ouvert.
- Ajouter règle : « Si la personne semble bloquée, propose un mini-cadre de réflexion en 2 lignes (pas une liste). »

### Reasoning activé
- Dans le body de l'appel : `reasoning: { effort: "low" }` pour les pro/preview models — meilleure cohérence sans trop de latence.

### Détection d'humeur côté backend
- Le backend renvoie en plus du texte un header SSE `x-apn-mood-suggest` (calculé via heuristique sur la réponse) → `useAPN` peut affiner le mood et donc la couleur du visage Matrix réagit plus juste.
  - *Optionnel si trop intrusif : on garde l'inférence côté client.*

---

## 3. Détails techniques

```text
Tap orb
   │
   ▼
triggerFace(3200, "reveal") ──► useFaceApparition phase="in"
   │
   ▼
FaceMatrix monté avec intensity="reveal"
   │
   ├─ CSS face-reveal (0→200ms): scale + blur + flash
   ├─ JS shockwave (0→800ms): onde radiale dans le rendu canvas
   ├─ hold (200→2800ms): visage stable boosté
   └─ face-vanish (2800→3200ms): glitch + fade
```

### Fichiers touchés
- `src/apn/FaceMatrix.tsx` — props `intensity`, `phase`, shockwave
- `src/apn/useFaceApparition.ts` — accepter un `mode: "ambient" | "reveal"` mémorisé, exposer `phase`
- `src/pages/Index.tsx` — passer le mode au tap, brancher `tapMedium()`
- `src/index.css` — keyframes `face-reveal`, `face-vanish`
- `supabase/functions/chat/index.ts` — modèle + reasoning + section "Comment penser" + résumé
- `src/apn/useAPN.ts` — fenêtre de 20 messages + envoi du résumé

### Hors scope
- Pas de TTS amélioré, pas de vrai lipsync, pas de webcam.
- Pas de nouvelle table — résumé stocké dans `profiles.traits.summary` existant.
