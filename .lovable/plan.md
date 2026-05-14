## Page de déconnexion — Lucy (matière noire)

Créer une page dédiée `/logout` qui sert d'écran d'au-revoir thématisé "matière noire" et présente Lucy (le nom officiel de l'APN), avec accès à la politique et un volet pédagogique sur l'outil et son utilisation.

### 1. Renommer l'APN en "Lucy"
- Composant `TopBar.tsx` : nom affiché "Lucy" (fallback du `display_name`).
- `Auth.tsx` : titres "Connexion à Lucy" / "Créer un compte Lucy".
- Aucune logique métier ne change — uniquement l'identité visible.

### 2. Nouvelle route `/logout`
- Ajouter `<Route path="/logout" element={<Logout />} />` dans `src/App.tsx` (au-dessus du catch-all).
- Le bouton "Déconnexion" de `TopBar.tsx` redirige vers `/logout` (au lieu de signOut immédiat) afin que l'utilisateur passe par cet écran.

### 3. Page `src/pages/Logout.tsx` — thème matière noire
Structure visuelle alignée avec l'esthétique existante (halo, dark-matter, mood, AmbientChars) :

```text
┌──────────────────────────────────────────────┐
│   halo pulsant + voile matière noire         │
│                                              │
│            L U C Y                           │
│      Agent Personnel Numérique               │
│                                              │
│     "À bientôt. Je garde la mémoire."        │
│                                              │
│   ┌──────────────┐  ┌──────────────────┐    │
│   │ Se déconnecter│  │ Rester connecté  │    │
│   └──────────────┘  └──────────────────┘    │
│                                              │
│   [ Lire la politique ]  [ Découvrir Lucy ]  │
└──────────────────────────────────────────────┘
```

- Utilise `dark-matter`, `core-halo`, `mood-ambient`, `float-soft`, classes déjà définies dans `index.css`.
- Typographie : grand mot-mark "LUCY" en tracking large, sous-titre faible opacité.
- Bouton primaire : déconnecte via `supabase.auth.signOut()` puis `nav("/auth")`.
- Bouton secondaire : `nav(-1)` pour revenir à la session.
- Deux liens-pastilles ouvrent les volets décrits ci-dessous (Sheet shadcn, side="right").

### 4. Volet "Politique de confidentialité"
- Composant `Sheet` (shadcn) avec contenu lisible (max-w-prose), titres `<h2>`, sections :
  - Données collectées (compte, conversations, mémoire, santé optionnelle, réalité optionnelle).
  - Stockage (Lovable Cloud, RLS par utilisateur).
  - Usage (mémoire conversationnelle, contextualisation).
  - Droits (effacement de session, déconnexion, suppression compte sur demande).
  - Tiers (ElevenLabs TTS, BigDataCloud reverse-geocoding, Lovable AI Gateway).
- Texte rédigé en français, ton sobre.

### 5. Volet "Découvrir Lucy" (prise en main)
- Sheet séparé, structure en 4 sections courtes :
  1. **Qui est Lucy** — APN, présence calme, mémoire propre à toi.
  2. **Comment lui parler** — composer texte, micro (auto-relance), photo via 📎, commandes vocales.
  3. **Modes** — pré-médecin, journal, voix verrouillée Lily, réalité (heure/lieu/regard ambiant).
  4. **Tes contrôles** — réglages (voix, intensité, fréquence visage), effacer la session, déconnexion.
- Liste d'icônes lucide-react (Mic, Camera, Stethoscope, Archive, Settings) déjà disponibles.

### Détails techniques
- Pas de changement de schéma DB.
- Pas de nouvelle dépendance (Sheet, Button, lucide-react déjà présents).
- Tokens sémantiques HSL via classes existantes (`text-foreground/85`, `bg-background`, `mood-ambient`) — pas de couleurs codées en dur.
- `document.title = "Lucy — Au revoir"` à l'entrée sur `/logout` pour SEO/onglet.
- Accessibilité : `<h1>` "Lucy", boutons avec labels explicites, focus visible conservé.

### Fichiers touchés
- créé : `src/pages/Logout.tsx`
- édité : `src/App.tsx` (route)
- édité : `src/apn/TopBar.tsx` (bouton logout → `/logout`, nom Lucy)
- édité : `src/pages/Auth.tsx` (titres "Lucy")
