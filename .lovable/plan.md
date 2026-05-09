## Objectif
Transformer APN d'un chatbot réactif en un véritable compagnon de pensée : mémoire qui dure vraiment, lecture fine de ce que tu veux dire (pas juste ce que tu dis), réponses adaptatives, et présence qui s'autorise à relancer doucement.

---

## 1. Mémoire longue + résumé glissant

**Côté frontend (`useAPN.ts`)**
- Charger les **40 derniers échanges** au lieu de 8 au démarrage.
- Envoyer les **20 derniers messages** au LLM (au lieu de la fenêtre actuelle).
- Lire `profile.traits.summary` et l'injecter dans le payload.

**Côté backend (`chat/index.ts`)**
- Si plus de 30 messages dans l'historique, injecter dans le system prompt un bloc `## Résumé des échanges précédents` (lu depuis `profile.traits.summary`).
- Ce résumé est généré en arrière-plan (voir §4).

**Stockage** : pas de nouvelle table — `profiles.traits.summary` (string ~500 tokens, glissant).

---

## 2. Modèle plus puissant + reasoning

Dans `chat/index.ts` :
- Modèle principal : `google/gemini-3.1-pro-preview` avec `reasoning: { effort: "low" }`.
- Fallback automatique sur `google/gemini-3-flash-preview` si 429/5xx (déjà partiellement en place — à nettoyer).
- Garder le streaming SSE inchangé.

Gain attendu : meilleure cohérence, liens plus justes avec la mémoire, moins de phrases creuses.

---

## 3. Compréhension affinée (intention + émotion)

**Nouvelle section dans le system prompt — « Avant de parler »** :
1. Identifier l'intention réelle (besoin émotionnel / info / décision / action / bavardage).
2. Lire l'émotion sous-jacente (frustration cachée, fatigue, excitation contenue).
3. Adapter **longueur** ET **ton** à l'intention détectée :
   - Émotionnel → court, présent, accueille avant de conseiller.
   - Décision bloquée → mini-cadre de réflexion 2 lignes.
   - Info pure → réponse directe sans préambule.
   - Bavardage → léger, joue le jeu.

**Mood côté serveur (optionnel mais utile)** : le backend renvoie un header SSE `x-apn-mood` (calculé sur la réponse complète côté serveur via heuristique) → `useAPN` l'utilise pour colorer le visage Matrix plus juste que `inferMood` actuel.

---

## 4. Persona vivante : initiative + résumé auto

**Edge function `profile-update` étendue** :
- En plus de mettre à jour `traits/last_topic/open_loops`, **génère/maintient `traits.summary`** :
  - Si `message_count % 10 === 0`, regénère un résumé de 4-6 lignes des grandes lignes (qui est l'utilisateur, ce qu'il vit en ce moment, sujets récurrents).
  - Stocké dans `traits.summary`.

**Relances douces (~10% des tours)** — règle dans le system prompt :
- Permets-toi parfois (1 tour sur 10) :
  - une **observation spontanée** liée à un sujet ouvert,
  - une **question qui ouvre un angle nouveau**,
  - un **rappel naturel** d'un échange passé pertinent.
- Jamais de relance forcée ; seulement si ça apporte vraiment.

**Variabilité du ton** : ajouter une instruction sur les "micro-humeurs" — APN peut être un peu plus rêveur le soir, plus direct le matin (basé sur l'heure envoyée par le client dans le payload).

---

## 5. Style adaptatif

Règles de longueur ré-écrites dans le prompt :
- Émotionnel / accueil → 1-2 phrases.
- Conversation normale → 2-3 phrases.
- Réflexion / aide concrète → jusqu'à 4-8 phrases si vraiment utile.
- Jamais de listes à puces dans une conversation.
- Jamais de récap inutile du message reçu.

---

## Détails techniques

```text
User envoie message
  │
  ▼
useAPN.send()
  │  history(20) + profile(+summary) + heure locale
  ▼
edge: chat (gemini-3.1-pro-preview + reasoning low)
  │  system = BASE + "Avant de parler" + résumé + profil
  ▼
SSE stream → UI (token par token)
  │
  ▼
persist(memory) ──► profile-update (background)
                      │
                      ├─ extrait traits / open_loops
                      └─ tous les 10 msg : régénère traits.summary
```

### Fichiers touchés
- `supabase/functions/chat/index.ts` — modèle pro + reasoning, section "Avant de parler", injection résumé, règles de longueur, micro-humeurs.
- `supabase/functions/profile-update/index.ts` — génération/maintenance de `traits.summary` tous les 10 messages.
- `src/apn/useAPN.ts` — fenêtre 20 messages, chargement 40 messages d'historique, envoi heure locale, lecture mood serveur (header SSE) si présent.
- `src/apn/intent.ts` — `inferMood` reste comme fallback si pas de header serveur.

### Hors scope
- Pas de nouvelle table.
- Pas de TTS / lipsync.
- Pas de changement UI (visage, sidebars, composer inchangés).
- Pas de touche au système d'auth ni RLS.
