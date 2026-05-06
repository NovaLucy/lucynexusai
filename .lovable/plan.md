# APN Nova — Agent Personnel Numérique

Une SPA React où un orbe plasma 3D représente un agent IA (APN). L'utilisateur dialogue par texte ou voix ; APN répond, parle, et se souvient des échanges.

## Stack & infrastructure

- React + TypeScript + Tailwind (déjà en place)
- **Lovable Cloud** (Supabase managé) pour la mémoire persistante
- **Lovable AI Gateway** via edge function sécurisée (modèle par défaut `google/gemini-3-flash-preview`) — la clé Anthropic n'est pas nécessaire, l'IA est servie par Lovable AI
- **Three.js** (`three` + `@react-three/fiber@^8.18` + `@react-three/drei@^9.122`) pour l'orbe plasma
- **Web Speech API** pour TTS (FR, autoSpeak ON par défaut) et STT (`fr-FR`)

## Backend (Lovable Cloud)

### Table `apn_memory`
```
id uuid pk, created_at timestamptz,
user_msg text, apn_msg text,
intent jsonb, meta jsonb,
session_id text
```
RLS activée — lecture/écriture publique anonyme limitée par `session_id` (pas d'auth dans cette V1, chaque visiteur a un session_id local stocké dans `localStorage` pour persister entre rechargements).

### Edge function `chat`
- Reçoit `{ messages: [...] }` (5 derniers + nouveau)
- Injecte le system prompt APN (ton humain, pas de phrases creuses, max 1 question, peut contredire, adapte au niveau de confiance)
- Appelle Lovable AI Gateway en **streaming SSE**
- Gère les erreurs 429 (rate limit) et 402 (crédits) avec messages clairs

## Logique métier (`useAPN` hook)

À l'envoi d'un message utilisateur, dans l'ordre :
1. **Réponses rapides locales** (sans LLM) :
   - Salutations (`bonjour`, `salut`, `hello`, `coucou`…) → "Bonjour. Sur quoi veux-tu avancer aujourd'hui ?"
   - Acquittements (`ok`, `merci`, `super`, `cool`…) → "OK. Dis-moi ce que tu veux faire ensuite."
   - Trop court (≤2 mots, sans ponctuation) → demande de clarification
2. Sinon → appel edge function `chat` en streaming, tokens rendus au fur et à mesure
3. Inférence d'humeur sur la réponse → mood ∈ `calm | empathetic | focused | alert`
4. Sauvegarde de l'échange dans `apn_memory`
5. TTS automatique (autoSpeak ON), découpé en chunks ≤170 chars

États agent : `standby → thinking → speaking → standby` (et `listening` quand le micro est actif).

## Composants UI

```
┌─────────────────────────────────────┐
│ ●Standby           [🎙️] [≡] [⚙]   │
│                                     │
│              ╭─────╮                │
│             │ ORBE │                │
│              ╰─────╯                │
│         "Je suis prêt."             │
│                                     │
│      ┌──────────────────┐ [→]      │
│      │  Parle-moi…       │          │
│      └──────────────────┘           │
└─────────────────────────────────────┘
```

- **`OrbCanvas`** — Three.js + ShaderMaterial avec le shader plasma fourni (FBM + sinusoïdes + filaments radiaux + halo). Energy interpolée selon l'état (standby 0.30, thinking 0.72, speaking 1.0, listening 0.5). Hue pilotée par mood (cyan / rose / violet / orange). Resize responsive, dispose au unmount.
- **`MicroHUD`** — badge état top-left avec dot coloré.
- **`ControlsDrawer`** — drawer (Sheet) à droite : toggle TTS, sélecteur voix FR-prioritaires, sliders vitesse/pitch/qualité/intensité plasma, boutons Test/Stop.
- **`ChatLog`** — panel flottant bas-droite togglable, bulles user (droite, bordure couleur mood) et bot (gauche, mono), auto-scroll.
- **`Composer`** — input centré bas, `min(560px, 92vw)`, focus ring couleur mood, bouton envoi + bouton micro (STT).
- **`useVoice`** — hook regroupant TTS (chunked) et STT (`SpeechRecognition` fr-FR).

## Direction visuelle

- Fond noir absolu `#03040a`, surfaces verre dépoli (`rgba(12,14,22,.42)` + blur)
- Fonts : **Syne** (display) + **JetBrains Mono** (corps / messages bot)
- Texte doux `rgba(231,234,240,.9)`, muted `rgba(154,163,178,.7)`
- Tout passe par des tokens HSL dans `index.css` + `tailwind.config.ts` (variables `--mood-*` mises à jour dynamiquement par JS pour propager la couleur courante aux bordures, focus, halo)
- Animations : respiration en standby, ondulations rapides en thinking, rayonnement max en speaking, micro-tremblements en listening

## Accessibilité

- `aria-live="polite"` sur le caption d'état
- `aria-label` sur tous les boutons icônes
- Fallback texte si Web Speech API indisponible (toast info)

## Ordre d'implémentation

1. Activer Lovable Cloud + créer table `apn_memory` (migration) + RLS
2. Edge function `chat` (streaming via Lovable AI Gateway)
3. Tokens design (CSS vars + Tailwind), fonts, fond noir
4. `useAPN` (états, humeur, réponses rapides, mémoire, streaming)
5. `OrbCanvas` (shader plasma)
6. `MicroHUD`, `Composer`, `ChatLog`, `ControlsDrawer`
7. `useVoice` (TTS auto + STT)
8. Assemblage dans `pages/Index.tsx`

## Notes techniques

- Pas de clé API exposée côté client — tout passe par l'edge function
- `session_id` stocké dans `localStorage` pour persister la mémoire entre sessions
- Au mount : charger les 5 derniers échanges du `session_id` courant comme contexte
- TTS ON par défaut ; toggle dans le drawer persisté en `localStorage`
