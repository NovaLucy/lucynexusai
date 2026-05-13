## Objectif
Adoucir l'ondulation de la goutte pendant les réponses, et harmoniser l'arrière-plan + thème général avec l'esthétique "goutte d'eau de matière noire".

## 1. Adoucir l'ondulation (`src/apn/agi/MoodBubble.tsx`)

Réduire amplitude/vitesse, surtout en `speaking`/`thinking` :

- `ampTarget` : speaking `0.34 → 0.14`, thinking `0.24 → 0.11`, listening `0.18 → 0.09`, idle `0.12 → 0.07`
- `speedTarget` : speaking `1.4 → 0.55`, thinking `1.0 → 0.45`, listening `0.7 → 0.35`, idle `0.45 → 0.25`
- `pulseTarget` : speaking `1.0 → 0.45`, thinking `0.6 → 0.3`
- Lissage : remplacer `* 0.06` par `* 0.025` (transitions plus fluides, moins nerveuses)
- Respiration (`breath`) : amplitude `0.06 → 0.02`, fréquence speaking `2.2 → 1.3`
- Rotation : `dt * 0.12 → dt * 0.05`, inner `0.18 → 0.08`

Résultat : la goutte respire lentement, ondule à peine, ressemble à une vraie goutte de mercure noir.

## 2. Arrière-plan en accord (matière noire liquide)

Remplacer le fond `bg-black` actuel + `AmbientChars` par une scène cohérente :

- **`src/index.css`** : nouveau token `--bg-deep` (presque noir avec teinte mood subtile), gradient radial très doux centré derrière la goutte, et keyframe `liquid-drift` (60-90s, translate ±2%, scale 1↔1.03) pour donner une lente respiration.
- **Halo central (`.core-halo`)** : revoir pour qu'il soit beaucoup plus discret, juste une lueur teintée mood `~0.08` opacity, blur fort, suit l'humeur via `hsl(var(--mood))`.
- **Particules** : retirer ou fortement atténuer `AmbientChars` (opacity `0.40 → 0.10`) — elles cassent l'esthétique liquide. Optionnel : remplacer par ~30 particules très lentes (points lumineux blancs `opacity 0.05-0.15`) qui dérivent comme microbulles dans un liquide.
- **NeuralNetwork** : passer opacity `0.40 → 0.15` ou retirer (à confirmer en Q1).

## 3. Thème général aligné

Dans `src/index.css` (variables HSL) :

- `--background` : noir très profond avec micro-teinte bleu nuit (ex. `220 30% 3%`)
- `--foreground` : blanc cassé adouci `210 15% 88%`
- `--border`, `--muted` : tons graphite froids
- Composer & TopBar : déjà glassmorphism — vérifier que `backdrop-blur` joue bien sur le nouveau fond, ajuster `bg-foreground/5` si trop visible
- Caption : déjà `text-foreground/85` — OK
- Ligne séparatrice sous caption : la rendre plus fine et plus discrète (`hsl(var(--mood) / 0.3)`)

## Fichiers touchés
- `src/apn/agi/MoodBubble.tsx` (ondulation)
- `src/pages/Index.tsx` (atténuer AmbientChars/NeuralNetwork, halo)
- `src/index.css` (background, halo, tokens, keyframe liquid-drift)

## Question avant impl
Voir question ci-dessous sur les couches d'ambiance (NeuralNetwork + AmbientChars).
