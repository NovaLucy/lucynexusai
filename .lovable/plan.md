## Plan d'améliorations APN

Trois axes : **fiabiliser la voix**, **corriger en direct**, et **ouvrir un volet "pré-médecin"** pour collecter et restituer des informations de santé en vue d'une consultation humaine.

---

### 1. STT serveur fiable (ElevenLabs Realtime)

Remplacer la Web Speech API du navigateur (qui plante en `network`) par **ElevenLabs Scribe Realtime** via WebSocket.

- Nouvelle edge function `elevenlabs-scribe-token` qui génère un token single-use côté serveur (clé `ELEVENLABS_API_KEY` à demander).
- Refonte de `src/apn/useVoice.ts` autour du hook `useScribe` du SDK `@elevenlabs/react` :
  - `commitStrategy: "vad"` → détection de silence native, envoi auto.
  - `onPartialTranscript` → texte live dans le composer.
  - `onCommittedTranscript` → déclenche l'envoi.
  - Détection de langue auto (FR/EN) côté modèle.
- Suppression du fallback Web Speech API (gardé en secours uniquement si pas de clé).

### 2. Auto-correction & ponctuation IA en direct

Edge function `text-polish` (Lovable AI, `google/gemini-3-flash-preview`) qui :
- Corrige fautes d'orthographe/grammaire.
- Ajoute la ponctuation et les majuscules.
- Préserve le sens, ne reformule pas.

Intégration dans `Composer.tsx` :
- **Pendant la dictée** : debounce 400 ms sur le texte interim → appel polish → réécriture du composer (animation discrète "✨ correction…").
- **Saisie clavier** : même hook, déclenché sur pause de frappe (>700 ms).
- Toggle on/off dans `ControlsDrawer` (préférence persistée `localStorage`).

### 3. Module "Pré-médecin" (santé)

Nouveau mode "Santé" activable depuis la `TopBar` (badge `MED`).

**Collecte structurée**
- Quand le mode est actif, l'IA (prompt système dédié dans une nouvelle edge function `apn-medical`) extrait à chaque message un JSON : `symptômes`, `durée`, `intensité (0-10)`, `antécédents`, `traitements en cours`, `allergies`, `signes d'alerte`.
- Stockage dans une nouvelle table `apn_health_records` liée à `session_id`.

**Restitution pour consultation humaine**
- Bouton "📋 Compte-rendu" dans le drawer → génère un résumé médical structuré (motif, anamnèse, antécédents, drapeaux rouges, hypothèses non-diagnostiques) au format markdown.
- Export `.pdf` ou copie presse-papier pour apporter au médecin.
- Détection automatique de **drapeaux rouges** (douleur thoracique, dyspnée aiguë, etc.) → bandeau rouge "⚠ Consulter en urgence".

**Disclaimer permanent** : "APN n'est pas un médecin. Ces informations sont une aide à la préparation, pas un diagnostic."

---

### Détails techniques

**Schéma DB (migration)**
```sql
create table public.apn_health_records (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  created_at timestamptz not null default now(),
  symptoms jsonb not null default '[]',
  duration text,
  intensity int,
  history jsonb not null default '[]',
  medications jsonb not null default '[]',
  allergies jsonb not null default '[]',
  red_flags jsonb not null default '[]',
  raw_text text
);
alter table public.apn_health_records enable row level security;
create policy "anyone read"   on public.apn_health_records for select using (true);
create policy "anyone insert" on public.apn_health_records for insert with check (true);
```

**Edge functions à créer**
- `elevenlabs-scribe-token` — token STT realtime.
- `text-polish` — correction live (Lovable AI, JSON tool-call `{ corrected: string }`).
- `apn-medical` — extraction structurée + génération du compte-rendu.

**Secret requis** : `ELEVENLABS_API_KEY` (sera demandée à l'approbation du plan).

**Fichiers front modifiés**
- `src/apn/useVoice.ts` — réécriture autour de `useScribe`.
- `src/apn/Composer.tsx` — hook polish + indicateur live.
- `src/apn/TopBar.tsx` — toggle mode Santé.
- `src/apn/ControlsDrawer.tsx` — toggles correction / mode Santé / bouton compte-rendu.
- `src/pages/Index.tsx` — branchement mode Santé + flux extraction.
- Nouveau `src/apn/MedicalReport.tsx` — affichage + export du compte-rendu.

---

### Hors scope (à voir plus tard)
- Authentification utilisateur (le mode Santé reste en `session_id` anonyme pour l'instant).
- Synchronisation multi-appareil.
- Carnet de suivi longitudinal.
