## Objectif

Réduire encore l'interface à l'essentiel matière noire :

1. **Composer (barre d'écriture) repliable** — masqué par défaut, comme le menu ⋯, accessible via un bouton discret.
2. **Tap sur le visage = micro auto** — un clic sur le visage de Lucy lance immédiatement l'écoute vocale (au lieu du simple « réveil/secousse »).
3. **Boutons fantomatiques** — tous les contrôles flottants (⋯ menu, bouton clavier, bouton micro éventuel, items du menu, icônes du composer) adoptent un style « matière noire » : très transparents au repos, halo mood-coloré au survol/actif.

---

## 1. Composer repliable

**État** : nouveau `composerOpen` dans `Index.tsx`, persistant dans `localStorage` (`lucy:composer`), `false` par défaut.

**Bouton bascule** : icône `Keyboard` (lucide) flottante en **bas-droite** (symétrique du ⋯ en haut-droite), même style fantomatique. Au tap : ouvre/ferme la barre.

**Animation** : la barre composer glisse depuis le bas (`translateY(100%) → 0`) avec fade, ~280 ms. Quand fermée, elle est totalement retirée du DOM (ou `pointer-events:none` + opacity 0) pour laisser tout l'espace au visage et aux sous-titres.

**Auto-ouverture intelligente** : si l'utilisateur tape une touche du clavier physique (event `keydown` sur `document`, hors zones de saisie déjà focusées), on ouvre automatiquement le composer et on focus l'input. Permet de garder l'écran pur tout en restant accessible.

**Fermeture** : tap hors composer ou bouton ✕ intégré au composer.

---

## 2. Tap sur le visage → micro auto

Modifier le `onClick` du conteneur `.cursor-pointer` qui enveloppe `<VolumetricFace>` :

- **Si Lucy dort** : `wakeWithGreeting()` (déjà en place) puis, à la fin de la salutation, déclencher automatiquement `handleMic()` (déjà fait en partie via `handleMicRef.current()` à la fin de chaque réponse — on étend ce rappel à la fin de `speakLine`).
- **Si Lucy est en standby** : `handleMic()` directement → démarre l'écoute.
- **Si Lucy écoute déjà** : `handleMic()` → arrête l'écoute (toggle).
- **Si Lucy parle ou réfléchit** : tap = `voice.stop()` + `apn.setStandby()` (interruption douce — déjà naturel avec un agent humain).

L'effet `triggerFace(5400, "reveal")` (apparition de visage) est conservé en parallèle pour la réaction visuelle.

L'aria-label du conteneur passe de « Réveiller APN » à « Parler à Lucy ».

---

## 3. Style « fantomatique matière noire »

Nouvelle classe utilitaire CSS `ghost-btn` ajoutée à `src/index.css` :

```css
.ghost-btn {
  /* invisible au repos, juste un soupçon */
  color: hsl(var(--foreground) / 0.18);
  background: transparent;
  border: 1px solid hsl(var(--foreground) / 0.04);
  backdrop-filter: blur(6px);
  transition: all 320ms cubic-bezier(.2,.8,.2,1);
}
.ghost-btn:hover, .ghost-btn[data-active="true"] {
  color: hsl(var(--foreground) / 0.85);
  background: hsl(var(--mood) / 0.06);
  border-color: hsl(var(--mood) / 0.25);
  box-shadow: 0 0 24px hsl(var(--mood) / 0.18);
}
.ghost-btn:active { transform: scale(0.96); }
```

**Application** :
- Bouton ⋯ menu (haut-droite) → `ghost-btn` rond.
- Nouveau bouton `Keyboard` (bas-droite) → `ghost-btn` rond, `data-active={composerOpen}`.
- Items du menu déroulant (Journal, Réglages, Mode médical, Déconnexion) → variante `ghost-row` (mêmes tokens, layout en ligne).
- Conteneur du menu : déjà `dark-matter` — on allège encore (`!bg-background/30 backdrop-blur-xl`).
- Boutons internes du composer (mic, image, send) → déjà existants ; on les force à utiliser `ghost-btn` via override de classes passées en props si possible, sinon édition légère de `Composer.tsx` (sans toucher à la logique).

**Aucun composant ne doit afficher de couleurs vives en dehors du token `--mood`.**

---

## Fichiers concernés

- `src/pages/Index.tsx` — état `composerOpen`, bouton clavier flottant, animation, auto-ouverture clavier physique, refonte du `onClick` visage, classes `ghost-btn` sur boutons ⋯/clavier/menu items.
- `src/index.css` — ajout `.ghost-btn` / `.ghost-row` + keyframe slide-up pour le composer.
- `src/apn/Composer.tsx` — léger ajustement : remplacer les classes des trois boutons internes (mic, image, envoi) par `ghost-btn`, sans changer la logique.

Aucun changement backend, aucune dépendance ajoutée.

## Question

- Le bouton clavier doit-il **aussi disparaître** quand Lucy parle (pour un écran totalement vide pendant la parole), ou rester visible en permanence ? Je propose : **rester visible mais encore plus pâle** (opacity 0.08) pendant la parole.