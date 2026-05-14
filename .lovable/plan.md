## Objectif
Ajouter un grain subtil au halo central (`.core-halo`) et à l'onde rituelle (`.ritual-wave`) pour renforcer l'effet "matière noire" organique, sans altérer le style global.

## Changements prévus

### 1. Halo central — grain gaseux
Sur `.core-halo`, ajouter un pseudo-élément `::after` avec :
- `feTurbulence` SVG en background (baseFrequency 0.6, 2 octaves)
- `mix-blend-mode: overlay`
- Opacité ~0.06, légèrement plus dense quand `main[data-state="speaking"]` ou `"thinking"`
- Animation lente de drift (translate) pour éviter la rigidité statique

### 2. Onde rituelle — grain plus marqué
Sur `.ritual-wave`, ajouter un `::after` similaire mais :
- Opacité plus élevée (~0.12) car c'est un effet temporaire
- `filter: blur(2px)` pour fondre le grain dans le flou existant
- Pas d'animation de drift (l'onde a déjà sa propre animation `wave-out`)

### 3. Ajustements de cohérence
- Réutiliser le même pattern SVG feTurbulence que `.dark-matter::after` pour l'uniformité visuelle
- S'assurer que le grain reste invisible sur fond blanc (ce n'est pas le cas ici, fond noir)
- Vérifier `prefers-reduced-motion` pour désactiver le drift si besoin

## Fichiers modifiés
- `src/index.css` uniquement (ajouts dans la section `@layer utilities`)

## Non-touches
- Couleurs, blur radius, taille ou position du halo
- Animation `mood-breathe` existante
- Styles des conteneurs UI (top bar, composer, etc.)