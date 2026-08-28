# A8 — Scope & Deletion Audit: what NOT to build for Forge Art Lab v1

Agent: audit A8 · Date: 2026-08-26 · Scope: READ-ONLY except this file
Repo: `spacepixelrts-forge-art-lab` @ branch `hermes/forge-art-lab` (clean tree)
Sibling audits read: `A2-unit-contract.md` (metrics library → `tools/forge-art/src/metrics.ts`), `A4-renderer-integration.md` (real-`GameRenderer` rig recipe, verified seams).

## 0. Ground truth about the "existing" forge:review machinery

The brief's premise — `forge:review` + `forge:review:capture` scripts, `tools/forge-review/open-workbench.mjs`, `scripts/forge-capture.mjs`, `src/dev/review-control.ts` + `review-overlays.ts`, `docs/FORGE_REVIEW_DECK.md` — **exists nowhere in this worktree and nowhere in any branch** (checked `hermes/forge-trace`, `hermes/starhaven-aaa-front-end`, `hermes/starhaven-pixel-ui-shell`, `chatgptpro2008`, `backup/pre-approved-art-deploy`, `origin/main`; `git log --all` for those paths is empty). package.json has **zero** `forge` references; there is no `tools/`, no `src/dev/`, no `reviewHooks`/`setReviewMode`/`reviewMode` symbol anywhere in `src/` (A4 §3 verified the same by grep).

Consequence: the `forge:review*` names are **reserved but unclaimed** — treat them as a naming reservation from the brief (possible parallel work), not as code to reuse or collide with. Art Lab must (a) not squat those exact names, (b) not assume any probe/deck infrastructure exists to inherit. Everything below therefore proposes a distinct `forge:art*` family.

---

## 1. DELETION LIST — tempting features NOT needed for the first real asset iteration

| # | Feature to delete | Why deletable | What accepted behavior loses NOTHING |
|---|---|---|---|
| 1 | **Asset database / multi-user persistence** (explicit hard limit) | No server, no DB in the repo; all evidence today is git + frozen sha256 digests (`FROZEN_R3_CELL_SHA256`, qa-vs4:85-91/646) + `critic/out/` PNGs. A local engineering workbench needs zero persistence beyond the filesystem. | Provenance = git history + `manifest.json` per capture (self-view pattern). Cross-run integrity = frozen digests. Nothing is lost. |
| 2 | **Undo stacks** (asset edits, camera changes) | Every rig state is *code*: `stage(world, specs)` + `setZoom/lookAt` + one `draw()`. "Undo" is re-running the stage function; "undo" of an exported PNG is `git checkout`. An undo buffer would duplicate the fixture code. | No interactive editing exists in v1, so there is nothing to undo. Scrub = change args, re-draw, re-capture. |
| 3 | **Timeline scrubbing across all states simultaneously** | The rig is freeze-driven (A4 §2 option b: sim pinned via `world.step = () => {}`, `tick = 600`, one draw per capture). A real-time timeline across *all scenes at once* requires a running sim loop — a second runtime, not a viewer. | Deterministic per-scene captures are the accepted artifact; a live meta-timeline adds nothing to a gate that judges screenshots. |
| 4 | **GLB adapter implementation now** | Nothing in the repo imports/exports GLB; assets are PNG atlas cells + `instanceMatrix` column-norm scales (A2 §5.12). The only 3D geometry is internal procedural scout/worker meshes inside render.ts with no export path. | Zero current consumers. Revisit only if a real 3D asset class is accepted — not before. |
| 5 | **Fog remembered-state simulation** | Render has NO fog state machine — fog is two arrays + a flag (`world.fogOfWarEnabled`, `visible[0]/explored[0]`, A4 §3 verified). "Remembered vs visible" *is* `explored` vs `visible`; simulating it further means hand-filling those arrays, which the fixture already does. | Staging a fog-edge scene = set the arrays (A4 scene table). No sim work needed, no renderer changes. |
| 6 | **Geometry passes for buildings in v1** | Buildings are 2D pix (`buildings.png`, Hall/house rendered via atlas sprites, `progress` overlay). SDF/procedural geometry exists only for scout/workers and is locked behind `?mesh=0` for deterministic gates (A4 §6.2). | A geometry "pass" would judge a pipeline that doesn't exist for buildings. V1 building gates are pixel metrics on the PNG cells (A2), full stop. |
| 7 | **AI image generation** (explicit hard limit) | — | Authors author assets; the workbench validates them. |
| 8 | **Browser Photoshop / canvas painting tools** (explicit hard limit) | Any pixel editor, brush, layer, or in-browser retouch is the hard limit by name. | Authoring happens outside; the workbench *measures*. Metric feedback (A2 library) is the loop. |
| 9 | **reviewHooks / setReviewMode into src/render.ts** | The symbols don't exist; adding an omniscient-review toggle means modifying live game render code for tool convenience — the single clearest scope drift. Existing seams already cover every "review" need: `fogOfWarEnabled=false`, `visible[].fill(1)`, `e.vis=true`, URL flags `?mesh=0&combat=1`, `qaFrozen`, `__STARHAVEN_QA__` probe (main.ts:504-565). | A4's fog/vis scene table renders every requested state without touching render.ts. |
| 10 | **Procedural `?mesh=1` worker path in gates** | Wall-clock `frameDt` pose damp makes it non-deterministic (A4 §2). | Gates use `mesh=0` (sprite path, pixel-stable); `mesh=1` stays an art-review-only option. |
| 11 | **Per-frame perf sampling in the art rig** | FPS/p99 is `measure.mjs` / `__STARHAVEN_QA__.p99FrameMs` territory on the live game. Art iteration gates on *pixels* (coverage, luma, MAG, sha256), not frame deltas. | Nothing — the capture loop stays screenshot-deterministic. |
| 12 | **Long-running capture dashboard / watch server** | Every existing harness is one-shot: spawn vite → capture → kill (qa-vs4 `startServer`/`stopServer`). A persistent service is infrastructure with no acceptance criterion behind it. | One-shot scripts + composeBoard deck reproduce everything a dashboard would show. |

Net: the first real asset iteration needs **one rig page, one metrics library, one capture script, one deck composer**. Everything else above is a later-phase feature with no acceptance criterion.

---

## 2. DUPLICATION INVENTORY — helpers worth sharing vs duplicating deliberately

Proposed home for node-side shared code: **`scripts/forge-art-lib.mjs`** (mjs consumers); pure pixel math goes in **`tools/forge-art/src/metrics.ts`** (A2's designated library — TS, no fs/playwright imports).

| Helper | Lives where (best copy) | Also duplicated in | Used by | Verdict |
|---|---|---|---|---|
| **vite-spawn** (ephemeral port + spawn vite `--strictPort` + boot-poll + SIGTERM process-group kill) | `startServer` qa-vs4:110-145; `startDevServer` self-view:125-152 | every `qa-*.mjs` (16 scripts spawn vite; pattern origin qa-m0) | all QA harnesses | **SHARE** — triplicated already; identical semantics (findOpenPort → spawn detached → fetch-poll → kill -pid). |
| **chromium-launch** (fallback chain) | `launchBrowser` self-view:172-187 (chrome channel → `/usr/bin/chromium` → default) | measure.mjs (channel chrome + perf flags), screenshot.mjs (channel chrome), qa-vs4:950-954 (chrome → headless fallback) | all capture scripts | **SHARE** — self-view's 3-attempt chain is the most robust; keep perf flags as options. |
| **png-analyze** (pngjs read + per-pixel luma/MAG/coverage scans) | `analyzePng` qa-vs4:194; `analyzeCell` self-view:251; measure.mjs inline (full-frame color count) | settle-gate.mjs inline, crown/p-probes | all pixel gates | **SHARE** — pure analysis → `metrics.ts` (A2); the fs-read wrapper → `forge-art-lib.mjs`. |
| **out-validate** (absolute path, outside repo) | `resolveOut` qa-vs4:105-115; self-view:67-72 | 16 of 17 qa scripts (`grep -l isAbsolute`) | every harness that writes evidence | **SHARE** — tiny but invariant-grade; one copy kills a whole class of "wrote into the repo" bugs. |
| **data-url** (`dataUrlBuffer` decode / `data:` encode for boards) | `dataUrlBuffer` qa-vs4:190; inline `dataUrl` self-view:301 | composeBoard only | capture + deck scripts | **SHARE** — 1-liner, but board-compose depends on it; keeps lib self-contained. |
| **sha256** (cell/region digest) | `cellSha256` qa-vs4:565 (createHash over full `w*h*4` RGBA, row-stride aware) | frozen digest tables qa-vs4:85-91 | VS-4 gate, any future asset freeze | **SHARE** — must preserve exact copy semantics (A2 pitfall #4: hash ALL RGBA including alpha; never round before hashing). |
| **board-compose** (HTML grid → fullPage screenshot) | `composeBoard` self-view:299-357 | none (unique) | self-view deck | **DUPLICATE deliberately** — the *primitive* (dataUrl imgs + CSS grid + `page.setContent` + fullPage shot) is share-worthy, but the layout is starhaven-specific (palette swatches, route/orientation captions, fail borders). FAL deck will carry its own headers, metric captions, gate badges. Share the primitive; author the layout. |

Also worth lifting into the lib (trivial, already copy-pasted): `findOpenPort` (qa-vs4 + self-view + qa-m0 lineage), `settleFrames` (rAF×2), `assertThat`, `parseArgs`/`argVal`, `delay`. **Do not** extract `stageFixture` (qa-vs4:793-815) into the mjs lib — it belongs in the tool's TS fixture builder (A4 §3 already ports it verbatim as `stage()`); keep one canonical copy in TS.

---

## 3. COLLISION CHECK — proposed namespaces vs everything that exists

| Namespace | Proposed | Taken? | Verified against |
|---|---|---|---|
| npm scripts | `forge:art:review`, `forge:art:review:capture` (+ `forge:art:lib` if ever needed) | **FREE** — package.json has zero `forge` refs; full script list is `dev/build/preview/deploy/critic/screenshot/self-view/test:* /qa:*` | package.json (full read) |
| `forge:review` / `forge:review:capture` | **do NOT use** — reserved by brief's other-branch work (see §0); treat as squat-proof names | reserved-unclaimed | all branches |
| window probes | `__FORGE_ART_STATE__`, `__FORGE_ART_METRICS__` (frozen read-only objects, `__STARHAVEN_QA__` pattern main.ts:537-563) | **FREE** — existing probes: `__STARHAVEN_QA__`, `__SPACEPIXEL__`, `__STARHOLD__`, `__STARHOLD_INPUT__`, `__STARHOLD_VIEW__`, `__STARHOLD_WORLD__`, `__SUNWEAVER_STRUCTURAL__` | grep across scripts/src/tests |
| symbols in src/ | `reviewHooks`, `setReviewMode`, `reviewMode` | **FREE but forbidden** — confirmed absent; do not introduce (deletion #9) | A4 §3 grep + my grep |
| output dir | `dist-forge-art/` | **FREE** — `dist/` is the game build (gitignored, deployed by `wrangler pages deploy dist`); `dist-forge-art/` cannot collide and cannot be accidentally deployed | .gitignore, wrangler.jsonc, gen-desktop.mjs writes `dist/desktop.html` |
| ports | ephemeral `findOpenPort` (existing qa pattern); fixed fallback **5179-5184** | **FREE** — fixed ports in repo: 5173 (vite.config + dev), 5174 (7 crown/probe scripts), 4173 (preview), 1180 = viewport width not port. 5179+ clears the whole 517x/41xx cluster | grep across scripts/src/vite configs |
| file/dir names | `tools/forge-art/` (already the sibling audits' target), `scripts/forge-art-lib.mjs`, `renderer-rig.html`, `deck/` | **FREE** — no `tools/` dir exists at all; `scripts/forge-art*` matches nothing | `ls scripts/`, `git ls-tree` all branches |
| THREE imports in tool code | only `../../src/render` + type-only `import type * as THREE from 'three'` | n/a — see §6 | grep `from 'three'` (7 files, all game-side) |

`docs/FORGE_REVIEW_DECK.md` name: skip it; the deck artifact is generated output (HTML → PNG), not a doc — put it under `dist-forge-art/`.

---

## 4. ARCHITECTURE TRIPWIRES — signs we're drifting into a second renderer / asset DB / Photoshop

| Tripwire | Correct alternative |
|---|---|
| `import * as THREE from 'three'` + `new THREE.*` anywhere under `tools/forge-art/` (except reading `view.scene/camera/renderer` or type-only imports) | Import `{ GameRenderer, ISO_YAW, ISO_PITCH, ISO_DIST }` from `../../src/render`; the rig never constructs a scene, camera, renderer, light, or material. A4 §1 recipe is the only sanctioned construction site. |
| Any DB index, sqlite file, REST endpoint, or write-persistence layer in the tool | JSON manifests + sha256 digests + git + `dist-forge-art/` PNGs (deletion #1). |
| Canvas painting: brushes, layers, pixel editing, in-browser retouch, "fix it in the tool" buttons | External authoring + A2 metrics gates. The workbench measures and reports; it never edits pixels. |
| Any call to an image-generation API from the tool | Out of scope, full stop (hard limit). |
| A PR touching `src/render.ts`/`main.ts` to add review hooks, omniscient modes, or tool-specific probes | Use existing seams: `fogOfWarEnabled`, `visible/explored` arrays, `e.vis`, `?mesh=0&combat=1`, `qaFrozen`, `__STARHAVEN_QA__`. If a seam is missing, the fixture is wrong, not the game. |
| A second HTML entry that imports `main.ts` / boots app-flow (start screen → match) | Standalone rig page with `new World()` + fixture `stage()` + manual `draw()` (A4 §1-2). One live WebGL context per page, max. |
| The tool writing new atlas formats / sprite pipelines / shader variants | Validation only: measure against `buildAtlas`/`buildSprites` output as it exists. New asset formats are game work, not tool work. |
| Sim stepping for "live" preview (rAF loop + `world.step()`) | Frozen sim + one `draw()` per capture (A4 §2b). If frames must move, do a bounded scripted number of `step()`s then pin (battle-clump recipe, A4 §3). |
| Growing rig state that needs disposal machinery beyond A4 §5 (`renderer.dispose()` + `forceContextLoss()` + `page.close()`) | You've built a second renderer. Reuse `resetWorld(world)` between fixtures; never re-`init()` on the same page. |

---

## 5. MINIMAL PATH — the in-scope floor satisfying every named acceptance criterion

The brief's acceptance criteria are the four hard limits (no second game renderer, no asset database project, no browser Photoshop, no AI image generation) plus a working review loop on the real renderer. The floor:

- **`tools/forge-art/renderer-rig.html`** — one tool page hosting the REAL `GameRenderer` (`new GameRenderer(host)` → `init(world)` → `resize()` → `setZoom/lookAt` → `draw()`), deterministic `World` fixture (`world.reset(seed)`, `stage()` ported verbatim from stageFixture, `world.step=()=>{}`, `tick=600`, `?mesh=0&combat=1`), served with its own vite entry — **no new THREE classes, no main.ts import** (A4 §1-3, §6).
- **`tools/forge-art/src/metrics.ts`** — pure metrics library extracted from VS-4 without weakening `tests/vs4-combat-assets.test.ts` (A2: alpha/luma/MAG/sha256/anatomy + calibration test against frozen digests; `[UNPROVEN]` placeholders stay advisory).
- **`scripts/forge-art-lib.mjs`** — shared node helpers: vite-spawn, chromium fallback-launch, out-validate, data-url, sha256, png-read, board-compose primitive (§2).
- **`forge:art:review:capture`** → deterministic captures of the staged scenes (quiet terrain, roster, battle clump, bases, construction, fog edge, 3 cameras) into **`dist-forge-art/`**, ephemeral port (5179+ fallback), one WebGL context per page, teardown per A4 §5.
- **`forge:art:review`** → compose the **deck** (HTML board with per-scene metric captions + gate pass/fail, `composeBoard` pattern) and emit the single review PNG + manifest (probe state, metrics, sha256 per cell).
- **`__FORGE_ART_STATE__` / `__FORGE_ART_METRICS__`** frozen probes on the rig page (pattern: `__STARHAVEN_QA__`, main.ts:537-563).
- **Deletion list §1 honored**: no DB, no undo, no timeline, no GLB, no fog sim, no geometry passes, no painting, no AI gen, no render.ts changes.

Anything beyond this list is v1.5+ and needs a new acceptance criterion.

---

## 6. Second-renderer risk scan — GameRenderer covers every tool-side need

`src/render.ts` (2382 lines) exports exactly: `ISO_YAW`, `ISO_PITCH`, `ISO_DIST` (lines 22-24) and `class GameRenderer` (line 1363). GameRenderer's public surface (verified by read):

| Tool need | Covered by | Verdict |
|---|---|---|
| A live renderer to draw the scene | `view.renderer` (public readonly THREE.WebGLRenderer) | ✅ |
| Scene graph access (read-only) | `view.scene` (public readonly) | ✅ |
| Camera framing (zoom/pan) | `view.camera` (public readonly OrthographicCamera) + `setZoom(halfH)` + `lookAt(x,z)` | ✅ |
| Camera constants | exported `ISO_YAW/ISO_PITCH/ISO_DIST` (render.ts:22-24); presets from input.ts/qa-scenarios.ts (A4 §4) | ✅ |
| Deterministic draw without Input/Hud/Sfx | `draw(world, alpha, selected, box)` — A4 §1 confirmed fully self-contained (reads world state only; `world.onHit`/`onMuzzle` sfx hooks never called by draw) | ✅ |
| Asset info | `view.atlas`, `view.spriteAtlas`, `view.combatBranchMappings` (public); `view.info()` (drawn counts, consumed by `__STARHAVEN_QA__` publish, main.ts:506) | ✅ |
| World/sim fixtures | `World` from `src/sim` (reset/spawn/step) + `Kind/Ord/MAP/MAX_ENTS/mulberry32` from `src/engine` — sim exports, not render | ✅ |
| Fog/visibility staging | `world.fogOfWarEnabled` + `visible[0]/explored[0]` + `e.vis` — honored per-draw (A4 §3, render.ts:2061-2086); NO fog sim needed | ✅ |
| Scene reset between fixtures | `resetWorld(world)` (disposes terrain/fog/worker rigs; keeps atlas/vfx/star resources) | ✅ |
| Screenshot | `page.screenshot` (Playwright) — reads the composited canvas; not a second context | ✅ |
| Lights/materials/shaders/instanced meshes | ALL internal to render.ts init/draw — tool never touches | ✅ (must stay that way) |

**Conclusion: zero new THREE classes are required by the tool.** The rig imports `GameRenderer` + the three ISO constants (+ sim/engine exports); any `three` import in tool code must be type-only. The moment a tool file does `new THREE.Scene()` or `new THREE.WebGLRenderer()`, that file is a second renderer — see §4 tripwire #1.

---

### Pitfalls carried forward (from A2/A4, binding on the build)

- Hash full RGBA incl. alpha; never round before hashing (A2 #4). Row-stride in atlases ≠ cell size (A2 #1).
- `alpha > 0` convention is frozen; `minAlpha=1` default, never silently changed (A2 #2).
- `instanceMatrix` is column-major: `hypot(m[0..2])` = scaleX (A2 #12).
- Thresholds are area- or terrain-relative — recompute per asset class; never copy 491/2252/90 literals (A2 #14).
- URL flags `?mesh=0&combat=1` are locked at construction; serve the rig with its own query string (A4 #2).
- Override `Math.random = mulberry32(fixed)` before `init()` for stable skies (A4 #4); set `tick=600` to suppress opening effects (A4 #5).
