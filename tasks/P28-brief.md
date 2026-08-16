You are the Composer 2.5 builder for Spacepixel RTS piece P28: make the opening frustum a place, not a dotted void.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Read first: docs/DESIGN.md §6 §9, tasks/P27-critic.md, src/atlas.ts drawTile/diamondEdge, src/render.ts buildMap, src/sim.ts stampOpeningGround/spawnScenario, src/main.ts.

P27 critic FAIL. Do **not** touch the hold-fire rank math (colPitch 1.55, rowPitch 1.40, gap 3.60, freeze steer tick<240, infantry scale 1.08×1.14). Those passed.

Do **not** spawn agents. Do **not** redesign civs or the tick loop. Do **not** bring back giant black ore panels (P18 fail). Do **not** AttackMove the clash.

## Single biggest gap (verbatim)

The opening tableau still does not read as a **place worth commanding** — dust, rock, resource nodes, and base pads do not fill the frustum around the ranks, so the fight floats on an empty grid.

Proof: ~75% palette is `#665588`+`#111122`; gems are faint edge blobs; no workers/structures in the main view.

## Why the dust pad failed

`drawTile` fills a flat purple then `diamondEdge` draws the same dotted diamond on every cell. Quantized, dust **is** the void. Rim rocks and 0.85wu gems at `cx±8` sit on the screen edge and read as grey planets, not economy.

## Do

### 1. Terrain craft (`src/atlas.ts` + `buildMap`)

Repaint **dust** so a single tile already looks like ground: two-tone plates, pebble clusters, hairline cracks, warmer highlights (`dustH` ~ `[148, 132, 168]`), **no star-like white specks**. Rock tile = a **boulder silhouette** with a lit rim, not another diamond.

Add **two extra dust variants** in the atlas (`tile-dust-b`, `tile-dust-c`) with different crack/pebble layouts. In `buildMap`, pick variant by `(x * 13 + z * 7) % 3` for Dust tiles so the pad does not look like one stamp.

Keep nearest-neighbor. Magenta key stays off ground tiles.

### 2. Scatter real features on the pad (`stampOpeningGround`)

Keep the 28×20 dust pad. **Do not** put blockers in the fire lane (`|z - icz| <= 4`).

- **Interior rocks:** ~18 single-tile rocks in two crescents **left and right** of the ranks (high |x| or high |z| but outside the lane).
- **Gems:** four gems at about `(cx±5, cz±4)` — still one tile + 0.85–1.1wu sprite, **inside** the camera, not on the rim. Mix Ore/Gas/Solar.
- **Forward camp in frame (empire presence):** 1 Helion `House` at `(cx + 4.2, cz - 5.2)`, 3 Workers with `Ord.Gather` walking to the nearest of those gems. 1 Kryos `House` at `(cx - 4.2, cz + 5.2)` (far side). These must be on the **same depth band** as the clash (world X within ~5 of `cx`) so iso does not hide them.

### 3. Prop billboards (wreck / vent)

Add 2 small atlas sprites: `prop-wreck` (dark hull shard) and `prop-vent` (cyan/gold plume). Spawn them as `Kind.Resource` with a new cargoType sentinel **or** a tiny `world.props: {x,z,key}[]` drawn in the existing InstancedMesh after ents — pick one, keep draw-call count. Place 6 props around the pad, not in the fire lane. No HP bars on props.

### 4. Camera

Keep `halfH = 5.8` and look-at at clash center. Do **not** zoom out (postage-stamp regression). Fill by painting the ground that is already on camera.

### 5. Verify then ship

1. `npm run build`
2. Preview on a free port. `node scripts/measure.mjs --url http://127.0.0.1:PORT --screenshot critic/out/p28.png --wait 3 --fps-seconds 3`
3. Open the PNG. **Pass only if:** two ranks still countable + bolts; you can point at **house + workers + ≥3 gems + varied ground** in the same shot; the playfield is not ~75% one purple. If still a void grid, iterate tiles before committing.
4. `npx wrangler pages deploy dist --project-name=spacepixelrts`
5. Commit `P28: fill opening frustum with a place`
6. `tasks/P28.md`. Probe version `0.2.3-wave1`.

Do not commit `notes.md` or PNGs.
