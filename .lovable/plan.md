# Plan — Commandes vocales & authentification biométrique

## 1. Commande vocale pour changer de mode

Détecter dans le texte transcrit (voix) ou tapé des phrases déclencheurs et basculer les modes sans passer par les boutons.

**Modes ciblés**
- `[MED]` Mode pré-médecin (on/off)
- `[LOG]` Ouvrir le journal
- `[CFG]` Ouvrir la config
- `[VOICE]` Activer/couper la voix d'APN
- `[POLISH]` Activer/couper l'auto-correction

**Phrases reconnues (FR + EN)**
- « APN, mode médecin » / « stop mode médecin »
- « ouvre le journal » / « ouvre les réglages »
- « coupe ta voix » / « parle moi »
- « active la correction » / « désactive la correction »
- Préfixe optionnel « APN, … » pour éviter les faux positifs

**Comportement**
- Nouveau module `src/apn/voiceCommands.ts` : fonction `matchCommand(text)` → renvoie `{ action, value }` ou `null`.
- Appel dans `Index.tsx` avant `handleSend` : si une commande est détectée, on l'exécute, on affiche un toast de confirmation et on **n'envoie pas** le message au LLM.
- Indicateur visuel discret dans `Composer` quand une commande est détectée en live (badge « ⌘ commande »).

## 2. Authentification biométrique (visage + voix)

Verrouiller l'accès à APN derrière une double biométrie locale, sans compte ni mot de passe.

### Enrôlement (1ère ouverture)
Écran `Onboarding` plein écran :
1. **Voix** : l'utilisateur prononce une phrase libre 2× → on capture l'empreinte vocale via ElevenLabs Voice (embedding) **ou** un fingerprint local (MFCC moyenné côté navigateur, fallback hors-ligne).
2. **Visage** : capture 3 photos via `getUserMedia` → embeddings via `face-api.js` (modèle TinyFaceDetector + FaceNet, chargés depuis `/models`).
3. Stockage **local uniquement** (`localStorage` chiffré via WebCrypto AES-GCM, clé dérivée d'un PIN à 4 chiffres choisi à l'enrôlement).

### Déverrouillage (à chaque ouverture)
Écran `Lock` :
- Caméra + micro actifs
- Match visage (similarité cosine ≥ 0.6) **ET** voix (≥ 0.75) → `unlocked = true` → app affichée.
- 3 échecs → fallback PIN.
- Bouton « Réinitialiser » (efface tout, demande confirmation).

### Confidentialité
- Aucune donnée biométrique n'est envoyée à un serveur (ni Cloud, ni ElevenLabs).
- Les embeddings sont des vecteurs numériques, pas des images.
- Bandeau RGPD au premier lancement.

## Détails techniques

**Nouveaux fichiers**
- `src/apn/voiceCommands.ts` — parser de commandes
- `src/apn/auth/Onboarding.tsx` — enrôlement
- `src/apn/auth/Lock.tsx` — écran de déverrouillage
- `src/apn/auth/biometry.ts` — capture, embeddings, comparaison cosine, chiffrement WebCrypto
- `src/apn/auth/useAuth.ts` — hook état (`locked` / `enrolled` / `unlock` / `reset`)
- `public/models/*` — poids face-api.js (TinyFaceDetector, FaceLandmark68Net, FaceRecognitionNet)

**Fichiers modifiés**
- `src/pages/Index.tsx` — gate `<Lock />` / `<Onboarding />` avant le rendu principal ; hook commandes vocales dans `handleSend`
- `src/apn/Composer.tsx` — badge « commande détectée »
- `package.json` — ajout `face-api.js`

**Dépendances**
- `face-api.js` (~6 Mo de modèles, chargés à la demande, mis en cache)
- WebCrypto (natif, pas d'install)

**Hors périmètre**
- Multi-utilisateurs (1 seul profil local)
- Sync cloud des biométries (volontairement absent)
- Auth Lovable Cloud / Supabase Auth (pas pertinent ici, app mono-utilisateur locale)
- Liveness detection avancée (anti-photo) — peut être ajouté plus tard via clignement des yeux

## Questions ouvertes
- OK pour stocker la biométrie **uniquement en local** (impossible de récupérer si appareil perdu) ?
- PIN 4 chiffres comme fallback OK, ou tu préfères pas de fallback du tout ?
- Le préfixe « APN, … » est-il obligatoire ou optionnel pour les commandes vocales ?
