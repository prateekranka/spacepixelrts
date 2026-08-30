# A1 — Current Asset Inventory (Forge Art Lab)

Repo: `spacepixelrts-forge-art-lab` @ branch `hermes/forge-art-lab` · Audit date: 2026-08-26 · Agent A1 (read-only + this file)

Sources read: `src/sprites.ts` (2762 ln, complete), `src/sprite-sdf.ts`, `src/atlas.ts`, `src/content.ts`, `src/engine.ts`, `src/render.ts` (scale/atlas/frameFor sections), `tests/vs4-combat-assets.test.ts` (1–100 + R3/R2/VS4A sections), `docs/CANONICAL_VOCABULARY.md`.

All sprite art is **startup-rasterized deterministic pixel data** from pure functions in `sprites.ts`. There are no authored PNGs anywhere. Colors come only from `STARHOLD_PALETTE` tokens; `MAG = [255,0,255,255]` is the team-color key replaced by the SDF shader at runtime.

---

## 1. Production asset rows (every production asset today)

Legend — facings: **authored** = distinct source cell, **mir** = exact `flipX()` mirror. Legacy slot frames (7 per kind×civ): 0–3 live, **4 = corpse, 5–6 = dissolve phases** (frameFor: dissolveT > ½ dur → 5, else 6). World scale = billboard `scaleX×scaleY` in world units from `render.ts`; `facingSign = e.facing >= 4 ? -1 : 1` for legacy-slot units.

| # | Canonical asset id (proposal) | Public label | Faction | Cat | Legacy kind# / civ | Source function(s) (exact) | Cell WxH | Facings authored vs mir | Frames / meaning | Runtime atlas location | World scale (X×Y, lift) | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `sunweaver-worker` | Worker | Sunweaver | unit | Kind.Worker=0 · `vespari`(0) | `drawWorker8Dir(0, dir, walk)` → `drawHelionWorker` → `drawHelionVariant(dir, walk>0, -1)`; corpse: `drawUnitSprite(0,'vespari',4/5/6)`; actions: `drawHelionAction8Dir(dir, action)` **(not exported)** | 32×48 (8-dir); 32×32 (legacy slot) | 5 authored (0,1,2,6,7) + 3 mir (3,4,5) | 8-dir: walk 0=idle / walk 1=walk-bob (leg-lift 1px, head bob); legacy: 0 idle, 1–2 walk, 3 unused, 4 corpse, 5–6 dissolve | main canvas y576–624 (walk strips cols 0–15); action rows y720–912 cols 0–7; corpse → legacy row 0 | live [1.55, 2.32] lift 0.90; corpse [1.55, 1.55] lift 0.55 | **Player-Sunweaver workers render as procedural 3D meshes by default** (`?mesh=0` forces sprites); actions are Helion-only (see §5) |
| 2 | `gravemark-worker` | Worker | Gravemark | unit | Kind.Worker=0 · `aurion`(1) | `drawWorker8Dir(1, dir, walk)` → `drawWorkerAuth(1,…)` Kryos Stonemason; corpse: `drawUnitSprite(0,'aurion',4/5/6)` | 32×48; 32×32 | 5 + 3 mir | same as #1 | main canvas y624–672; corpse → legacy row 1 | same as #1 | Never gets action rows (frameFor gates 7–10 to vespari); builds/attacks with idle/walk poses |
| 3 | `sunweaver-wind-strider` | Wind Strider | Sunweaver | unit | Kind.Scout=1 · `vespari`(0) | live HD: `drawHelionScoutHdPix()` **(not exported)**; low: `drawScoutPix(0)` (→ `drawHelionScoutPix`, not exported); corpse/dissolve: `drawUnitSprite(1,'vespari',4/5/6)` | 128×128 HD; 32×32 low | 1 authored + renderer mir | 7 frames on canvas; frames 0–3 HD, 4–6 = 32px corpse/dissolve upscaled ×4 | scoutCanvas cols 0–6 | [0.96, 1.12] lift 0.58 (sprite path); corpse [0.82, 0.88] lift 0.55 | **Player-Sunweaver scouts render as procedural 3D mesh by default** (single shared group); sprite path is AI/enemy + `?mesh=0` |
| 4 | `gravemark-grav-skimmer` | Grav-Skimmer | Gravemark | unit | Kind.Scout=1 · `aurion`(1) | `drawScoutPix(1)` (vehicle, not exported); corpse: `drawUnitSprite(1,'aurion',4/5/6)` | 32×32 | 1 + mir | 7 frames; all live frames identical (no anim), 4–6 corpse/dissolve | scoutCanvas cols 7–13 (upscaled ×4) | [0.96, 1.12] lift 0.58 | Only ever sprite-rendered (no procedural path) |
| 5 | `sunweaver-lumen-guard` | Lumen Guard | Sunweaver | unit | Kind.Fighter=2 · `vespari`(0) | combat: `drawCombatSprite(0, dir, pose)` → `drawLumenGuardCombat` (not exported) + rim; legacy: `drawFighterPix(0, frame)` (not exported); corpse: `drawUnitSprite(2,'vespari',4/5/6)` | 64×64 combat; 32×32 legacy | 5 + 3 mir (both strips) | combat: pose 0/1 gait alternation (shader: frame 0→pose0 col, frames 1–3→pose1 col); legacy: 0–1 idle bob, 1–2 walk, 3 attack (muzzle flash), 4–6 corpse/dissolve | combatCanvas row 0 cols 0–15; legacy rows 2–3 (slot 42+) | combat [1.59, 1.89] lift `scaleY*0.5+0.03`; legacy [0.96, 1.12] lift 0.58 | Combat strip is the live render path (`uCombatEnabled`); legacy only for corpse/dissolve or `?combat=0` |
| 6 | `sunweaver-solar-strider` | Solar Strider | Sunweaver | unit | Kind.Ravager=4 · `vespari`(0) | combat: `drawCombatSprite(1, dir, pose)` → `drawSolarStriderCombat`; legacy: `drawRavagerPix(0, frame)`; corpse: `drawUnitSprite(4,'vespari',4/5/6)` | 64×64; 32×32 | 5 + 3 mir | combat: pose gait; legacy: frame%2 lunge (frames 1,3), 0/1 idle, 3 attack | combatCanvas row 1; legacy rows 4–5 (slot 84+) | combat [2.05, 1.54]; legacy [0.96, 1.12] | Sunweaver unique unit (`uniqueUnit('vespari')` = Ravager) |
| 7 | `gravemark-rift-guard` | Rift Guard | Gravemark | unit | Kind.Fighter=2 · `aurion`(1) | combat: `drawCombatSprite(2, dir, pose)` → `drawRiftGuardCombat`; legacy: `drawFighterPix(1, frame)`; corpse: `drawUnitSprite(2,'aurion',4/5/6)` | 64×64; 32×32 | 5 + 3 mir | same as #5 | combatCanvas row 2; legacy rows 2–3 (slot 49+) | combat [1.67, 1.92]; legacy [0.96, 1.12] | Row 2 is the **only combat row NOT frozen** (VS4A replacement; anatomy contract only) |
| 8 | `gravemark-burden-walker` | Burden Walker | Gravemark | unit | Kind.Prism=5 · `aurion`(1) | combat: `drawCombatSprite(3, dir, pose)` → `drawBurdenWalkerCombat`; legacy: `drawPrismPix(1, frame)`; corpse: `drawUnitSprite(5,'aurion',4/5/6)` | 64×64; 32×32 | 5 + 3 mir | combat: pose gait; legacy: frame%2 hover (−1px), 0/1 idle, 3 attack | combatCanvas row 3; legacy rows 5–6 (slot 105+) | combat [2.05, 1.81]; legacy [0.96, 1.12] | Gravemark unique (`uniqueUnit('aurion')` = Prism). **N and S faces are pixel-identical for rows 1 & 3** (frozen hashes `1:6:*`==`1:2:*`, `3:6:*`==`3:2:*`) |
| 9 | `sunweaver-core` / `gravemark-core` | Core | both | building | Kind.Hall=10 · civ 0/1 | `drawBuildingSprite(Kind.Hall, civ)` → `drawHallPix(civ)` (not exported) | 64×64 | 1 iso view + renderer mir (`scaleX *= facing`) | none (static) | main canvas row 10 (y320–384), cols 0–2 = civs | [2.4×facing, 2.4] lift 1.15 | **Label drift**: canonical vocab says "Core"; `content.ts hallName()` still returns `"Nexus"` and HUD shows it |
| 10 | `sunweaver-habitat` / `gravemark-habitat` | Habitat | both | building | Kind.House=11 · civ 0/1 | `drawBuildingSprite(Kind.House, civ)` → `drawHousePix(civ)` | 32×32 | 1 + mir | none | main canvas row 11 (y384–448), cols 0–2 | [1.75, 1.75] lift 1.15 | — |
| 11 | `sunweaver-yard` / `gravemark-yard` | Yard | both | building | Kind.Barracks=12 · civ 0/1 | `drawBuildingSprite(Kind.Barracks, civ)` → `drawBarracksPix(civ)` | 32×32 | 1 + mir | none | main canvas row 12 (y448–512), cols 0–2 | [1.85, 1.85] lift 1.15 | — |
| 12 | `*`-corpse / dissolve states | (death FX) | both | derived | all kinds 0–6 · all civs | `drawUnitSprite(kind, civ, 4)` → `drawCorpsePix`; `5/6` → +`applyDissolve`; shader-side hash dissolve reinforces | 32×32 | 1 | 4=corpse stain, 5/6=dissolve phases (also shader hash discards at frame 5/6) | legacy slots per kind; scout corpse on scoutCanvas; combat rows never used for corpses | corpse [0.82, 0.88] lift 0.55 | Derived, not authored — listed for completeness |
| 13 | `voidmarked-*` (worker/Nihiline, scout, fighter, siege, ravager, prism, shade, all 4 buildings) | — (hidden) | Nihiline (HIDDEN) | all | civ 2 `voidmarked` · kinds 0–6, 10–13 | `drawWorkerAuth(2,…)`, `drawScoutPix(2)`, `drawFighterPix(2,…)`, `drawSiegePix(2)`, `drawRavagerPix(2,…)`, `drawPrismPix(2,…)`, `drawShadePix(2)`, `drawBuildingSprite(k, 'voidmarked')` | 32×32 / 32×48 | 5+3 mir (worker), 1+mir (rest) | same as public | **Present in every atlas** (main rows, scout cols 14–20, worker8 y672–720) | n/a | Fully rasterized but the faction must never surface in new tool UI |
| 14 | `*`-breakers / `siege-breaker` | Breaker | — (deferred) | unit | Kind.Siege=3 · civ 0/1 | `drawSiegePix(civ)` (not exported); corpse via `drawUnitSprite(3,…)` | 32×32 | 1 + mir | static live frames; 4–6 corpse | legacy slots row 3–4 (slot 63+) | [0.96, 1.12] lift 0.58 | **No combat strip row**; no canonical stable ID; path-gated (M4) |
| 15 | `*`-shade / `shade-spore-rider` | Spore Rider | — (deferred) | unit | Kind.Shade=6 · civ 0/1 | `drawShadePix(civ)` (not exported) | 32×32 | 1 + mir | static; 4–6 corpse | legacy slots row 6–7 (slot 126+) | [0.96, 1.12] lift 0.58 | **No combat strip row**; label exists but faction identity (voidmarked-flavored) is deferred |
| 16 | `*`-uniqueb / `uniqueb-sunwell` etc. | Sunwell / Cryo Bastion / Bloom Nest | — (deferred) | building | Kind.UniqueB=13 · civ 0/1/2 | `drawBuildingSprite(Kind.UniqueB, civ)` → `drawUniquePix(civ)` | 32×32 | 1 + mir | none | main canvas row 13 (y512–576), cols 0–2 | [1.85, 1.85] lift 1.15 | No canonical stable ID; M4-gated |
| 17 | props: `gem-ore/gas/sol`, `prop-wreck/vent` | (resources) | neutral | decor | Tile.Resource=20 (not a Kind) | `buildAtlas()` → `drawGem/drawPropWreck/drawPropVent` (private) | 24×24 / 22×20 / 18×20 in 32px cells | 1 | none | atlas.ts sheet 128×128, row 0 cols 0–4 | gem [≈1.45,1.45] (midGem 1.55), wreck 1.2, vent 1.2; lift 0.38 | **prop-vent blits at col 4 → x=128, fully outside the 128px sheet** (latent bug; UVs would be garbage — propUvFor('prop-vent') samples it) |

Kind/civ legend: `civIndex`: vespari=0, aurion=1, voidmarked=2. `Kind` enum: Worker0 Scout1 Fighter2 Siege3 Ravager4 Prism5 Shade6 · Hall10 House11 Barracks12 UniqueB13 · Resource20.

---

## 2. SpriteAtlas canvas layout (`buildSpriteAtlas()`)

All numbers derived from `sprites.ts` constants + layout code (verified against shader UV math).

**Main canvas** (`canvas`): **512 × 912** (16 cols × 32px cells; height stacked as below). Blit origin rule: 32px cells fill exactly (dx=col·32, dy=row·32); 64px Hall row uses 64px columns at x = civ·64.

| Block | Y range | Rows | Layout | Contents |
|---|---|---|---|---|
| Legacy units | 0 – 320 | 10 rows × 32px (rows 0–9) | slot = `kind·21 + civ·7 + frame`, col = slot%16, row = ⌊slot/16⌋; 147 of 160 cells used | 7 kinds × 3 civs × 7 frames; row 0–1: Worker; 1–2: Scout; 2–3: Fighter; 3–4: Siege; 4–5: Ravager; 5–6: Prism; 6–7: Shade (row 7 cols 5–15 + rows 8–9 empty) |
| Buildings | 320 – 576 | 4 rows × 64px stride (rows 10–13) | row k at y = 320 + (k−10)·64; Hall 64px cells at x=civ·64; others 32px centered | 320: Hall(64px); 384: House; 448: Barracks; 512: UniqueB — civs at cols 0–2 |
| Worker 8-dir | 576 – 720 | 3 rows × 48px | row = civ, col = dir + walk·8 | 576: vespari, 624: aurion, 672: voidmarked; walk 0 = cols 0–7, walk 1 = cols 8–15 |
| Worker action rows | 720 – 912 | 4 rows × 48px | col = dir (cols 0–7; 8–15 empty) | 720: build(7), 768: food(8), 816: crystal(9), 864: attack(10) — **Helion/Sunweaver only** |

**scoutCanvas**: **2688 × 128** — 21 cols × 128px (SCOUT_COLS = CIVS·UNIT_FRAMES). col = civ·7 + frame. vespari frames 0–3 = true 128px HD (`drawHelionScoutHdPix`); everything else (gravemark, voidmarked, corpse/dissolve frames) = 32px art upscaled ×4 nearest-neighbor (`imageSmoothingEnabled=false`).

**combatCanvas**: **1024 × 256** — 16 cols × 4 rows of 64px cells. row 0 Lumen Guard, row 1 Solar Strider, row 2 Rift Guard, row 3 Burden Walker; within a row: pose 0 = cols 0–7 (dir 0–7), pose 1 = cols 8–15. All cells rimmed by `applyCombatExteriorRim` (rows 0–1: SUN_AMBER/SUN_CREAM; rows 2–3: GRAVE_ICE/GRAVE_CRYSTAL).

**Legacy prop atlas** (`atlas.ts` `buildAtlas()`): 128×128, 32px cells, row 0: gem-ore(24×24), gem-gas(24×24), gem-sol(24×24), prop-wreck(22×20), prop-vent(18×20 → **off-sheet, see §5**).

---

## 3. Public vs private / deferred roster

**PUBLIC (must be re-derivable by tools):**
1. Worker (both factions) — #1/#2
2. Scout = Wind Strider / Grav-Skimmer — #3/#4
3. Fighter = Lumen Guard / Rift Guard — #5/#7 (combat strip rows 0/2)
4. Ravager = Solar Strider (Sunweaver unique) — #6 (combat row 1)
5. Prism = Burden Walker (Gravemark unique) — #8 (combat row 3)
6. Hall = Core — #9 · House = Habitat — #10 · Barracks = Yard — #11

**PRIVATE / DEFERRED (each with reason):**
- **Siege "Breaker" (#14)** — no canonical stable ID in CANONICAL_VOCABULARY.md; no VS4 combat row; M4 path-gated (`isPathGated(Siege)`); legacy 32px only.
- **Shade "Spore Rider" (#15)** — faction identity is voidmarked-flavored; no combat row; label in `labelOf` but deferred.
- **UniqueB (#16)** — no canonical ID; M4-gated; unique building art exists for all 3 civs but is not in the public roster.
- **voidmarked / Nihiline everything (#13)** — faction is HIDDEN by canonical vocabulary ("not shown", "hidden and deferred, **not deleted**"); art is fully authored and shipped in atlases but must never surface in new tool UI.
- **Corpse/dissolve variants (#12)** — derived death states (circle blob + hash dissolve), not authored production assets.

---

## 4. Adapter surface — exact functions a tool can call today

**Exported (importable from `src/sprites.ts` / `src/sprite-sdf.ts` / `src/atlas.ts`):**

| Function | Signature | Produces |
|---|---|---|
| `drawWorker8Dir` | `(civ: number, dir: number, walk: number) => Pix` | 32×48 living worker, any civ; dirs 3/4/5 auto-mirrored |
| `drawCombatSprite` | `(row: number, dir: number, pose: number) => Pix` | 64×64 rimmed combat cell; rows 0–3; pose clamped 0–1; dirs 3/4/5 mirrored |
| `applyCombatExteriorRim` | `(source: Pix, colorA: Rgba, colorB: Rgba) => Pix` | 2px exterior keyline (pure) |
| `drawUnitSprite` | `(kind: Kind, civ: Civ, frame: number) => Pix` | legacy 32px cells incl. corpse(4)/dissolve(5–6); clamp-free |
| `drawBuildingSprite` | `(kind: Kind, civ: Civ) => Pix` | Hall 64×64, House/Barracks/UniqueB 32×32 |
| `buildSpriteAtlas` | `() => SpriteAtlas` | all 3 canvases (needs DOM — see §5) |
| `atlasSlot` | `(kind: number, civ: number, frame: number) => number` | legacy slot index (frame clamped 0–6) |
| constants | `MAG`, `COMBAT_CELL/COLS/ROWS/LIVE_POSES/AUTHORED_DIRS`, `WORKER8_W/H`, `WORKER_ACTION_*`, `UNIT_FRAMES/KINDS`, `CIVS` | layout math |
| `spriteSize` (sprite-sdf) | `(kind: Kind) => number` | 64/128/32 source-px height |
| `COMBAT_BRANCH_MAPPINGS` (sprite-sdf) | 4 entries | kind+civ → combat row |
| `buildAtlas` (atlas.ts) | `() => Atlas` | prop sheet + UVs (needs DOM) |

**NOT exported — a tool cannot re-derive these as pure pixels today (must read atlas canvas or do module surgery):**
- `drawHelionScoutHdPix()` — the 128px Wind Strider (public asset #3's live frames!)
- `drawHelionAction8Dir(dir, action)` — the 4 Sunweaver worker action poses (public asset #1's build/gather/attack frames!)
- `drawHelionScoutPix`, `drawFighterPix`, `drawScoutPix`, `drawWorkerPix`, `drawSiegePix`, `drawRavagerPix`, `drawPrismPix`, `drawShadePix`, `drawCorpsePix`, `drawHallPix`, `drawHousePix`, `drawBarracksPix`, `drawUniquePix`, `drawHelionVariant`, `drawWorkerAuth`, `drawHelionBuildVariant`, `drawLumenGuardCombat`, `drawSolarStriderCombat`, `drawRiftGuardCombat`, `drawBurdenWalkerCombat`, `authoredCombatSprite`

→ **Adapter gap**: the pure-function surface covers combat cells + legacy slots + 8-dir worker, but the two flagship public assets (HD scout, worker actions) are only reachable through `buildSpriteAtlas()`'s canvases. Recommend exporting those two functions (they are already pure).

---

## 5. Hidden coupling / risk notes

1. **DOM dependency**: `buildSpriteAtlas()`/`buildAtlas()` use `document.createElement('canvas')` + 2d contexts (≈260 throwaway canvases per build). The pure draw functions are DOM-free (the vs4 test hashes them in Node). Any Node-side tool must either polyfill canvas or stick to the pure surface — which is exactly the surface with the two export gaps above.
2. **Shader branch ≠ export surface**: the SDF shader (sprite-sdf.ts) decides rows/cols by kind+civ+frame with no data table: combat (Fighter/Ravager×vespari, Fighter/Prism×aurion, frame<4), scout, worker8 (frame<3.5), worker8Action (frame 7–10), building (kind≥9.5), else legacy `kind·21+civ·7+frame`. `dirArr = e.facing` (0–7, dir8: 0=E…7=SE).
3. **Worker action rows are Helion-only but the shader branch is NOT civ-gated**: any kind-0 ent with frame 7–10 samples Sunweaver builder art. Today `frameFor` gates action frames to `civ==='vespari'` (aurion/voidmarked workers silently idle-build), so it holds — but a tool/renderer passing frame 7–10 for another civ gets a Sunweaver sprite.
4. **Frame-index semantics differ per strip** — legacy slots: 0–3 live (kind-specific: fighter 3=attack flash, ravager odd=lunge, prism odd=hover, worker 1+=drill [voidmarked only], scout/siege/shade static), 4=corpse, 5–6=dissolve; worker8 strip: walk bit (0/1), shader maps frames 1–3 all to walk pose col; combat strip: pose bit, shader maps frames 1–3 to pose-1 col; action rows: 4×8 single pose. Runtime `frameFor` (render.ts:1949) is the only place these are reconciled.
5. **Determinism is partially frozen**: `tests/vs4-combat-assets.test.ts` SHA-256-frozens 48 live cells (`row:dir:pose`) for combat rows 0, 1, 3 (all 8 dirs × 2 poses; `1:6:*`≡`1:2:*` and `3:6:*`≡`3:2:*` prove walker N/S faces are pixel-identical). **Row 2 (Rift Guard) is deliberately NOT frozen** (VS4A replacement; anatomy-contract only). Nothing else is hash-frozen.
6. **MAG replacement is color-threshold, not exact-match**: shader replaces any `r>0.85 && b>0.85 && g<0.22` with team color — near-magenta palette tokens would silently tint. Combat cells hold 0.5–5% MAG (test-enforced).
7. **Hidden-faction art ships in every atlas**: voidmarked workers/scouts/buildings occupy live cells (main y672–720, scout cols 14–20, building cols 2). New tools consuming atlas canvases must not surface them.
8. **Scout corpse/dissolve is 32px art ×4 nearest-neighbor** on the 128px canvas — chunkier than live frames; scout canvas mixes 2 resolutions.
9. **Player-Sunweaver Worker & Scout are procedural-mesh by default** (`?mesh=0` opt-out); the sprite assets for them are the AI/enemy/fallback path. Atlas parity with the mesh look is not guaranteed by any test.
10. **Label drift**: canonical vocab labels the objective structure "Core"; `content.ts` `hallName()` → "Nexus" and HUD shows it. `labelOf` also returns "Breaker"/"Spore Rider" (deferred) — adapter layer must translate.
11. **prop-vent blit lands off-sheet** (x=128 in a 128px sheet) — UV garbage; `propUvFor` references it, so vents may render wrong; unrelated to the main unit atlas but same asset family.
12. **Combat cells are 64px but world-scale per unit is a hardcoded table** (`combatWorldScale`, render.ts:1355) — 4 entries, default [1,1]; adding a 5th combat row (e.g. Siege) requires shader + mapping + scale-table edits in 3 files.
