You are the Composer 2.5 builder for Starhold RTS piece **P96 iterate: elevation must READ as 3D cliffs**.

Repo: `/Users/prateekranka/Cowork/spacepixelrts`
Read: `src/sim.ts` (`genMap`, `generateHeightmap`, `applyHeightCliffs`, `flattenHeightPads`, `isHeightPad`), `src/height.ts`, `src/terrain.ts` (vertex shader + `buildHeightTexture`), `src/render.ts` (`groundY`, `buildMap`).

Do **not** spawn agents. Do **not** start `npm run dev` (already `:5173`). Do **not** change combat, economy, civs, MAG lamps, iso camera, or the opening clash *script*. Do **not** commit `notes.md` or `critic/out/*`.

## Why P96 v1 failed (orchestrator measured the live 0.9.2-iso build)

Live probe (`window.__STARHOLD_WORLD__`):
- height hist: **2875 / 230 / 2036 / 43** at levels 0/1/2/3 (bimodal pancake, almost no ramps)
- **3826** 4-connected pairs with Δheight ≥ 2, but **`block=0` and `Tile.Rock=0`**
- Opening pad max height 0 (good). Max tile (50,40)=3 sits on the pad rim.
- Opening GPU frame vs P95 mean |RGB| ≈ **6.7** — the clash shot did not become a place with mountains.
- Ridge pan is two-tone mauve vs ink void, not terrace walls.

Root causes in the v1 code:
1. **`flattenHeightPads()` runs AFTER `applyHeightCliffs()`** — pad flatten creates the only visual 0→2 walls, and those walls never get `block`/`Rock`. The intended ridge (`t=0.6–0.8`) is **inside** `isHeightPad` and gets zeroed.
2. **Cliff pass `continue`s when either tile is `Tile.Void`** — almost every Δ≥2 is Dust-vs-Void, so nothing is marked.
3. **Vertex height sample is Z-flipped.** Mesh is `PlaneGeometry` + `rotation.x = -π/2` + `position (MAP/2,0,MAP/2)`, so worldZ = `MAP/2 - position.y`. Shader uses `position.xy + uMapHalf` → samples `(worldX, MAP-worldZ)`. CPU `groundY` uses unflipped `(x,z)`. Mesh hills and sprites disagree.
4. Almost no ±1 ramp band, so even if cliffs existed they would be crater walls around the clash (bad for the opening).

## Single gap to close

A naive player panning ~12 tiles off the opening valley must see **iso terrace walls** (dark cliff faces under a raised mauve top) and a **walkable ramp**. Cliffs must actually `block`. Opening clash pad stays flat and fighters stay visible.

## Do this (stay in this gap)

### Sim (`src/sim.ts`) — order matters

```
generateHeightmap()
stamp patches / opening / clearBase
flattenHeightPads()          # pads = 0
skirtRampsAroundPads()       # 2-tile ring: if height>=2, set to 1 (walkable ±1)
applyHeightCliffs()          # LAST, after flatten
```

- Keep Void at height 0. Fill FBM height on Dust (and resource tiles). Do **not** skip Void when testing a neighbor for Δ — if Dust/resource vs anything differs by ≥2, mark the **high** tile `Tile.Rock` + `block=1` (skip tiles inside `isHeightPad` / `clearBase` pads).
- **Move the ridge outside the opening pad.** Pad is `icx±14, icz±10` (center ~36,37). Put the ridge around diagonal `t ≈ 0.78–0.92` (near enemy approach), with a **ramp gap** (perp 4–6 stays level 1). Valley corridor can sit mid-map *outside* the pad, not on it (pad is already 0).
- `skirtRampsAroundPads`: 2-tile Moore ring around opening + both bases; clamp height to 1 if it was ≥2. This keeps the clash/base exits walkable.
- After your change, a Playwright probe **must** print `blocked > 0` and `rock > 0`. Path `pathfind(10,10,61,61)` must still return a path (ramp around the ridge, not a sealed crater).

Do **not** add high-ground damage. Mechanics freeze.

### Visual (`src/terrain.ts`)

- Sample height in the vertex shader from **world XZ after `modelMatrix`** (same indexing as `height[x + z*MAP]`). Fog mesh too.
- `HEIGHT_SCALE = 1.1` (top of the original 0.7–1.1 band). Cliff faces (`vSlope`) stay darker rock; ramps stay mauve dust. P91 quiet ground — no zigzag checker, no Mars ochre.
- Raised terrace tops must be the **same dust** as the valley, just higher — mountains are geometry, not a painted ink blob.

### Sprites

Keep `groundY` bilinear on `world.height`. After the UV fix they should sit on the mesh.

Bump `VERSION` to `0.9.3-iso` in `src/main.ts`.

## Verify

- `npx tsc --noEmit`; `npm run build`.
- Probe: hist should have a real level-1 ramp population; `blocked>0`; `rock>0`; pad max 0; path base-to-base exists; p99 < 8ms.
- Screenshot opening → `critic/out/p96.png` (Playwright, `waitUntil: 'domcontentloaded'`, do **not** use `scripts/screenshot.mjs` if it hangs on `networkidle`).
- Pan `__STARHOLD_INPUT__` to a height-3 tile, `halfH = 8`, screenshot `critic/out/p96-ridge.png`. The PNG must show a **cliff wall / terrace lip**, not another pancake and not just darker void paint.

## Commit + report

```
git add src/terrain.ts src/render.ts src/sim.ts src/height.ts src/main.ts tasks/P96.md
```

Never `git add -A`. Never `notes.md`.

```
git commit -m "P96: iterate cliffs after flatten — iso terrace walls that block"
```

Rewrite `tasks/P96.md` with the new order, probe numbers, and how you verified. Stay in this gap.
