# FORGE ART LAB v1 — FROZEN CONTRACT

Status: **FROZEN SPEC** (FAL-1). Owner: lead. Every builder implements exactly this. If code
and this doc disagree, this doc wins until the lead amends it.

Branch: `hermes/forge-art-lab` (base `ced0b94`). Worktree:
`/home/bobbyranka/workspace/spacepixelrts-forge-art-lab`. Never touches
`spacepixelrts-forge-trace` / `hermes/forge-trace`. Never merges to `chatgptpro2008`.
Never deploys. Evidence always goes OUTSIDE the repo.

---

## 1. Purpose

A local, developer-only asset development, inspection, comparison, validation, and
acceptance workbench for Starhaven units and buildings.

The loop it must serve:

choose asset -> inspect accepted baseline -> edit procedural source in the repo -> save ->
Vite HMR or controlled reload updates the candidate -> inspect every required
facing/state -> test through the REAL game renderer -> compare accepted vs candidate ->
run objective gates -> generate a proof pack -> accept or reject.

## 2. Non-goals (hard)

No pixel painting, brushes, layers, image import, or AI generation. No second game
renderer. No asset database or persistence beyond files in `tools/forge-art/baselines/`.
No GLB adapter implementation (interface reserved only). No Forge Trace / Review Deck
dependency. No production-bundle content (code, baselines, metrics, endpoints).
No redesign of any accepted asset. No edits to `src/sim.ts` / `src/engine.ts`.

## 3. Architecture

Separate Vite config `vite.forge-art.config.ts` (repo-root base so `src/*` imports work):

- entries: `tools/forge-art/index.html` (workbench) and `tools/forge-art/rig.html`
  (real-renderer context rig);
- dev: `npm run forge:art` serves it (default port 5179, strictPort, 127.0.0.1);
- build: `npm run forge:art:build` -> `dist-forge-art/` (never inside `dist/`);
- the production `npm run build` and `dist/` stay byte-for-byte unaffected.

One live WebGL context per page: the rig hosts the real `GameRenderer`
(`new GameRenderer(host)` -> `init(world)` -> `resize` -> `setZoom/lookAt` -> `draw`).
All enlarged pixels, masks, sheets, A/B panes are Canvas 2D drawn from `Pix` bytes or
frozen composited screenshots. No `three` construction in tool code — importing
`GameRenderer` + `ISO_YAW/PITCH/DIST` is the only sanctioned renderer usage.

### Renderer rig facts (from audit A4, binding)

- URL flags `?mesh=0&combat=1` are readonly at construction — rig URLs always set them.
  `mesh=0` (sprite path) is the deterministic default for gates.
- Fixture recipe (verbatim from `stageFixture`): kill all ents (`alive=false`,
  `vis=false`, `vx=vz=0`, `path=null`, `tid=-1`), `world.tick >= 600`, `world.winner=-1`,
  spawn via `world.spawn(kind, civ, team, x, z)` then overwrite
  x/px/z/pz/tx/tz/vx/vz/facing/order/tid/path/pathI/anim/hp=maxHp/dissolveT/corpseT/
  combatT/hitFlash, set `vis=true`; freeze with `world.step = () => {}`.
  Buildings pin `facing=1` and explicit `progress` + `hp = maxHp*progress`.
- Fog staging: `world.fogOfWarEnabled=false` (clear) OR fill `visible[0]/explored[0]`
  rings + per-ent `vis` (fog edge). No other fog mechanism exists.
- Deterministic skies: override `Math.random = mulberry32(0xC0FFEE)` before `init(world)`
  (import `mulberry32` from `src/engine`). Never re-`init()` on a live page; use
  `resetWorld(world)` between fixture families when needed.
- Camera presets: close `halfH=5`, normal `halfH=14`, strategic `halfH=32`
  (`lookAt(x,z)` + `setZoom(halfH)`).
- Teardown: `cancelAnimationFrame`, `view.renderer.dispose()` +
  `view.renderer.forceContextLoss()` + remove `#game`/`#overlay`, then Playwright
  closes the page. GameRenderer has no dispose(); this is the sanctioned teardown.

## 4. Asset registry (`tools/forge-art/src/registry.ts`)

One typed registry. Public catalog — exactly these 11 assets:

| assetId | label | faction | category | legacy kind/civ | source adapter |
|---|---|---|---|---|---|
| sunweaver-worker | Worker | sunweaver | unit | 0/vespari | worker8dir |
| gravemark-worker | Worker | gravemark | unit | 0/aurion | worker8dir |
| sunweaver-wind-strider | Wind Strider | sunweaver | unit | 1/vespari | scout |
| gravemark-grav-skimmer | Grav-Skimmer | gravemark | unit | 1/aurion | scout |
| sunweaver-lumen-guard | Lumen Guard | sunweaver | unit | 2/vespari | combat row 0 |
| sunweaver-solar-strider | Solar Strider | sunweaver | unit | 4/vespari | combat row 1 |
| gravemark-rift-guard | Rift Guard | gravemark | unit | 2/aurion | combat row 2 |
| gravemark-burden-walker | Burden Walker | gravemark | unit | 5/aurion | combat row 3 |
| sunweaver-core / gravemark-core | Core | each | building | 10/civ | building |
| sunweaver-habitat / gravemark-habitat | Habitat | each | building | 11/civ | building |
| sunweaver-yard / gravemark-yard | Yard | each | building | 12/civ | building |

(That is 8 units + 6 building rows = 14 registry entries; "Core/Habitat/Yard" exist once
per faction.) Legacy ids (`vespari`, `aurion`, `voidmarked`, Kind numbers) appear ONLY
inside adapter internals, never in rendered text, DOM ids, probe JSON, manifests' public
fields, or URLs. Hidden faction and deferred kinds (Siege/Shade/UniqueB/voidmarked)
never appear in the normal catalog. A clearly-marked internal diagnostic mode
(`?diagnostic=1`, excluded from default QA) may list dormant atlas cells for integrity
checks only.

`AssetDefinition` fields: `assetId, label, faction ('sunweaver'|'gravemark'), category
('unit'|'building'), role, adapterId, dims {w,h}, requiredFacings, authoredFacings,
mirrorPairs ([[1,3],[0,4],[7,5]] where applicable), frames: FrameKey[], anchor {x,y},
worldScale {x,y}, paletteFamily, teamColorRule, emissiveRule, runtimeMapping (atlas
region string), contextFixtures, thresholdsKey, baselineRevision`.

Frame keys: combat units `dir0..dir7 x pose0,pose1` (`dir{d}-pose{p}`);
worker `dir{d}-walk{w}`; scout `hd` (128px HD cell) ; buildings `iso`.
World scales (frozen, from render.ts): lumen [1.59,1.89], solar [2.05,1.54],
rift [1.67,1.92], burden [2.05,1.81], worker [1.55,2.32], scout [0.96,1.12],
core [2.4,2.4], habitat [1.75,1.75], yard [1.85,1.85].

### Source adapters (`tools/forge-art/src/adapters.ts`)

`type FrameSource = { key: string; pix: Pix; error?: string }` — a partial candidate is
captured per-frame, never crashes the tool.

- `combatRow(row)` -> 16 cells via exported `drawCombatSprite(row, dir, pose)`.
- `worker8(civIndex)` -> 16 cells via exported `drawWorker8Dir(civ, dir, walk)`;
  action rows via newly exported `drawWorkerAction8Dir(dir, action)` (see §15).
- `scoutHd(civIndex)` -> 1 cell via newly exported `drawScoutHdPix()` (sunweaver) or
  `drawUnitSprite(Kind.Scout, civ, 0)` 32px upscaled note (gravemark renders through the
  128 strip as x4 nearest upscale; adapter returns the true strip cell via
  `drawSpriteAtlasCell('scout', col)` — implemented by calling the newly exported
  pure painter `drawScoutStripCell(col)`; see §15).
- `building(kind)` -> 1 cell via `drawBuildingSprite(kind, civ)`.
- Reserved (validate-only, throw 'not implemented'): `raster-atlas`, `glb-bake`.

Adapter surface rule: adapters call ONLY exported pure painters. The two export-only
edits to `src/sprites.ts` are the sole production-file touch (§15).

## 5. Accepted baselines

Location `tools/forge-art/baselines/<assetId>/{baseline.png,manifest.json}` +
`baselines/registry.json`. One PNG per asset: grid `cols x rows` of cells in
frame-key order (dir-major). Combat assets 512x128 (8x2 of 64px). Worker 256x96
(8x2 of 32x48). Scout 128x128 (1 cell). Buildings 64x64 (1 cell).

`manifest.json`: `{schemaVersion:1, assetId, label, faction, category, revision,
createdAt, source:{adapter,dims}, cellLayout{cellW,cellH,cols,rows,order},
anchor, worldScale, frames:[{key,sha256,alphaPixels}], paletteStats, thresholdsUsed,
gates}`. Hashes are sha256 over the exact RGBA cell bytes (row-strided region copy),
byte-equivalent to the VS-4 `Pix.d` hash. pngjs writes deterministic PNGs (verified).

`registry.json` mirrors every asset: revision, acceptedAt, manifestSha256,
baselinePngSha256, frameSha256 map. `--apply` swaps EXACTLY one asset dir (temp+rename)
+ one registry entry; re-verifies disk hashes; aborts/rolls back on mismatch.

The browser never writes baselines. No dev-server endpoint mutates `tools/`.
HMR never regenerates accepted baselines.

Malformed behavior: missing dir -> status MISSING BASELINE, compare blocked;
corrupt/undecodable -> INVALID BASELINE; partial candidate -> per-frame error capture,
status PARTIAL; nothing auto-heals.

## 6. Workbench UX (`tools/forge-art/index.html`, `src/store.ts`, `src/workbench.ts`)

Layout: top bar (breadcrumb + status chip + stale badge) | left catalog rail
(faction-grouped) | center comparison stage | right inspector/metrics | bottom context
strip + event log. Dark theme tokens from the harness (`#0B0A12/#F0E7D2/#9CA6A5/
#D09A4E/#B84B45`), monospace readouts, `tabular-nums`.

Single store `ForgeLabState` (one `update(partial)` mutator; every view derives):
`{assetId, facing 0..7, pose/frame, playing, speed, cameraHalfH, background,
fogMode, teamColorMode, selectedState, abMode 'split'|'side-by-side'|'diff',
wipePosition 0-100, zoom '1x'|'4x'|'8x', passes {silhouette,value,alpha,team,emissive,diff}}`.
URL hash serialization (`#fal=a=<id>&d=<0-7>&p=<pose>&f=<frame>&...`); hash wins on reload;
sessionStorage holds non-hash extras. Deep-link copy button.

Stage canvases: `[data-fal-canvas="baseline"]` and `[data-fal-canvas="candidate"]`
are 2D canvases painted from baseline PNG bytes vs current candidate `Pix` bytes.
Split-wipe = CSS `clip-path: inset(...)` on the top canvas — zero redraw while dragging;
wipe handle is a range input. Diff pass = third canvas `[data-fal-canvas="diff"]`
(red = differing pixels, alpha-bound box overlay). Zoom = CSS transform only.

Passes (2D pixel transforms over both sides identically): silhouette (alpha mask),
value (grayscale luminance ramp), alpha, team (MAG-highlight), emissive (MAG-only),
difference (accepted vs candidate). Same facing/pose/frame/camera drive both sides —
synchronization is structural (one store), not best-effort.

Status chips — exact strings, one per asset slot, DOM siblings never baked into canvas
pixels: `ACCEPTED BASELINE`, `CURRENT CANDIDATE`, `PREVIEW OVERRIDE`, `OBJECTIVE FAIL`,
`CONTEXT FAIL`, `READY FOR REVIEW`, `ACCEPTED`. Preview overrides (any non-source knob)
mark evidence `source:false`. Stale badge `data-fal-stale="true"` when last proof
fingerprint != current source fingerprint. The workbench NEVER displays a critic verdict;
critic artifacts live only in proof packs.

DOM hooks (frozen, QA asserts verbatim): `data-fal-catalog`, `data-fal-catalog-group`,
`data-fal-asset`, `data-fal-status`, `data-fal-canvas`, `data-fal-facing` (value 0..7),
`data-fal-pose`, `data-fal-frame`, `data-fal-play`, `data-fal-pause`, `data-fal-speed`,
`data-fal-pass`, `data-fal-abmode`, `data-fal-wipe`, `data-fal-zoom`,
`data-fal-context` (opens/embeds the rig scene for the current asset),
`data-fal-roster`, `data-fal-metrics`, `data-fal-failures`, `data-fal-copy-json`,
`data-fal-proof`, `data-fal-stale`, `data-fal-hash`, body[data-fal-ready].
Keyboard: `/` search, `[`/`]` asset, Space play/pause, arrows frame-step, `1..6` passes,
`A/D` wipe, Tab abMode, `Z` zoom, `D` facing cycle via `Shift+ArrowLeft/Right`,
`?` help. All controls real buttons/inputs with aria-labels; chip is
`role=status aria-live=polite`.

Probe (frozen): `window.__FORGE_ART_QA__ = Object.freeze({version, ready, state:
<store snapshot>, selection, ab:{baselineSha256,candidateSha256}, gl:{contexts},
catalog:{entries:[{id,label,faction,category}]}, errors})` plus
`window.__FORGE_ART_TOOL__ = {world?, view?, selectAsset(id), setFacing(n), setFrame(n),
play(), pause(), togglePass(name), setAbMode(m), stageScene(name)}`.

## 7. Unit mode

Per unit: synchronized accepted/candidate inspection of all 8 facings x live frames;
idle/move (walk) and attack/damage/death presentation WHERE REPRESENTED in production
(combat strips: pose0 idle, pose1 walk+attack; legacy slots own corpse/dissolve — shown
in a clearly separated "legacy slot frames" section); silhouette/alpha/outline/value/
team/emissive/difference passes; 1x/4x/8x nearest-neighbor views; normal gameplay scale
(computed orthographic projection at halfH 14), close (5), far (32); selected/fog-edge
states via the rig; mixed-roster and battle-clump contexts via the rig.
Playback: play/pause + speed 0.25-4 stepping pose/frame keys.

## 8. Building mode

Per building: accepted/candidate source pixels, alpha, silhouette, value, team-color
region (MAG cluster highlight), close/normal/strategic rig views, player + rival faction
variants, footprint overlay (STATS radius ellipse + iso diamond from `isoVerts` params),
ground-contact marker (footS row), selected state (ring overlay), construction states —
REAL production truth only: complete / constructing (progress 0.08..1: same sprite +
partial HP bar + staged workers) / damaged (partial HP bar + optional hitFlash frame) /
destroyed (empty footprint ring). Any synthetic progress-scaled art is labeled
SYNTHETIC PREVIEW and excluded from gates. Worker + combat-unit scale references staged
beside the building; nearby-density scene (clustered buildings). Geometry-backed passes
(clay/wireframe/etc.) are NOT part of v1 (buildings are 2D pix).

## 9. Real-renderer context rig (`tools/forge-art/rig.html`, `src/context-rig.ts`, `src/fixtures.ts`)

Fixed deterministic scenes (seed 0x5eed, frozen tick 600, mesh=0&combat=1):

quiet-helios, unit-selected, roster-sunweaver, roster-gravemark,
confrontation (stageFixture lineup verbatim), battle-clump (clash verbatim),
base-player, base-rival, construction, fog-edge, cam-close(5), cam-normal(14),
cam-strategic(32).

The rig exposes `stageScene(name)`; the workbench embeds rig captures as frozen images
(screenshot or same-task 2D blit after `draw()`), keeping exactly one live WebGL context
on whichever page hosts it. Normal-scale authority: a passing contact sheet cannot
approve an asset whose normal-camera context fails; the final visual gate is the
unlabeled normal-scale lineup/battle frame (units) and unlabeled normal base scene with
Worker + combat reference (buildings).

## 10. Metrics library (`tools/forge-art/src/metrics.ts`)

Pure, DOM-free, import-safe from tsx tests. Adopts A2 signatures verbatim (RgbaImage
abstraction over Pix/pngjs): sha256Bytes/imageSha256/regionSha256; alphaAt/alphaCount/
alphaCoverage/sourceBounds/alphaInRows/groundContactRow/bottomGapRows; rec709Luma/
averageLuma/brightMaterialShare/maxLuma/litRatio; maskBox/boxWidth/boxHeight/
boxCoordinates/maskComponents/hasCorePath/primaryComponentShare/longestColorRun;
polearmSpan; rgbaEqual/differingPixels/unionAlpha/silhouetteIou/meanRgbaDelta/
poseDeltaPercent; flipX/isMirrorPair (never mutate); facingBoundsSwim/facingCentroidSwim;
colorShare/magShare/teamColorShare; exteriorTransparency/rimLayerShares/coreMask/
coreMinY/coreAlphaInRows/bodyTop. Conventions locked: alpha>0; 8-neighbor components /
4-neighbor BFS; meanRgbaDelta divides by d.length; full-RGBA hashing; exact-RGB
equality; mask ops take explicit stride; division guards return NaN.

Thresholds live in ONE shared table `tools/forge-art/src/thresholds.ts` keyed by asset
class, each flagged `proven` (VS-4-derived: alpha 0.12-0.55 coverage, connected>=0.96,
poseDelta 4-45%, N-vs-E delta>18, guard/walker IoU<0.78, MAG share 0.005-0.05 source /
0 runtime, guard bounds>=24x44 + spear geometry, walker>=44x28, luma>=90,
bright>=0.30, rim shares>=0.85) or `advisory` (UNPROVEN: swim<=4px, occupancy bands,
building floors, per-facing variance bounds). Advisory failures render as WARN, never
hard-fail, until calibrated.

Calibration test proves library outputs equal the 48 frozen R3 digests + published
metric ranges WITHOUT editing `tests/vs4-combat-assets.test.ts` (which stays verbatim).

## 11. Candidate change report

Per asset compare produces `changes.json` (A6 §3 schema): changedCells (key,
acceptedSha, candidateSha, differingPixelCount, differing bbox, alpha added/removed),
unchangedCells, addedCells, removedCells, metricChanges (per-gate old/new/ok),
scaleOrAnchorChanged, atlasRegionAffected, `otherAssetsUnchanged` map. An isolated
asset change MUST show every other registered asset byte-identical (re-derive their
baseline hashes from stored PNGs + current-source candidate run) or the report refuses
(exit 6 semantics).

## 12. Commands (package.json additions; production scripts untouched)

    forge:art          vite --config vite.forge-art.config.ts --port 5179 --host 127.0.0.1 --strictPort
    forge:art:build    vite build --config vite.forge-art.config.ts   (outDir dist-forge-art, emptyOutDir)
    forge:art:typecheck tsc --noEmit -p tsconfig.forge-art.json
    forge:art:proof    node scripts/forge-art-proof.mjs   --asset=<id>|roster --out=<abs>
    forge:art:baseline node scripts/forge-art-baseline.mjs --asset=<id>|all --out=<abs>
    forge:art:accept   node scripts/forge-art-accept.mjs --asset=<id> --evidence=<abs-manifest> [--apply]
    test:forge-art     tsx tests/forge-art-registry.test.ts && tsx tests/forge-art-metrics.test.ts && tsx tests/forge-art-pipeline.test.ts
    qa:forge-art       node scripts/qa-forge-art.mjs

`--out` paths must be absolute AND outside the repository (resolveOut convention);
exception: `forge:art:accept --apply` writes only inside `tools/forge-art/baselines/`.

## 13. Proof packs (`scripts/forge-art-proof.mjs`)

Single asset `<out>/`: manifest.json (tool, startedAt/finishedAt, args, git revision+
branch+dirty state, viewport 1366x1024, seed, ok, errors[]), asset.json (registry def),
metrics.json (gate reports incl. advisory), changes.json, source-sheet.png,
accepted-sheet.png, candidate-sheet.png, difference-sheet.png, silhouette-sheet.png,
value-sheet.png, normal-context.png, close-context.png, far-context.png,
selected-context.png, battle-context.png (units) | base-context.png (buildings),
console.txt, critic-brief.txt (neutral review instructions + file list), and
production-isolation result (embedded check summary).

Roster `<out>/`: roster-unlabeled.png, roster-labeled.png, roster-silhouettes.png,
roster-values.png, buildings-normal.png, units-normal.png, catalog.json, metrics.json,
manifest.json (+browser +production-isolation reports).

Context captures are COMPOSITED Playwright `page.screenshot()` at exactly 1366x1024 —
never framebuffer readback. Boards may be composed via an in-browser HTML page
(setContent + fullPage screenshot); board text is never pixel-hashed.

World-scale rows project each cell at `px = round(worldScale * (1024/(2*halfH)))`
nearest-neighbor — an honest orthographic computation, labeled as such.

## 14. Acceptance (`scripts/forge-art-accept.mjs`)

Validation order (exit codes): usage 2; malformed evidence/registry/schema 1; missing
baseline 7; unknown asset 8; STALE evidence (sourceRevision != HEAD or dirty tree
beyond declared candidate files) 3; failed gate 4; recomputed candidate hash !=
evidence.candidateHashes 5; unrelated-asset drift 6; partial candidate 9; post-write
verification failure 10. Dry-run default prints planned replacements and exits 0
without writing. With `--apply`: atomic one-asset swap (§5), never commits, prints
old->new revision + changed-frame count. Evidence freshness additionally requires the
proof manifest's candidateHashes to match a fresh recompute at the CURRENT tree.

## 15. Production isolation & the two export-only edits

`src/sprites.ts` gains ONLY `export` on three existing pure painters (zero pixel
impact, verified by frozen-hash + qa-vs4 gates):
`drawHelionAction8Dir` (worker actions), `drawHelionScoutHdPix` renamed export alias
`drawScoutHdPix`, and a new tiny pure helper `drawScoutStripCell(col: number): Pix`
that composes existing private painters exactly as `buildSpriteAtlas()` blits them
(gravemark/upscale semantics included). No other production-source change. `src/sim.ts`
and `src/engine.ts`: untouched. `content.ts` label drift (`hallName()` -> "Nexus") is
NOT fixed here; the registry translates labels at the boundary.

Isolation invariants (tested by `scripts/forge-art-prod-isolation.mjs` + QA):
`dist/` contains no `forge`/`art-lab`/`baseline` strings or filenames; package.json
`build` script string unchanged; `src/main.ts` has zero `forge` references;
`dist-forge-art/` separate; production app never imports tool modules (tool imports
production modules one-way only).

Performance: no absolute frame-time claims from software GL. The rig logs
renderer string; SwiftShader hosts record sim-share policy only. Tool pages pause
rendering when idle (manual draw on state change).

## 16. Tests (RED-GREEN-REFACTOR; pure files run under tsx)

- `tests/forge-art-registry.test.ts`: canonical ids; banned terms absent from all
  public labels/ids; hidden faction absent; registry validation (unique ids, factions,
  dims>0, mirror pairs legal, frame-key grammar); all 14 entries present; adapter dims
  correct (64x64 combat, 32x48 worker, 128x128 scout hd, 64x64 core, 32x32 others);
  worldScale table matches render.ts values.
- `tests/forge-art-metrics.test.ts`: calibration vs 48 frozen R3 digests (rows 0,1,3)
  + row-2 published ranges; alpha bounds; connected components; facing variance;
  pose variance; mirror pairs deepEqual; anchor/groundContact stability; luminance;
  team/MAG shares; silhouette IoU pairs; stride correctness on 32x48; flipX purity;
  NaN guards.
- `tests/forge-art-pipeline.test.ts`: baseline generate determinism (two runs
  byte-identical, manifest stable modulo createdAt); accepted-hash stability across
  reload; unrelated-cell preservation under a scoped sandbox candidate; malformed
  baseline refusal; partial candidate PARTIAL status; dry-run acceptance writes
  nothing; acceptance refuses failed gates (4), stale evidence (3), hash mismatch (5),
  unrelated drift (6); exit codes exact; context fixture determinism (same seed ->
  identical staged ent arrays); one-live-GL rule expressed as a unit constraint on
  rig module API (no exported THREE constructors).

Browser QA (`scripts/qa-forge-art.mjs`, chromium-first fallback chain, unique
user-data-dir, ephemeral port, manifest-always-written, SIGTERM group kill + pgrep
verification) executes the 19-step flow from audit A7 §2 with these amendments:
facings 0..7; construction = real states (complete/constructing/damaged); step 15 =
run `forge:art:proof --asset=sunweaver-lumen-guard` as a subprocess and validate its
manifest + files; PLUS sandbox-candidate block: enable `?sandbox=1`, assert A/B
difference appears, difference metrics nonzero, objective gate flips to FAIL display,
unrelated assets remain byte-identical, and acceptance with the pre-sandbox evidence
refuses (exit 5).

## 17. Sandbox candidate

Query flag `?sandbox=1` wraps ONLY the lumen-guard candidate adapter with a
deterministic visible transform (recolor shield gold pixels -> teal, fixed token map).
It changes no production source, no other asset, no baseline. It exists to prove A/B,
difference metrics, failure display, stale-evidence refusal, and unrelated-cell
preservation end-to-end.

## 18. Completion criteria (all mandatory)

1. `npm run test:m0 / test:vs4 / test:vs5 / build / qa:vs4` pass UNCHANGED at final HEAD;
   VS-4 frozen cell hashes byte-identical; `src/sim.ts`/`src/engine.ts` diff-empty.
2. `npm run test:forge-art` green (pure suites above).
3. `npm run forge:art:build` produces `dist-forge-art/`; production `dist/` isolated.
4. `npm run qa:forge-art` green: zero console/page errors, exact captures, one live
   WebGL canvas, catalog complete, legacy/hidden vocabulary absent, process-leak check
   clean.
5. Proof packs generated for sunweaver-lumen-guard, sunweaver-core, and roster into
   `/home/bobbyranka/workspace/evidence/starhaven-forge-art-lab/<ts>/`, manifests
   matching files on disk.
6. Fresh independent vision critic reviews real captures (tool-usability verdict);
   material findings resolved.
7. First-principles deletion pass done; `PROGRESS.md` updated; branch pushed.
