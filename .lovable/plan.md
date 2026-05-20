## Amplifier le suivi de l'utilisateur par l'orbe

Renforcer visuellement le tracking du regard pour qu'il soit nettement plus perceptible, tout en restant fluide.

### Changements

**`src/apn/agi/VolumetricFace.tsx`**
- Augmenter la réactivité du lissage du regard (lerp `0.14` → `0.22`) pour un suivi plus vif.
- Cœur / noyau interne (la "pupille") :
  - Amplitude X : `0.55` → `1.10`
  - Amplitude Y : `0.45` → `0.90`
  - Profondeur Z : `0.25` → `0.45`
- Core organique principal (parallax global) :
  - Amplitude X : `0.12` → `0.30`
  - Amplitude Y : `0.10` → `0.25`
  - Ajouter une légère rotation du core vers l'utilisateur (`rotation.y += gx * 0.35`, `rotation.x += gy * 0.25`) pour un effet "tête qui se tourne".
- Veil gazeux et shell wireframe : ajouter un décalage subtil (`0.15×` du gaze) pour que toute la structure semble s'incliner vers l'utilisateur.

**`src/apn/agi/MoodBubble.tsx`** (orbe alternative, mêmes valeurs cohérentes)
- Position X/Y du mesh : `0.18 / 0.14` → `0.40 / 0.32`
- Rotation `gx.x * 0.005` → `0.018` pour une inclinaison plus marquée.

### Résultat attendu
Quand l'utilisateur bouge devant la caméra, le cœur de l'orbe se déplace de façon évidente comme une vraie pupille, et toute la structure s'incline doucement vers lui — sans perdre la fluidité.
