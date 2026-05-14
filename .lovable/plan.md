# Avancées majeures proposées pour Lucy

Voici 5 axes d'évolution ambitieux, classés par impact. Tu peux en valider un seul, plusieurs, ou demander de prioriser.

---

## 1. Mémoire vivante & continuité émotionnelle 🧠
**Le problème** : Lucy oublie les nuances entre sessions. Elle a un `profile` mais pas de vraie mémoire sémantique.

**Avancée** :
- Table `memories` (faits, événements, personnes, préférences) avec embeddings (pgvector)
- Extraction automatique en arrière-plan après chaque échange (via edge function)
- Recherche sémantique des souvenirs pertinents injectés dans le contexte du chat
- "Humeur relationnelle" persistante : Lucy se souvient du *ton* des derniers échanges
- Timeline privée consultable ("souviens-toi de…")

**Impact** : Lucy passe d'assistant à *présence continue*.

---

## 2. Mode Présence Ambiante (always-on intelligent) 🌊
**Le problème** : Lucy n'existe que quand on la sollicite.

**Avancée** :
- Wake-word local ("Lucy…") via VAD + petit modèle on-device — pas de streaming permanent au cloud
- Détection de contexte passive : heure, lieu, agenda → interventions *rares* mais justes
- Notifications proactives intelligentes (déjà ébauché) enrichies par la mémoire
- "Mode veille active" : la matière noire respire doucement, réagit subtilement aux sons ambiants sans répondre

**Impact** : Compagnon plutôt qu'outil.

---

## 3. Vision continue & compréhension du monde 👁️
**Le problème** : La caméra est ponctuelle, Lucy ne *voit* pas vraiment.

**Avancée** :
- Flux vidéo en arrière-plan (frames espacées, 1/3s) avec analyse multimodale Gemini Flash
- Détection de scène : lieu, objets, personnes (anonymisées), activité
- Lucy peut commenter *si demandée* (cohérent avec règle existante) mais comprend le contexte visuel en permanence
- Mode "regarde avec moi" : analyse temps réel pendant qu'on lui montre quelque chose
- Capture de moments : Lucy reconnaît un instant marquant et propose de le garder

**Impact** : Conscience spatiale réelle.

---

## 4. Mode Pré-Médecin V2 — suivi longitudinal 🩺
**Le problème** : Le mode médical existe mais reste réactif.

**Avancée** :
- Carnet de santé structuré (symptômes, prises, sommeil, douleur 0-10)
- Graphiques de tendances + détection d'anomalies
- Rappels intelligents ("hier tu avais 7/10 au dos, comment ce matin ?")
- Export PDF formaté pour vrai médecin (ordonné, dates, fréquences)
- Intégration HealthKit / Google Fit (Capacitor) pour rythme cardiaque, sommeil, pas
- Alertes drapeaux rouges déjà présentes → enrichies par historique

**Impact** : Vraie valeur clinique préparatoire.

---

## 5. Personnalité incarnée & expressivité 🎭
**Le problème** : La matière noire est belle mais la personnalité de Lucy reste générique.

**Avancée** :
- "Tempérament" configurable (rythme, humour, distance) qui module *vraiment* le system prompt + la voix
- Synthèse vocale émotionnelle (ElevenLabs v3 avec tags émotion `[whispers]`, `[laughs]`)
- Variations visuelles fines de la matière noire selon l'émotion détectée dans la réponse (joie = particules dorées, doute = ralenti, tendresse = pulsations chaudes)
- "Silences habités" : Lucy peut choisir de ne pas répondre par mots, juste un mouvement de matière
- Voice cloning optionnel (voix proche / familière, opt-in fort)

**Impact** : Lucy devient *quelqu'un*, pas *quelque chose*.

---

## Recommandation
Si je devais en choisir **un seul** pour maximiser l'effet "wow + utilité" : **#1 Mémoire vivante**. C'est le socle qui rend les 4 autres beaucoup plus puissants.

Si tu veux du **visible immédiat** : **#5 Personnalité incarnée** (résultats sensibles dès la 1re interaction).

Dis-moi lequel (ou lesquels) tu veux que je détaille en plan d'implémentation concret.
