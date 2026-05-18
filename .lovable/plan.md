## Objectif

1. Rendre Lucy et toi visuellement distincts dans le journal de conversation.
2. Ajouter un éditeur de profil complet pour conditionner Lucy (ton, intérêts, valeurs, contexte, ce qu'elle doit savoir/éviter).

---

## 1. Différencier Lucy vs Utilisateur dans `ChatLog`

Fichier : `src/apn/ChatLog.tsx`

Actuellement chaque message a la même bulle `dark-matter`. On va :

- Aligner les messages **utilisateur à droite** et **Lucy à gauche**.
- Bulle utilisateur : fond subtil teinté `--mood`, bordure droite accentuée, label `[TOI]` / prénom en couleur neutre.
- Bulle Lucy : fond `dark-matter` actuel, bordure gauche en couleur `--mood` dynamique selon `m.mood`, label `[LUCY]` en couleur d'humeur, petit point d'humeur coloré devant l'horodatage.
- Largeur max `~75%` pour créer le rythme visuel.
- Conserver l'image et le texte tels quels.

Aucune logique modifiée, purement présentationnel.

---

## 2. Personnalisation complète du profil

### 2a. Nouveau composant `ProfileEditor`

Fichier : `src/apn/ProfileEditor.tsx` (nouveau)

Sheet plein écran (même style que `ControlsDrawer`) avec sections :

- **Identité** : prénom (`display_name`), pronoms, âge approx.
- **Comment Lucy te parle** : ton préféré (chips : direct / chaleureux / concis / réflexif / joueur / posé), tutoiement, langue.
- **Ce qui compte pour toi** : intérêts (tags éditables), valeurs (tags), contexte de vie (textarea court).
- **Ce que Lucy doit savoir** : notes libres (textarea, ex : « je travaille de nuit », « je traverse un deuil »).
- **Ce que Lucy doit éviter** : sujets/comportements à éviter (textarea).
- **Bouton « Effacer mon profil »** (reset des champs édités, garde les souvenirs).

Persistance : upsert direct dans `apn_user_profile` (champs `display_name` + `traits` JSONB enrichi avec `pronouns`, `age`, `tone`, `language`, `interests`, `values`, `context`, `notes`, `avoid`).

### 2b. Brancher dans le chat système

Fichier : `supabase/functions/chat/index.ts`

Étendre la section « Ce que tu sais de cette personne » pour exposer les nouveaux champs (`pronouns`, `language`, `avoid`, etc.) — l'enveloppe `buildSystemPrompt` lit déjà `profile.traits`, il suffit d'ajouter quelques lignes pour les rendre explicites. Ajouter une consigne forte : « Respecte ABSOLUMENT la liste 'à éviter'. »

### 2c. Accès UI

Fichier : `src/pages/Index.tsx`

- Ajouter un bouton `[👤 PROFIL]` dans `ControlsDrawer` (section nouvelle « TON PROFIL ») qui ouvre le `ProfileEditor`.
- État local `profileEditorOpen` géré dans `Index.tsx`.
- Après save, appeler `apn.refreshProfile()` (nouvelle méthode légère à ajouter dans `useAPN.ts` qui relit la ligne `apn_user_profile` et met à jour `profileRef` + `setProfile`).

### 2d. Mise à jour `useAPN.ts`

- Exposer `refreshProfile: () => Promise<void>`.
- Préserver la fusion : `profile-update` (background) ne doit pas écraser les champs édités à la main — déjà géré côté edge function (« fusionne avec l'existant sans dupliquer »), mais on s'assure que le payload `currentProfile` envoyé contient bien les champs récents.

---

## Détails techniques

Schéma `apn_user_profile.traits` (JSONB libre) — aucune migration nécessaire, on stocke :
```json
{
  "pronouns": "elle",
  "age": 34,
  "tone": "direct",
  "language": "fr",
  "interests": ["musique", "philo"],
  "values": ["honnêteté", "calme"],
  "context": "freelance, vit seule",
  "notes": "je suis en deuil depuis mars",
  "avoid": "pas de blagues sur la mort"
}
```

Tous ces champs sont optionnels et déjà tolérés par le système prompt (qui ignore les champs vides).

---

## Fichiers touchés

- `src/apn/ChatLog.tsx` (présentation)
- `src/apn/ProfileEditor.tsx` (nouveau)
- `src/apn/ControlsDrawer.tsx` (ajout entrée « TON PROFIL »)
- `src/apn/useAPN.ts` (ajout `refreshProfile`)
- `src/pages/Index.tsx` (état + montage de `ProfileEditor`)
- `supabase/functions/chat/index.ts` (afficher pronouns/language/avoid dans le prompt)

Aucune migration DB, aucune nouvelle dépendance.
