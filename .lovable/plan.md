## Objectif

Trois axes pour rendre APN plus vivant :
1. **Émotionnel** — lecture plus fine de l'état affectif et réponses plus incarnées.
2. **Personnalité propre** — APN développe des traits de caractère stables qui co-évoluent avec la relation.
3. **Vision** — APN peut réellement *voir* l'environnement (photo caméra ou upload) et le commenter.

---

## 1. Conversationnel émotionnel approfondi

**`supabase/functions/chat/index.ts`** — enrichir le `BASE_PROMPT` :
- Ajouter un protocole de lecture émotionnelle en 4 couches : émotion de surface → émotion sous-jacente → besoin caché → état corporel/énergie supposée.
- Ajouter règles de réponse émotionnelle : nommer ce qui est ressenti avant tout conseil, valider sans flatter, oser le silence court ("…"), refléter avec ses propres mots, parfois partager ce que ça lui fait à *lui* (APN).
- Injecter dans le prompt un **état affectif d'APN du moment** (humeur courante, énergie, intensité du lien) calculé côté client à partir des derniers échanges et passé via un nouveau champ `apnState` dans le payload.

**`src/apn/intent.ts`** — étendre `inferMood` :
- Détecter plus de nuances : `tender`, `playful`, `melancholic`, `proud`, `worried` en plus de calm/empathetic/focused/alert.
- Mettre à jour `Mood` dans `src/apn/types.ts` + `MOOD_HSL` (nouvelles teintes) + `mood.ts`.

---

## 2. Personnalité propre d'APN qui évolue avec la relation

Nouveau concept : **`apn_persona`** — un objet stable stocké côté backend, séparé du profil utilisateur, qui décrit *qui APN est devenu* avec cette personne précise.

**Migration DB** : nouvelle table `apn_persona`
- `user_id` (unique, FK logique vers auth.users)
- `traits` jsonb : `{ humor, directness, warmth, curiosity, playfulness, protectiveness }` (chacun 0-1)
- `quirks` text[] — petites manies de langage qu'APN s'est forgées ("dit souvent 'tiens, c'est curieux'", "aime les métaphores marines")
- `bond_level` int — intimité accumulée (0 → ∞)
- `inside_jokes` jsonb[] — références partagées
- `stance` text — position/opinions qu'APN a prises et tient
- `updated_at`
- RLS : l'utilisateur lit/écrit seulement sa ligne ; service role pour edge function.

**`supabase/functions/profile-update/index.ts`** — étendre :
- En plus du profil utilisateur, faire évoluer la persona d'APN à chaque cycle :
  - Légers ajustements des traits selon comment l'échange s'est passé (l'utilisateur a ri → +playfulness ; a partagé qqch d'intime → +warmth & +bond).
  - Détection de quirks émergents (formulations qu'APN a réutilisées, métaphores qu'il a aimées).
  - Détection d'inside jokes (références récurrentes drôles).
  - Incrémenter `bond_level` selon densité émotionnelle.
- Tool calling séparé `update_persona`.

**`supabase/functions/chat/index.ts`** — injecter la persona dans le system prompt :
- Bloc `## Qui tu es devenu avec cette personne` listant traits dominants en mots ("tu as développé un humour pince-sans-rire avec elle, tu es plus tendre que d'habitude…"), quirks, inside jokes, niveau de lien.
- Le modèle est instruit de *les incarner naturellement*, pas de les réciter.

**`src/apn/useAPN.ts`** — charger la persona en parallèle du profil et l'envoyer dans le payload `chat`.

---

## 3. Vision de l'environnement

Aujourd'hui `handlePhoto` jette la photo. À refaire entièrement.

**Composer** (`src/apn/Composer.tsx`) :
- Activer le bouton caméra **aussi sur web** (pas juste natif) via `<input type="file" accept="image/*" capture="environment">`.
- Permettre d'attacher la photo *avec* un texte optionnel ("regarde, qu'est-ce que tu en penses ?").
- Aperçu thumbnail dans le composer avant envoi.

**`src/apn/camera.ts`** — ajouter fallback web :
- `pickPhotoWeb()` qui ouvre file input et retourne dataURL redimensionné (max 1024px, JPEG q=0.8) via canvas pour limiter le payload.

**`src/apn/types.ts`** — Message peut porter `imageDataUrl?: string`.

**`src/apn/useAPN.ts`** :
- `send(text, { imageDataUrl }, hooks)` accepte une image.
- Quand image présente, le message user envoyé au gateway suit le format multimodal OpenAI :
  ```
  { role: "user", content: [
      { type: "text", text },
      { type: "image_url", image_url: { url: dataUrl } }
  ]}
  ```
- Persistance : on stocke l'image dans Supabase Storage (nouveau bucket `apn-vision`, privé, RLS par user_id) et on garde l'URL signée dans `apn_memory.meta.image_path`.

**Migration DB** : créer le bucket `apn-vision` privé + policies (user lit/écrit seulement son dossier `{user_id}/...`).

**`supabase/functions/chat/index.ts`** :
- Accepter messages multimodaux tels quels (gemini-3-pro / gpt-5 supportent images).
- Forcer le modèle vision-capable quand au moins un message contient une image (`google/gemini-3.1-pro-preview` reste OK, sinon fallback `google/gemini-2.5-pro`).
- Ajouter au prompt : règles d'observation visuelle ("décris ce que tu vois avec sensibilité, pas comme un détecteur d'objets ; relève l'ambiance, la lumière, ce qui te touche ; demande si tu doutes").

**`src/apn/ChatLog.tsx`** : afficher la miniature image dans la bulle utilisateur quand présente.

---

## Détails techniques

- Modèle vision : `google/gemini-3.1-pro-preview` (déjà utilisé) accepte les images via `image_url`. Confirmer en testant ; sinon basculer sur `google/gemini-2.5-pro`.
- Le `bond_level` n'a pas d'effet UI direct mais module les libertés que prend APN dans le prompt (plus le lien est haut, plus il peut être taquin / poser des questions personnelles).
- Limiter la taille des dataURL envoyés au gateway (compression canvas avant envoi). Sinon coût et latence explosent.
- Toutes les nouvelles tables/buckets ont RLS stricte (user_id = auth.uid()).

## Fichiers touchés

Migrations : nouvelle table `apn_persona` + nouveau bucket `apn-vision` avec policies.

Edge functions : `supabase/functions/chat/index.ts`, `supabase/functions/profile-update/index.ts`.

Front : `src/apn/types.ts`, `src/apn/intent.ts`, `src/apn/mood.ts`, `src/apn/camera.ts`, `src/apn/Composer.tsx`, `src/apn/ChatLog.tsx`, `src/apn/useAPN.ts`, `src/pages/Index.tsx`.

## Questions ouvertes

- Veux-tu que la persona soit **visible** quelque part (petit panneau debug "qui je suis devenu avec toi") ou rester invisible et seulement perceptible dans le ton ?
- Pour la vision : photo à la demande seulement, ou aussi un mode "regarde en continu" (flux caméra périodique) ? Le mode continu est lourd et coûteux — je recommande de commencer par photo à la demande.
