# Sunweaver Town Center — procedural Three.js asset

## Open the viewer

```bash
npm run dev
open 'http://127.0.0.1:5173/town-center-viewer.html'
```

Use URL parameters for deterministic review captures:

```text
?ui=0&view=front&stage=4&freeze=1
```

Valid views are `front`, `back`, `side`, `left`, and `top`. Valid stages are `1` through `4`.

## Factory

```ts
import { createSunweaverTownCenter } from './sunweaver-town-center';

const townCenter = createSunweaverTownCenter({
  stage: 4,
  crystalColor: '#36C9FF',
  teamColor: '#36C9FF',
});
scene.add(townCenter);
```

The factory exposes a runtime at `townCenter.userData.sculptRuntime`:

```ts
runtime.setStage(1 | 2 | 3 | 4);
runtime.setExplode(0.0);       // range: 0 to 1
runtime.setTeamColor('#36C9FF');
runtime.update(elapsed, delta);
runtime.dispose();
```

The model uses named selectable parts. The runtime currently exposes 34 named parts and 381 pickable meshes at 130,508 triangles. Nested semantic parts are selectable but do not receive explode transforms; only the 20 top-level assembly pivots move. The explode layout scales those top-level part centers away from the model center.

## Implemented reference systems

- Seven-unit circular footprint.
- Four-fold major architecture and eight-fold facade rhythm.
- One front ceremonial stair.
- Four additive construction stages with temporary crystal cores.
- Four secondary turrets.
- Four sunburst banners.
- Separate stone, gold, blue, cyan, cavity, foundation, and foliage materials.
- Faceted transmissive crystal with an emissive core and four curved cage prongs.
- Pointed entry frames, roof wedges, pauldron plates, buttresses, wishbone ribs, and cyan conduits.
- Front, side, rear, top, stage, and map-stripped screenshot capture.

## Evidence

Fresh review images are stored under `critic/out/town-center/`.

Run:

```bash
node scripts/town-center-shots.mjs
```

The script writes five orbit views, four stage views, a map-stripped view, and `report.json`.

## Known production work

This is a detailed procedural hero asset and viewer. It is not yet the normal gameplay LOD.

Before the game displays many copies, add a merged gameplay LOD and a distant billboard. Preserve the front stair, four needles, crystal cage, and circular crown silhouette.
