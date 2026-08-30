# A4 — Real Renderer Integration Audit

**Scope:** Host the real `GameRenderer` (src/render.ts) on a tool-only page (`tools/forge-art/…`) with a deterministic World fixture — exactly one live WebGL context, no second renderer, clean teardown. Read-only analysis of render.ts / main.ts / sim.ts / engine.ts / input.ts / discovery.ts / opening-presentation.ts / terrain.ts / vfx.ts + the proven staging seam in scripts/qa-vs4-combat-assets.mjs (`stageFixture`).

**Repo:** spacepixelrts-forge-art-lab @ ced0b94. Build: vite (multi-entry via `rollupOptions.input`, pattern: `desktop.html`, `town-center-viewer.html`). Deps: three ^0.180.0, playwright ^1.55.0. `GameRenderer` is constructed **only** in `main.ts:136` today — the tool page is a new consumer.

---

## 1. Minimum viable instantiation recipe (tool page)

```ts
// tools/forge-art/renderer-rig.html → module:
import { World } from '../../src/sim';
import { GameRenderer, ISO_YAW, ISO_PITCH, ISO_DIST } from '../../src/render';
import { Kind, Ord, MAP } from '../../src/engine';

// 0) HOST — must be laid out BEFORE `new GameRenderer(host)`.
//    Constructor reads host.clientWidth/clientHeight for canvas size AND
//    camera aspect (render.ts:1419,1430). A 0×0 host yields a 0×0 canvas and
//    a degenerate camera; recoverable by calling resize(w,h) afterwards
//    (resize recomputes halfW from the current camera halfH), but avoid it.
//    Give the host a fixed CSS size (e.g. 1280×720, position:relative;
//    both canvases are appended as children, absolutely-positioned by CSS).
const host = document.getElementById('stage')!;

// 1) WORLD FIXTURE — mirror of main.ts:130-134:
const world = new World();
world.civ[0] = 'vespari';          // player side
world.civ[1] = 'aurion';           // rival side
world.fogOfWarEnabled = true;      // or false; render honors it (see §3)
world.aiDifficulty = 'standard';
world.reset(seed >>> 0);           // deterministic: mulberry32(seed)+hash2 terrain
//    reset() → genMap() + spawnScenario(): Hall@(10.5,10.5), 4 workers, 1 scout,
//    3 resource nodes per team (sim.ts:1021-1048), tick=0.

// 2) CONSTRUCTOR — all side effects (render.ts:1411-1442):
//    - new THREE.WebGLRenderer({antialias:false, powerPreference:'high-performance',
//      alpha:false}); setPixelRatio(1); setSize(host.clientWidth, clientHeight, false);
//      clear color P.ink; canvas#game appended to host.
//    - overlay canvas#overlay (pointer-events:none) + 2D ctx appended to host.
//    - OrthographicCamera: halfH=16, lookAt(18,22) (ix=18, iz=22 in constructor).
//    - scene.background = P.ink.
//    - **URL-param reads at class-field init**: proceduralScoutEnabled =
//      `?mesh !== '0'`; combatEnabled = `?combat !== '0'` (render.ts:1389,1391).
//      These are `readonly` — locked at construction; the tool URL MUST set them
//      deliberately (see §6). No other ambient reads.
//    Missing-app assumptions: Input / Hud / Sfx are NOT touched by the renderer.
//    world.onHit/onMuzzle are main.ts-only sfx hooks — absence is fine (draw
//    never calls them). The tool may pass an empty-array world state directly.
const view = new GameRenderer(host);

// 3) init(world) — ONCE per renderer. Every resource it creates (see §5) has no
//    removal path except resetWorld(); calling init twice double-adds meshes.
//    Star/nebula fields use Math.random() (render.ts:2017-2042) — seed the RNG
//    first for cross-run pixel-stable skies (see §6):
Math.random = mulberry32(0xC0FFEE);            // import { mulberry32 } from engine
view.init(world);
view.resize(host.clientWidth, host.clientHeight);  // main.ts:138 pattern

// 4) RENDER LOOP — see §2. Minimal manual draw:
view.setZoom(14); view.lookAt(36, 34);          // any camera preset (§4)
view.draw(world, 0, new Set<number>(), null);   // draw() needs ONLY world+alpha+Set+box
```

**`draw(world, alpha, selected, box)` without Input/Hud — CONFIRMED WORKING.** It is fully self-contained (render.ts:1677-1886): reads `world.ents`, `world.tick`, `world.visible[0]/explored[0]`, `world.flags`, `world.links`, `world.landmarks`, `world.lumenState()`, `world.sparks/bolts` (via VfxRenderer). `selected` is a plain `Set<number>` of ent ids; `box` may be `null`. Overlay annotations (selection ellipse, HP bars, flags, rig brackets, lumen marker) all derive from world state + the passed Set. `e.vis` gates drawing (render.ts:1706) — the fixture must set it (sim sets it in `updateFog`, which the frozen fixture never runs).

---

## 2. Frame driving — recommendation: manual draw (option b)

**(a) Real rAF + fixed accumulator** (main.ts:397-434): `raw = min(0.05, (now-last)/1000)`; `acc += raw * speed`; `while (acc >= DT && steps < 5) { world.step(); acc -= DT; }` then `view.draw(world, acc/DT, selected, box)` — `DT = 1/TICK_HZ = 0.05`, TICK_HZ=20 (engine.ts:5-6).

**(b) Manual `view.draw()` per interaction** (freeze-friendly, proven by stageFixture).

**RECOMMEND (b)** for the comparison tool: frames must be deterministic and screenshot-stable, so the sim is frozen (step is a no-op, camera set by hand, one draw per capture). Sequence:

```ts
// freeze (stageFixture, qa-vs4-combat-assets.mjs:763-843):
for (const e of world.ents) { e.alive = false; e.vis = false; e.vx = e.vz = 0; e.path = null; e.tid = -1; }
world.tick = 600;                    // > 240 ⇒ no opening clash-flash / worker diamonds / opening HP bars
world.winner = -1;
world.fogOfWarEnabled = <scene choice>;
// ... spawn fixture ents (§3), then:
world.step = () => {};               // pin the sim (stageFixture does exactly this)

// per capture (deterministic — frozen sim has px===x so alpha is inert):
view.setZoom(preset.halfH);
view.lookAt(preset.x, preset.z);
view.draw(world, 0, selected, null);
// screenshot now (Playwright page.screenshot); repeat for the next camera/scene
```

Determinism caveats: `draw()` uses `performance.now()` for worker-rig `frameDt` (render.ts:1682-1684) — with `?mesh=0` the sprite path has **zero** wall-clock dependence; with procedural workers enabled, pose damp state drifts by real elapsed time. Keep `?mesh=0` for pixel gates, `mesh=1` only for art-review shots (see §6).

---

## 3. Fixture builder design

**Base helper** (one function; call per scene after `world.reset(seed)` or reuse via `view.resetWorld(world)`):

```ts
function stage(world, specs) {            // specs: {kind,civ,team,x,z,facing,order,tx,tz}[]
  for (const e of world.ents) { e.alive = false; e.vis = false; e.vx = e.vz = 0;
    e.path = null; e.tid = -1; if (e.kind === Kind.Hall) e.progress = 0.5; }
  for (const lm of world.landmarks) lm.discoveredBy = 0;   // lumen marker off unless wanted
  world.winner = -1;
  return specs.map((s) => {
    const e = world.spawn(s.kind, s.civ, s.team, s.x, s.z)!;   // pops free-list slot; null if full
    e.x = e.px = s.x; e.z = e.pz = s.z; e.tx = s.tx; e.tz = s.tz;
    e.vx = e.vz = 0; e.facing = s.facing; e.order = s.order; e.tid = -1;
    e.path = null; e.pathI = 0; e.anim = 0; e.hp = e.maxHp;
    e.dissolveT = 0; e.corpseT = 0; e.combatT = 0; e.hitFlash = 0; e.vis = true;
    return e.id;
  });
}
```
All overrides copied verbatim from the proven `stageFixture` (qa-vs4-combat-assets.mjs:793-815). Ent ids are **stable array indices** (constructor sets `ents[i].id = i`; `spawn` pops the free list — sim.ts:208-211, 325). Keep the returned ids for `selected`.

**Scene spawn lists** (kinds: Worker 0, Scout 1, Fighter 2, Siege 3, Ravager 4, Prism 5, Shade 6, Hall 10, House 11, Barracks 12, UniqueB 13, Resource 20; Ord: Idle 0, Move 1, Attack 2, Gather 3, Return 4, Build 5, AttackMove 6 — engine.ts:29-52):

| scene | recipe |
|---|---|
| quiet terrain | `reset(seed)` + kill-all loop only; camera over empty dust |
| single unit selected | 1× Fighter vespari team 0 @ (36,36); `selected = new Set([id])` |
| mixed roster | 2× Fighter vespari, 1× Ravager vespari, 2× Fighter aurion, 1× Prism aurion, 1× Siege, 1× Shade (stealth default 1), 1× Scout, 1× Worker (vespari), spread around (36,36), facing 0/4 |
| confrontation lineup | stageFixture `lineup` verbatim: (30,34)F0, (37,34)R0, (30,42)F1, (37,42)P1, facing 0 vs 4, order Idle |
| battle clump | stageFixture `clash`: (29,35)/(31,36)/(43,41)/(45,42), order AttackMove(6), tx/tz crossed, then `for (let i=0;i<32;i++) world.step(); world.step=()=>{}; world.flags.length=0; world.links.length=0; world.landmarks.length=0` (mjs:833-837) |
| player base | reset + keep team-0 spawns (Hall+4 workers+Scout @ (10.5,10.5)); kill team-1; `fogOfWarEnabled=false` for full view; camera OPENING_CAMERA |
| rival base | mirrored: keep team-1 spawns (civ aurion Hall @ (61.5,61.5)); camera (56,56) |
| construction | Hall vespari @ (36,35) with `progress=0.5`; 2× Worker vespari `order=Build`, `buildKind=Kind.House`, near it; `hp=maxHp` |
| fog edge | `fogOfWarEnabled=true`; fill `visible[0]/explored[0]` rings manually AND set `e.vis` per ent (draw gates on `e.vis`; sim's updateFog is what normally maintains it); e.g. explored-only disc radius 6 (dim purple), visible radius 3 (clear), units inside/outside |
| three cameras | one lineup scene + the three presets of §4 (close/far/strategic) |

**Fog — which mechanism render.ts honors (verified):**
- `world.fogOfWarEnabled = false` → **honored directly**: `updateFog` sets `fogMesh.visible = world.fogOfWarEnabled` and returns early (render.ts:2061-2063). Full-bright map, no fog draw.
- `visible[0]` / `explored[0]` arrays → **honored per draw** when fog is on (render.ts:2064-2086): visible=clear, explored=dim purple (14,12,28,56), unexplored=dark (20,16,34,32). The rig may mutate these arrays freely between draws — `fogTex.needsUpdate` is set each draw.
- **`setReviewMode` / `reviewHooks` / `reviewMode` DO NOT EXIST** — grep across src/ finds none (only `qaFrozen` in main.ts). Any plan relying on an omniscient review toggle must use `fogOfWarEnabled=false` + `visible[].fill(1)` instead.
- `SEEN_PLAYER` (discovery.ts:6, bit 1) is used by render **only** for the LUMEN marker gate: `landmark.discoveredBy & SEEN_PLAYER` (render.ts:2248). Set `landmarks[0].discoveredBy = 1` to show it; `lumenState()` reads sim-private state reset by `reset()`.
- Entity visibility: `e.vis=false` ents are skipped entirely (render.ts:1706). Team-0 ents are always vis under sim rules; team>0 need `visible[0]` coverage or manual `e.vis=true`. Resources additionally gate on `seenBy & SEEN_PLAYER` in sim (sim.ts:1980-1982) — set `e.vis=true` explicitly when fog is manually staged.

---

## 4. Camera control

Constants (exported, render.ts:22-24): `ISO_YAW = π/4`, `ISO_PITCH = atan(0.5)`, `ISO_DIST = 40`. `lookAt(x,z)` places the camera at `(x + ISO_DIST·sin(ISO_YAW)·cos(ISO_PITCH), ISO_DIST·sin(ISO_PITCH), z + ISO_DIST·cos(ISO_YAW)·cos(ISO_PITCH))` and orients it; `setZoom(halfH)` rescales the ortho frustum preserving aspect. Independent — call in either order before `draw()`.

Presets (halfH = half vertical world span in world units):
- Constructor default: halfH **16**, target (18,22).
- Input defaults (input.ts:30-31,52-53): halfH **14**, pan (36, 34.56) after construction; zoom clamp 4–28 (input.ts:546).
- OPENING_CAMERA: {x:12, z:12, halfH:**9**} (opening-presentation.ts:12).
- QA-scenario cams (qa-scenarios.ts:86-105): halfH 24–42 (e.g. battle 32 @ (36,38), victory 40 @ (56,56), results 42).
- Self-view harness extras (self-view-harness.mjs:442-443): close **halfH 5**, far **halfH 18**.

Suggested rig presets: `close {5}`, `normal {14}`, `strategic {32}`; targets per scene (bases 10.5/61.5, center 36/37.4 — OPENING_CENTER = (36, 37.44)).

---

## 5. Disposal checklist (zero leaks)

**`GameRenderer` has NO `dispose()`** (verified — only `disposeTerrain`/`disposeFog` private helpers used by `resetWorld`, render.ts:1605-1638, 1984-2008). Full inventory of THREE resources created in `init()` (render.ts:1444-1603) — none released by resetWorld except terrain/fog:

| resource | created in | disposed anywhere? |
|---|---|---|
| atlas `CanvasTexture` (buildAtlas canvas) | init | **no** |
| sprite/combat/scout `CanvasTexture` ×3 (buildSprites) | init | **no** |
| SDF `PlaneGeometry` + ShaderMaterial + InstancedMesh(384) + 4 instance attrs | init | **no** |
| HemisphereLight + DirectionalLight + PointLight | init | **no** |
| `proceduralScout` group (≈120 geometries/materials) | init (mesh built once) | **no** (only removed from scene; kept for reuse) |
| prop `PlaneGeometry` + ShaderMaterial + InstancedMesh(384) | init | **no** |
| shadows `CircleGeometry` + MeshBasicMaterial + InstancedMesh(384) | init | **no** |
| VfxRenderer: PlaneGeometry + ShaderMaterial + InstancedMesh(2048) (vfx.ts:101-127) | init | **no** (VfxRenderer has no dispose) |
| terrain mesh + uTiles/uDecals/uHeight DataTextures (terrain.ts:289-315) | init + resetWorld | ✅ disposeTerrain (textures, geometry, material) |
| stars `Points` + PointsMaterial (280 pts) | init (Math.random) | **no** |
| nebula `Points` (55 pts, vertex colors) | init (Math.random) | **no** |
| fog `DataTexture` + fog mesh + height `DataTexture` (terrain.ts:317-336) | init + resetWorld | ✅ disposeFog (height tex, geometry, material); fogTex itself never disposed |
| procedural worker rigs (per live worker, heavy) | lazy in draw | ✅ only in resetWorld (render.ts:1620-1630) |

**What the tool must do instead** (all fields reachable — `renderer` and `overlay` are public readonly):

```ts
function teardown(view, host) {
  cancelAnimationFrame(rafId);                 // if using loop (a)
  view.renderer.dispose();                     // THREE.WebGLRenderer public API
  view.renderer.forceContextLoss();            // releases the GL context immediately
  view.renderer.domElement.remove();
  view.overlay.remove();                       // host is then empty
}
```
Then close the page in Playwright. **`page.close()` reclaims** the context: Chromium destroys the renderer process's GL surfaces on navigation/close, and the existing QA harnesses (self-view-harness.mjs, qa-vs4-combat-assets.mjs) create a fresh page per capture and rely on this — no leaked chromium/vite/GL processes observed (their pattern is `browser.newPage()` → visit → capture → `page.close()`). Residual GPU-allocator pressure from undisposed JS-side resources is freed when the context is lost/closed; `forceContextLoss()` makes it deterministic rather than GC-timed. QA assertion to add: exactly **one** `canvas#game` + one `canvas#overlay` in the page and `document.querySelectorAll('canvas').length === 2` before teardown, zero afterwards.

Reuse path (per-fixture, same page): `view.resetWorld(world)` after `world.reset(seed)` — disposes terrain/fog + worker rigs, rebuilds map/fog, clears overlay. Atlas/sprite/vfx/star resources persist across resets (intended; keeps frames stable).

---

## 6. Risks

1. **Multiple live WebGL contexts.** Every `new GameRenderer` = one context. Rule: **one live canvas per page**; never mount two rigs, never let the tool page also load the game page. Freeze comparisons as Canvas2D/compositor snapshots (`page.screenshot`) — that is a read, not a second context. Watch total pages in CI: N pages = N contexts (SwiftShader host budget).
2. **URL flags are locked at construction.** `?mesh=0` (sprite path — deterministic, recommended default for the rig) and `?combat=0` (legacy atlas branch) are readonly class fields read from `window.location.search` (render.ts:1389-1391). The tool page must be served with its own deliberate query string (e.g. `/tools/forge-art/renderer-rig.html?mesh=0&combat=1`); they cannot be flipped at runtime. `combat=1` also activates `combatWorldScale` billboards and `isCombatLiveEnt` gating — desired for the battle scenes.
3. **`proceduralWorkers` Map keyed by ent id.** Rigs are created lazily per id and only disposed in `resetWorld` (render.ts:1749-1754, 1620-1630). Ent ids are stable array slots, so a scene that kills and re-spawns into the same slot reuses the id → the old rig is simply re-hidden/re-shown (fine), but rig count grows with distinct ids; call `view.resetWorld(world)` between fixture families to release them. Wall-clock `frameDt` makes worker pose damp non-deterministic → keep `mesh=0` for gates (§2).
4. **`Math.random` in `buildStars`/`buildNebula`** (render.ts:2017-2042): every `init()` gets a different sky. Override `Math.random = mulberry32(fixedSeed)` before `view.init(world)` (only render path consumer; sim uses `mulberry32`/`hash2` internally). `resetWorld` does NOT rebuild stars — good for cross-scene consistency.
5. **Opening-tick effects** bleed into fixtures unless `world.tick >= 240`: clash flash radius boost (render.ts:1724-1731), worker diamond markers (2114-2130), and HP bars shown for all selected (2199-2226). Set `tick = 600` after staging (stageFixture precedent).
6. **Overlay is 2D and persists** between draws until cleared — `drawOverlay` clears each call (render.ts:2098), but `resetWorld` also clears it (1637). No action needed; noted for completeness.
7. **Host canvas id collisions**: renderer canvas is `#game`, overlay `#overlay` — unique per page (one rig rule in risk 1 makes this safe).
