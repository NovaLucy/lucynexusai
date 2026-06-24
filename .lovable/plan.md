# Export complet du projet Lucy

## Objectif
Produire une archive autonome contenant **tout le code source utile** + une **documentation d'architecture** pour reprendre le travail sur Claude (ou tout autre IDE/IA) sans dépendre de Lovable.

## Livrables (dans `/mnt/documents/lucy-export/`)

1. **`lucy-source.zip`** — archive du code complet, hors bruit
   - Inclus : `src/`, `supabase/functions/`, `supabase/migrations/`, `public/`, `index.html`, `package.json`, `bun.lockb`, `vite.config.ts`, `tailwind.config.ts`, `tsconfig*.json`, `postcss.config.js`, `eslint.config.js`, `components.json`, `capacitor.config.ts`, `.env.example` (clés publiques uniquement, secrets masqués), `README.md`.
   - Exclus : `node_modules/`, `.git/`, `.lovable/`, `.workspace/`, `dist/`, `.env` réel.

2. **`ARCHITECTURE.md`** — carte mentale du projet
   - Stack (React 18 + Vite + TS + Tailwind + shadcn + R3F + Supabase).
   - Arborescence commentée de `src/apn/` (rôle de chaque fichier : `useAPN`, `useVoice`, `usePresence`, `useWakeWord`, `useReality`, `MoodBubble`, `VolumetricFace`, etc.).
   - Schéma de flux : Webcam → `usePresence` → `gazeX/Y` → `MoodBubble`. Mic → `nativeVoice`/`useVoice` → `useAPN` → Edge `chat` → TTS.
   - Liste des Edge Functions (`chat`, `apn-medical`, `memory-extract`, `memory-recall`, `text-polish`, `elevenlabs-*`, `profile-update`) avec rôle et entrées/sorties.
   - Tables DB + RLS (extrait des migrations).

3. **`FEATURES.md`** — état actuel des fonctionnalités
   - Orbe matière noire (humeurs, états, mode médical, suivi visage).
   - Voix : STT natif + fallback, TTS forcé Web (ElevenLabs bloqué).
   - Wake-word "Lucy", push-to-talk long-press, turn-taking 6s.
   - Mémoire vivante (embeddings/recall), Pré-médecin V2, profil utilisateur.
   - Auth désactivée (routes `/auth` et `/welcome` redirigent vers `/`).

4. **`KNOWN_ISSUES.md`** — points à reprendre
   - `usePresence.ts` : `faceApiAvailable || true` à nettoyer.
   - `Index.tsx` importe `MoodBubble` sous l'alias `VolumetricFace` (fichier `VolumetricFace.tsx` non utilisé).
   - Clé ElevenLabs bloquée → `FORCE_WEB_FALLBACK = true`.
   - Auto-sleep 25s absence + 20s inactivité à valider.

5. **`SETUP.md`** — démarrage hors Lovable
   - `bun install` / `npm install`.
   - Variables à fournir dans `.env` (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID).
   - Secrets Edge Functions à recréer côté Supabase (LOVABLE_API_KEY, ELEVENLABS_API_KEY).
   - `bun run dev`.

## Détails techniques

- Génération via un script bash unique exécuté dans la sandbox : `zip -r` avec liste d'exclusions, puis écriture des `.md` à partir d'une lecture ciblée des fichiers clés.
- L'archive sera mise à disposition sous `/mnt/documents/lucy-export/lucy-source.zip` + dossier `docs/` lisible directement.
- Aucune modification du code projet — opération en lecture seule + écriture hors repo.

## Question avant de lancer
Veux-tu que j'inclue aussi :
- (a) un dump SQL du schéma actuel via `supabase--read_query` (utile si tu veux migrer la DB ailleurs), ou
- (b) seulement les fichiers de migration tels quels (plus léger) ?

Par défaut je pars sur **(b)**.
