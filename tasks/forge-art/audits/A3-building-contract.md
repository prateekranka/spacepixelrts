# A3 — Building Contract Audit (Forge Art Lab v1)

Scope: production building sprites as drawn by `src/sprites.ts`, their atlas contract,
runtime presentation in `src/render.ts` + `src/sprite-sdf.ts`, sim-side construction
truth (`src/sim.ts`), and what the historical 3D town-center viewers can (and cannot)
contribute. All line refs are current at time of writing.

---

## 1. Per-production-building contract

### Atlas layout (source of truth: `buildSpriteAtlas()`, sprites.ts:2594–2758; consumed by `SDF_FRAG`, sprite-sdf.ts:148–197)

- Canvas: **512 px wide** (`ATLAS_COLS=16 × ATLAS_CELL=32`), height = `unitRows*32 + 4*64 + worker8 rows`.
- `unitRows = ceil(7 kinds × 3 civs × 7 frames / 16) = 10` → **buildingBaseY = 320 px**.
- Buildings occupy **rows 320–576**, one 64 px row per building kind (row stride is `HALL_CELL=64` **for all four**), **3 columns = civ** (`col = civ`, civ-major — opposite of unit slots which are kind-major).
- Hall is blitted `dx = civ*64` (fills its 64 cell); the three 32 px buildings are blitted `dx = civ*32 + (32−32)/2 = civ*32` (left-aligned, no centering needed today).
- All building Pix are **top-anchored** in their row (`dy = base + (bk−10)*64 + (cell−pix.h)`, and `cell === pix.h` always ⇒ dy = row top). This is the opposite of unit blits (`blitUnit` bottom-anchors). The sprite's transparent bottom rows are *inside* the sampled cell.
- Shader addressing mirrors this exactly: `row = uBuildingRow + (kind−10.0)`, `rowY = uUnitRows*uCell + (kind−10)*uHallCell`, `cellSz = kind<10.5 ? uHallCell : uCell`, `pixH = cellSz` (so the full cell incl. bottom padding is sampled).

### The four sprites

| | **Core / Hall** | **Habitat / House** | **Yard / Barracks** | **UniqueB (private)** |
|---|---|---|---|---|
| fn / cell | `drawHallPix` 64×64 (sprites.ts:2382) | `drawHousePix` 32×32 (:2413) | `drawBarracksPix` 32×32 (:2437) | `drawUniquePix` 32×32 (:2470) |
| atlas row / col | `buildingRow+0`, y 320–384, x `civ*64` | `+1`, y 384–448, x `civ*32` | `+2`, y 448–512 | `+3`, y 512–576 |
| iso box `isoVerts(cx,footY,footW,wallH,roofW)` | (32, 46, 50, 26, 42) | (16, 23, 24, 13, 20) | (16, 22, 26, 12, 22) | (16, 23, 24, 14, 21) |
| footprint diamond (px) | x 7–57 (50 w), y 33.5–58.5 | x 4–28 (24 w), y 17–29 | x 3–29 (26 w), y 15.5–28.5 | x 4–28, y 17–29 |
| roof peak (px) | y ≈ 7.5 | y ≈ 4 | y ≈ 3.5 | y ≈ 3 |
| ground-contact row (footS) | **y ≈ 58–59** of 64 | **y = 29** of 32 | **y ≈ 28** of 32 | **y = 29** of 32 |
| bottom padding in cell | rows 60–63 (≈4 px) | rows 30–31 (≈2–3 px) | rows 29–31 | rows 30–31 |
| door (`drawDoorOnSouth`) | 13×7 @ 38% along S edge | 9×5 | 11×5 | 9×5 |
| windows | 3 south + 3 east (2×2, ice + cream glint) | 2+2 | 2+2 | 2+2 |
| civ roof accent | circ hi (vespari) / CRY_H spire (aurion) / VOID_D + VOID_H orbs (void) | circ hi / CRY_H px / VOID_D px | BONE antennae / CRY_H + WHITE / VOID_H antennae | circ + SOL_H crown / CRY_H spire + CRY_D fins / VOID_D pillar + VOID_H orbs |
| **Team emissive (MAG)** | 3 px spire orb at roof peak (cx,roofN)+(cx±1,roofN+1) | 2 px porch lantern (cx−5/cx−4, footS−4) | 3 px gate lamp (cx−1..cx+1, footS−5/−4) | 3 px staff orb at roof peak |

### Palette families (sprites.ts:26–49, 87–91, civPal :134)

- **Shared structural palette (civ-invariant)**: walls `WALL=steel #637381`, `WALL_H=muted`, `WALL_D=slate`; roof = civ `pal.md/hi/dk` banded in thirds (`fillRoof3`); `INK #0B0A12` outlines; `WIN=ice`, glint `cream`, `DOOR=ink`.
- **Civ families** (`civPal`): vespari `md=leaf #4E8A5A / hi=lime #9CCB6E / dk=moss #294A3A`; aurion `md=sky #7FA7B8 / hi=ice #B7D1D0 / dk=fog #29323D`; voidmarked `md=plum #5A315D / hi=coral #D78A9A / dk=shadow #3A2030`.
- **MAG handling (renderer, sprite-sdf.ts:223)**: `if (colRgb.r>0.85 && colRgb.b>0.85 && colRgb.g<0.22) colRgb = vTeam` — magenta pixels are replaced per-instance by team color. No palette token collides with this test (cream r=.94 g=.91; coral r=.84; sand g=.54), so MAG is a reliable team-lamp marker. Every building has exactly **one 2–3 px MAG cluster**; `vFlash` (hit flash) adds to all pixels.

### Anchor / ground-row behavior in the world (render.ts:1796–1845)

- Buildings are 1×1 billboards on the SDF instanced mesh: `cellsW=cellsH=1` (Hall gets 2×2 but `mul = targetH/cellsH` normalizes), `targetH` Hall 2.4 / House 1.75 / Barracks 1.85 ⇒ plane scale = targetH (UniqueB 1.85 via else-branch default). `scaleX = cellsW*mul*e.facing` — **facing multiplies building scale** (always 1 in practice; see Risks).
- `lift = 1.15` for all buildings; plane bottom is NOT the ground line. The sprite's transparent bottom rows are the visual margin that lands the drawn footprint near the ground. Ground contact ≈ plane_bottom + (padding/32)·scaleY.
- Shadows (render.ts:1856–1860): every entity incl. buildings gets an ellipse `radius*2.2 × radius*1.6` world units at ground+0.03 (Hall ≈ 2.97 × 2.16).

### Footprint radius vs visual width (content.ts STATS)

| | radius (game units) | shadow width (2.2r) | billboard width | ratio shadow/billboard |
|---|---|---|---|---|
| Hall | 1.35 | 2.97 | 2.4 | **1.24 — footprint wider than art** |
| House | 0.85 | 1.87 | 1.75 | 1.07 |
| Barracks | 1.05 | 2.31 | 1.85 | **1.25** |
| UniqueB | 0.95 | 2.09 | 1.85 | 1.13 |

→ The gameplay footprint (radius → `canPlace` exclusion, shadow, selection) is **not** a 1:1 proxy for the drawn sprite width; Hall and Barracks visibly sit inside their shadow/selection ellipse. Selection ring overlay: `rx = radius*38+10, ry = radius*14+4` **screen px** (render.ts:2213–2214) — camera-dependent, not a world metric.

---

## 2. Construction-state truth (what the game ACTUALLY shows)

Sim (sim.ts):
- `Ent.progress` (:66), default **1** on spawn (:350).
- `tryPlace` (:554–579): the building entity is spawned **immediately at full sprite fidelity**; `progress = BUILD_HP_START = 0.08` (content.ts:207); `hp = max(1, st.hp * 0.08)`.
- Worker build loop (:1282–1287): while worker within `(radius+0.5)²` → `progress += DT*0.12` (**~7.7 s** from 0.08), `hp = maxHp*progress`; at `progress ≥ 1` worker → Idle.
- Production/pop/AI all gate on `progress ≥ 1` (:409, :498, :1660, :2167, :2517–2518).

Render (render.ts): **`e.progress` is never read for buildings.** The sprite, scale, lift, shadow, and selection ellipse are identical at progress 0.08 and 1.0. What changes visually:
1. **HP bar** — `damaged = hp < maxHp` (always true while constructing) ⇒ a bar renders over ANY unselected under-construction building (render.ts:2223–2225), bar width = `hp/maxHp = progress`.
2. `hitFlash` tint if attacked (sdfFlash).
3. Selection ring / bar colors by team.
4. **Destroyed**: `kill()` → buildings just go `alive=false` (sim.ts:398–403); **no corpse, no dissolve, no ruin** — the sprite vanishes. (Unit corpse/dissolve frames 4–6 do not exist for buildings.)

### REAL states (tool may present)
- `complete` — progress ≥ 1, hp == maxHp.
- `constructing` — 0.08 ≤ progress < 1: same sprite + partial HP bar (+ worker staged beside it).
- `damaged` — progress ≥ 1, hp < maxHp: same sprite + partial HP bar (+ hitFlash frame if captured mid-flash).
- `destroyed` — alive=false: nothing rendered. A viewer may show an empty footprint ring + `destroyed` label; showing a ruin sprite is NOT a production state.

### SYNTHETIC-PREVIEW-ONLY (do not label as production)
- Progress-scaled sprite size, scaffold/crane/skeleton variants, raised-foundation stages, phased building (stage 1–4 shells like the 3D town center), ghost/placement preview, fog-reveal *animation*. The production sprite is one static Pix per kind×civ; any construction *visual* progression other than the HP bar is invented.

---

## 3. Recommended v1 building passes, ranked

### Tier A — pure 2D, derivable from `drawBuildingSprite` Pix / atlas alone (no live renderer)
1. **Source** (kind×civ×cell at 1:1) — ground truth for everything else.
2. **Alpha / silhouette** — coverage %, tight bbox, padding rows, convexity, iso diamond 2:1 ratio check.
3. **Value ramp** — per-face value bands (roof hi/md/dk thirds, wall WALL_H/WALL/D), value spread vs terrain tokens; catch "muddy" or "flat" roofs.
4. **Team-color map** — MAG cluster detection (count, centroid, size, adjacency to outline); verifies the "one visible team lamp per building" contract.
5. **Palette-family audit** — every non-outline pixel must resolve to the civ family or the shared structural set (exact STARHOLD token match); flags stray hexes.
6. **Ground-contact analysis** — footS row, contact-pixel count, bottom padding, door bottom vs footS (door must touch ground row − 1).
7. **Iso geometry overlay** — recompute `isoVerts` from the code path and verify sprite geometry matches the declared footprint (also drives the footprint-ring overlay in the viewer).

### Tier B — needs the live renderer (real-game renderer + camera only)
8. **Camera views** — gameplay-close / normal / far / strategic frames of each building staged on real terrain (ortho presets are fine *as camera poses*, see §4).
9. **Fog states** — unexplored (hidden: `vis=false`), half-explored (fog plane tint), fully explored, `fogOfWarEnabled` on/off; fog is a transparent ground-plane mesh (terrain.ts:317–336) drawn over sprites, and entity visibility is `e.vis`-gated.
10. **Scale reference scene** — Worker + combat units (Fighter/Ravager) staged around the building (stageFixture pattern, §qa model below) to judge size readability and the footprint-vs-art mismatch.
11. **Overlay states** — selection ring + HP bar (complete / constructing / damaged), hitFlash frame.
12. **Nearby-density scene** — buildings clustered 1 tile apart (visual separation, shadow overlap).

### Tier C — explicitly out of v1 (needs the 3D model pipeline)
13. Clay / wireframe / normal / depth / material-ID passes on a 3D mesh, explode, part picking against 3D parts, PMREM lighting turntable. The 2D sprites have no geometry beyond the iso-box formulas; silhouette/wireframe equivalents are Tier-A overlays drawn from `isoVerts`.

**QA staging model** (borrowed from scripts/qa-vs4-combat-assets.mjs:763–844 `stageFixture`): zero all `world.ents` (alive/vis=false, vx/vz=0, path/tid=null), set `kind===10` progress=0.5, clear `landmarks.discoveredBy`, `fogOfWarEnabled=false`, `winner=-1`; spawn specs via `world.spawn(kind,civ,team,x,z)` then overwrite x/z/tx/tz/facing/order/hp/maxHp/vis; clear `input.selected`/`box`; set `input.pan` + `view.lookAt/setZoom`; optionally stub `world.step` after N steps and clear flags/links/landmarks for determinism.

---

## 4. Geometry-viewer verdict (town-center-* + sunweaver-town-center*)

### Concepts to BORROW (pattern-level only)
- **Fixed orthographic view presets with per-view half-height** (`gameplay-close/normal/far`, front/right/back/left/top-ortho) — town-center-structural-viewer.ts:60–71. Reuse the *naming and framing discipline*, reimplement for the 2D world camera.
- **Pass-switching harness** (`silhouette / wireframe / normal / depth / material-id / palette / beauty`, applyPass :91–121) — for the 2D tool: silhouette = alpha mask, wireframe = iso-verts overlay, depth = value map, material-id = face labels (roof/walls/door/windows/team-lamp), palette = token-classified pixels. The *concept* transfers; the *implementation* is 2D, not MeshBasicMaterial swaps.
- **Stage slider** (`[data-stage]` 1–4 + `setStage`) — borrow the UI as a **construction-progress slider (0.08→1) driving the SYNTHETIC-PREVIEW-ONLY progress presentation** (§2), explicitly labeled as preview.
- **Footprint ring** — stageRing/radial-lines (town-center-viewer.ts:105–126) → draw the radius-based ellipse + iso diamond at ground level in the 2D view.
- **Part picking + readout** (raycaster → `partId` readout, town-center-viewer.ts:206–215) → 2D equivalent: hover/click pixel → face classification readout (roof/wall/door/window/MAG).
- **Frozen QA capture + global handle** (`freeze` param, `__SUNWEAVER_STRUCTURAL__` runtimeHost, `document.body.dataset.ready`, deterministic key-pan) — keep for scripted screenshots.
- **Manifest discipline** — `StructuralManifest` (footprintDiameter, entranceAxis, normalizedDimensions, part counts) → produce an equivalent JSON manifest per building kind (kind, cell, atlas row/col, isoVerts params, door/window counts, MAG pixels, radius, targetH).

### Hard EXCLUSIONS (conflict with the one-live-context rule and real-game renderer rule)
- **Own `THREE.WebGLRenderer` context** (both viewers create one; town-center-viewer.ts:43–50) — v1 must render through the game's single live context (SDF instanced mesh + overlay canvas), frozen-frame capture only.
- **`OrbitControls` perspective turntable** (both viewers) — v1 uses the game camera (pan/zoom), fixed presets.
- **PMREM / `RoomEnvironment` environment** and **ACESFilmic tone mapping** (town-center-viewer.ts:45–57) — the 2D sprite pipeline is unlit flat texture (NearestFilter, SRGBColorSpace, no tone mapping).
- **Its own rAF render loop** (town-center-structural-viewer.ts:180–207) — v1 is driven by the game's renderer; no independent loop, no `THREE.Clock`.
- **Explode slider, animated crystal/solar rings, 3D part sets, 4-stage construction cages** — all geometry the 2D sprite does not have.
- **CONFIRMED: no import of `sunweaver-town-center.ts`, `sunweaver-town-center-structural.ts`, `town-center-viewer.ts`, or `town-center-structural-viewer.ts` into the new tool.** They model a *different, 3D town center* (D=7 units, stages, crystal jewel, ~14-part plinth/drum/stairs structure) that is not the v1 production Hall sprite (a 64 px iso box). Concept borrows above are re-implementations, not imports; at most the viewer HTML files serve as *reference screenshots* for the audience of the old tool.

---

## 5. Building metric set proposal (thresholds UNPROVEN)

Every threshold below is a **placeholder** — mark `UNPROVEN` until a v1 gate run over the 4 kinds × 3 civs sets a bar.

### Pure-2D computable (Tier A)
| metric | computation | placeholder threshold |
|---|---|---|
| source coverage | opaque px / cell px | ≥ 30% (Hall) / ≥ 35% (32px) UNPROVEN |
| tight bbox vs cell | bbox w/h vs cell; margin rows | ≤ 4 px padding per side UNPROVEN |
| ground contact | opaque px in footS row ± 1 | ≥ 8 px across diamond UNPROVEN |
| bottom padding | rows below footS | 2–4 px, constant per kind UNPROVEN |
| iso consistency | diamond w/h ratio (2:1), roofN over footN, wall rise vs roofW | within 5% of 2:1 UNPROVEN |
| value ramp bands | distinct luma clusters per face | ≥ 3 bands/roof, 3/wall UNPROVEN |
| palette purity | % px matching STARHOLD tokens (civ family + structural set) | 100% UNPROVEN |
| team lamp | MAG cluster count/size/centroid | exactly 1 cluster, 2–3 px, on roof or door zone UNPROVEN |
| door contact | door bottom row vs footS | door bottom == footS − 1 UNPROVEN |
| civ distinctness | per-kind ΔE between civ roof families | min ΔE ≥ 60 UNPROVEN |

### Renderer-measured (Tier B)
| metric | computation | placeholder threshold |
|---|---|---|
| on-screen height | px height at fixed zoom presets (close/normal/far) | Hall ≥ 48 px at close UNPROVEN |
| strategic readability | min silhouette dimension at far zoom | ≥ 8 px UNPROVEN |
| footprint/art mismatch | shadow width vs billboard width | ≤ 1.25× (Hall/Barracks currently at limit) UNPROVEN |
| fog contrast | sprite vs fog-tinted bg luminance delta | ≥ 0.25 UNPROVEN |
| team-lamp visibility | post-`vTeam` replacement px at far zoom | ≥ 1 px visible UNPROVEN |
| density separation | adjacent buildings, silhouette overlap % | ≤ 30% UNPROVEN |

---

## 6. Risks that could bite a viewer implementation

1. **hallCell row-stride mixing**: all four building rows are 64 px tall; the three 32 px sprites are **top-anchored** in their row (`dy = base + (bk−10)*64 + 0`). Any code assuming 32 px per building row, bottom-anchoring, or `row = buildingRow + bk` (without the −10 offset) reads garbage. `worker8Y = unitRows*32 + 4*64` depends on exactly 4 rows × 64 — changing buildingRows breaks the worker strip below.
2. **Hall canvasX has no padX** (sprite-sdf.ts:192: `col*uHallCell + vUv.x*spr`) while 32 px buildings use `col*uCell + padX + vUv.x*spr` with `padX=(cellSz−spr)*0.5` — padX is 0 *only because* building sprites are exactly cell-sized. Any future building Pix smaller than its cell would be centered by the blit ((32−w)/2) but NOT by the shader (`spr` stays 32) → off-center sampling. Not a live bug; a latent contract trap.
3. **Shader kind-branching is positional**: `kind ≥ 9.5` ⇒ building row (`kind−10`), `kind < 0.5` ⇒ worker8 branches. `Kind.Resource=20` would hit the building branch if ever drawn on the SDF mesh (it isn't — Resources use propMesh). A viewer staging entities must never push Resource through the sprite path. Also `col = civ` is set once for ALL branches — building columns are civ-major, unlike units.
4. **`scaleX = cellsW*mul*e.facing`**: `facing` multiplies building scale (render.ts:1805). Buildings spawn with facing=1 and never change it, but a fixture that sets facing=0 or −1 (unit-style flip) will collapse or mirror the building. Fixtures must pin `facing=1`.
5. **`lift=1.15` + sprite padding**: the billboard plane bottom is ~1.15 − scaleY/2 below its center; the drawn footprint lands where sprite padding dictates (≈4 px of 64 for Hall, 2–3 of 32 for others). A viewer that draws the footprint ring at the plane bottom (or at `groundY`) will be off by the padding/scaleY — compute ground contact from the sprite's footS row, not the plane.
6. **Footprint ≠ art**: radius (Hall 1.35 → 2.7 world units) exceeds billboard width (2.4) — shadows and selection ellipses overhang the art for Hall (1.24×) and Barracks (1.25×). Do not derive visual size from `radius`, and do not claim footprint-ellipse == silhouette in any metric.
7. **Selection ring is screen-space** (`radius*38+10` px, overlay canvas) — never compare it to world-space metrics; it changes with zoom.
8. **No building corpse/dissolve**: `frameFor` corpse logic (render.ts:1949–1953) is dead for buildings (alive=false ⇒ never drawn); the shader's dissolve hash uses `frame`, which is 0 for buildings. Don't add ruin states; a "destroyed" shot is an empty footprint ring only.
9. **Construction is HP-bar-only**: since render never reads `progress`, screenshots of construction differ from complete only by the overlay bar + worker presence. If a pass needs "mid-construction art", it must be explicitly SYNTHETIC-PREVIEW-ONLY (progress-driven alpha/scale) and never shipped into the game path.
10. **`buildings.png` at repo root** is a probe artifact, not authoritative — the atlas is generated at runtime by `buildSpriteAtlas`; always slice from the live canvas (or regenerate via `drawBuildingSprite`), never from that PNG.
11. **StageFixture determinism**: `world.step = () => {}` after staging is what keeps screenshots stable; forgetting it lets the AI/worker loops move entities, and `kind===10 progress=0.5` is hardcoded in the pattern — a building fixture must set progress per staged building and pin `hp = maxHp*progress` to keep the bar honest.
12. **Fog render order**: fog is a transparent, depthWrite:false ground plane added *after* the sprite mesh (render.ts:1598–1602 vs 1533) — it draws over sprite bottoms in unexplored tiles. The tool must gate shots by `e.vis`/`discoveredBy` (and `fogOfWarEnabled`), not expect occlusion to "just work".

---

*Audit A3 — read-only; single owned write: this file. No git mutations.*
