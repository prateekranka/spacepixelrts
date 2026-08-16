# Spacepixel RTS — Architecture

Contract for every builder. Do not invent a second renderer, a second loop, or a second entity format.

---

## 1. Non-negotiables

1. **Deterministic fixed-tick sim** at `TICK_HZ = 20` (`DT = 0.05`). Render interpolates with `alpha = acc / DT`.
2. **SoA + index IDs.** Hot data in typed arrays (or a single preallocated `Ent[]` of MAX slots — no `new` on the tick). `MAX_ENTS = 2048`. Free list for spawn/kill.
3. **Zero per-frame allocation on hot paths.** No `push` that can grow unbounded inside `World.step` (bolt/flag pools are fixed). No closures allocated in the tick. No `Array.filter` on entities.
4. **Pixel-crisp.** Nearest-neighbor, no mipmaps, no `antialias: true`, no CSS smoothing on the canvas. Integer zoom. Camera snapped to pixels.
5. **One atlas, few draw calls.** InstancedMesh (or one ShaderMaterial instanced batch) per layer. Layers: terrain, shadows, buildings, units, projectiles, fog, overlays.
6. **Sim does not know Three.js.** Renderer does not write sim state except through the command queue.
7. **60 fps always** on landscape iPad (budget below). Playwright critic measures real rAF.

---

## 2. Loop

```
acc += frameDt (clamped 0.1)
while acc >= DT:
  world.step()          # 20 Hz
  acc -= DT
alpha = acc / DT
input.flush(commands)   # applied at start of next step
renderer.draw(world, alpha, camera)
hud.draw(world, selection)
```

`requestAnimationFrame` in `src/main.ts`. `performance.now()` for dt. Expose `window.__STARHOLD__` for the critic:

```ts
type Probe = {
  fps: number
  frameMs: number
  tick: number
  ents: number
  drawCalls: number | null
  version: string
}
```

FPS is an exponential moving average of rAF intervals.

---

## 3. Coordinate spaces

| Space | Units | Origin |
|---|---|---|
| **Sim / world** | tiles, float x,z | (0,0) NW-ish; map `[0, MAP)` |
| **Isometric screen** | pixels | `sx = (x - z) * 32`, `sy = (x + z) * 16` at zoom 1 (64×32 diamonds) |
| **Camera** | world x,z + zoom ∈ {2,3,4} | look-at point |

`MAP = 64`. Tile index `i = x + z * MAP`. Pathfinding is 8-connected; Rock tiles block.

Depth sort key for sprites: `x + z` (then `y` if we add height later). South-east draws on top.

---

## 4. Simulation module

**Seam:** `src/sim/world.ts` exports `World`.

```ts
class World {
  reset(seed: number): void
  step(): void
  spawn(kind, civ, team, x, z): Ent | null
  kill(e: Ent): void
  issue(ids: number[], ord: Ord, x: number, z: number, tid: number): void
  tryTrain(building: Ent, kind: Kind): boolean
  tryPlace(team, kind, x, z, builderId): boolean
  pathfind(sx, sz, gx, gz): number[] | null  // x,z pairs, pooled
}
```

**Ent** (preallocated): `id, alive, kind, civ, team, x,z, px,pz, vx,vz, hp,maxHp, order, tx,tz, tid, cargo, cargoType, cooldown, anim, facing, radius, vis, path, pathI, progress, trainKind, trainT, rallyX,rallyZ, stealth, frenzy, blinkCd, buildKind`.

`px,pz` are positions at the **start** of the tick for interpolation: `rx = px + (x-px)*alpha`.

**Spatial hash:** 2-tile cells, rebuild each tick (clear + insert alive). Query fills a reused `q: number[]`.

**Commands:** ring buffer of `{ ids, ord, x, z, tid }` applied at tick start. Input never mutates ents directly.

**RNG:** `mulberry32(seed)`. Map gen and AI use it. Combat is deterministic given positions (no roll).

**Teams:** 0 player, 1 enemy, 3 resources/neutral.

---

## 5. Pixel render pipeline

**Seam:** `src/render/renderer.ts` exports `Renderer`.

### 5.1 Atlas

Procedural canvas 1024×1024 (or 2048 if needed), uploaded once as `THREE.CanvasTexture`:

- `minFilter = magFilter = NearestFilter`
- `generateMipmaps = false`
- `colorSpace = SRGBColorSpace`
- Magenta `#FF00FF` is the **team-color key**. Shader replaces it with team palette (player amber, enemy crimson, extra teams later).

Sprites: 32×32 units, 64×64 halls, 64×32 terrain diamonds (or 32×32 cell that is already diamond-padded). UV table `Record<string, Uv>`.

Frames: idle0, idle1, walk/bob, attack flash, death. Two-frame bob is enough if silhouettes are strong.

**Master palette** (quantize all pixels to these + magenta + 0 alpha). Count should stay ~32–40 distinct on a screenshot of the canvas:

```
ink #0C0816
void #0A0814
dust #1C1628
dust2 #2A2238
rock #3A3040
rockH #56485C
ore #C69A48
oreH #F0D678
gas #5CA8D2
gasH #BAE6FF
sol #F0C448
solH #FFECAa
helionGold #FFD36A  helionRed #FF5A3C  helionBone #FFF1D2
kryosIce #7EE7FF    kryosInd #3A5BFF   kryosSil #C9D4E8
nihSpore #B84CFF    nihVir #1CFF9A     nihBruise #2A0A28
hpGreen #6CFF8A     hpRed #FF4A4A      sel #FFE48A
fog #05040A
white #F4EEE2
```

### 5.2 Batching

One `InstancedMesh` of a unit quad per layer (or one mega-mesh with an instance `layer` unused — prefer **one mesh per layer** so terrain can skip unit shader branches):

- `terrain`: MAP*MAP instances, static until map change
- `shadows`
- `buildings`
- `units`
- `bolts`
- `fog` (explored vs visible: two-tone overlay quads, or a second map texture)

Instance attrs: `a_iso: vec2`, `a_uv: vec4 (u0,v0,u1,v1)`, `a_tint: vec3` (team), `a_alpha: float`, `a_depth: float`.

Vertex shader places the quad in **already-isometric clip space** relative to camera. Fragment: sample atlas nearest, discard a < 0.1, replace magenta with tint.

**Do not** use `THREE.Sprite` per entity. **Do not** use MeshBasicMaterial with 2k unique meshes.

### 5.3 Camera

Orthographic camera whose frustum is the iPad landscape CSS pixels (devicePixelRatio capped at 2). World-to-view:

```
sx = ( (x - camX) - (z - camZ) ) * 32 * zoom
sy = ( (x - camX) + (z - camZ) ) * 16 * zoom
```

Then snap `(sx,sy)` to integer device pixels.

### 5.4 Background

A full-screen starfield + nebula **behind** the isometric world (separate scene or a large quad at max depth). Stars are palette whites/golds, sparse. Nebula is a low-frequency dithered wash (Helion gold vs Kryos indigo vs Nihiline purple depending on map seed) — not a rainbow blob.

---

## 6. Input

**Seam:** `src/input/input.ts` exports `Input`.

Pointer + touch unified into:

- `pointers: Map<id, {x,y, t0}>` in CSS pixels
- Gesture state machine: `Idle | PendingTap | BoxSelect | PanZoom | LongPress`
- Hit test: reverse iso, spatial hash query, pick closest unit with screen dist < 28px (generous for thumbs)
- Box select: world-AABB from iso-unproject of the two corners
- Emits commands into `World`'s queue plus UI events (`select`, `hover`)

---

## 7. HUD

HTML overlay (`#hud`), not WebGL, so it stays sharp and accessible. Canvas is `#view`. HUD does not cover the whole fight: top resource strip ~36px, bottom command ~88px, minimap 160px square with 12px margin.

Minimap is a 64×64 canvas 2d, nearest scaled, updated every 4 ticks.

---

## 8. Frame budget (16.6 ms)

| Slice | Budget |
|---|---|
| Sim step (maybe 1, never >2 stacked except hitch) | 2.0 ms |
| Path repath (amortize: max 8 A* per tick) | 1.5 ms |
| Spatial hash + combat queries | 1.0 ms |
| Renderer instance uploads | 4.0 ms |
| GPU | 6.0 ms |
| HUD / minimap | 1.0 ms |
| Headroom | 1.1 ms |

If over: cut fog fill rate, cut corpse TTL, pool bolts, don't rebuild terrain instances.

`MAP=64`, ~80–200 alive ents in v1 skirmish. Stress later: 400 units.

---

## 9. File layout

```
src/main.ts                 boot, rAF, probe
src/loop.ts                 fixed timestep
src/sim/world.ts            World
src/sim/engine.ts           Ent, Kind, Ord, Spatial, Heap, constants
src/sim/path.ts             A* (may live in world until split)
src/content/stats.ts        STATS, costs, civ bonuses
src/content/civs.ts         Civ id, unique unit/building
src/render/palette.ts       master palette
src/render/atlas.ts         procedural sheet
src/render/renderer.ts      InstancedMesh layers
src/render/camera.ts        pan/zoom/snap
src/input/input.ts
src/ui/hud.ts
src/ai/script.ts            enemy marshal
critic/run.ts               Playwright harness
docs/                       this contract
tasks/                      per-piece reports
```

Entry: `index.html` → `/src/main.ts`. Vite. TypeScript strict.

---

## 10. Deploy

```
npm run build
wrangler pages deploy dist --project-name=spacepixelrts
```

Live: `https://spacepixelrts.pages.dev`. Deploy after every piece that changes pixels.

---

## 11. Testing / critic

`npm run critic` boots Vite (or uses `CRITIC_URL`), Playwright Chrome, screenshot, rAF probe, console, palette histogram. Reports JSON to `critic/out/latest.json`. Critics **must** run this (or equivalent live inspection). They must not judge from the builder's `tasks/*.md` alone.
