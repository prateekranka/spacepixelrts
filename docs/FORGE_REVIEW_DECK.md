# FORGE REVIEW DECK v1 (FRD)

Status: **ACTIVE SPEC** — developer-only review system. Implements FRD-1..FRD-3 commits.
Parent authority: `DIRECTIVE.md`, `docs/CANONICAL_VOCABULARY.md`, `docs/FIRST_PLAYABLE.md`.

## Purpose

One coherent interactive review system over the existing game and QA contracts:

- corrected capture backend (real seeds, split perf metrics, full metadata, both orientations);
- an interactive workbench (one live WebGL view, review controls, debug overlays);
- a proof-pack format a fresh blind critic can judge.

## Non-goals (locked out)

Forge Trace, Forge Art Lab, Forge Repro Recorder, Forge Gate, Forge Map Lab, MCP wrappers,
new gameplay/units/maps/economies/tech, general visual polish, production deployment.

## Hard constraints

1. Never import or modify `src/sim.ts` or `src/engine.ts`.
2. No production-bundle leakage: the workbench is NOT a Vite build input; production
   `index.html` never references it; runtime control installs only when
   `import.meta.env.DEV === true` AND query contains `forge=1`. In the production build the
   control is absent and behavior is byte-identical to today.
3. Perspectives and overlays are render/read side only. They MUST NOT mutate AI knowledge,
   discovery latches, targeting, resources, orders, or sim determinism.
4. QA still dispatches legal events only; state transitions stay inside AppFlow.
5. One live WebGL canvas at a time in any tool surface. All comparison panes show frozen PNGs.
6. Screenshots are Playwright composited captures. Never WebGL framebuffer readback.
7. Canonical IDs everywhere (`sunweaver`, `gravemark`, `helios-rift`; no banned terms).

## Architecture

```
tools/forge-review/
  index.html            workbench page (dev-only, served by Vite dev server)
  panel.ts              workbench UI: controls + identity banner + frozen panes
  style.css
  lib/
    server.mjs          vite lifecycle: start(url?), stop(), port pick, guaranteed reap
    browser.mjs         chromium launch fallback (chrome -> /usr/bin/chromium -> bundled)
    pixels.mjs          PNG analysis: luminance, nonblank, palette adherence vs src/palette.ts
    git-meta.mjs        commit, branch, dirty (sync, cached)
    manifest.mjs        schema constants + validate(manifest) pure fn + writer
    capture.mjs         serial route/extras capture driver + clip recorder
scripts/forge-capture.mjs   CLI backend (forge:review:capture)
scripts/qa-forge-review.mjs E2E acceptance (qa:forge-review)
tests/forge-review.test.ts  focused automated tests
src/dev/review-control.ts   typed QA control + install guard
src/dev/review-overlays.ts  overlay drawing on the existing renderer overlay canvas
```

## Typed review-control interface (FROZEN for this piece)

Installed at `window.__STARHAVEN_FORGE__` only under the guard above. All methods
synchronous unless noted. `snapshot()` is the single source of truth for tools.

```ts
type ForgePerspective = 'player' | 'rival' | 'omniscient';
type ForgeCameraMode  = 'normal' | 'tactical-close' | 'strategic-far';
type ForgeOverlayId   = 'paths'|'hit-regions'|'line-of-sight'|'orders'|'facing'|'entity-ids';

interface ForgeReviewSnapshot {
  scenario: string | null;
  requestedSeed: number | null;      // what was asked (URL/control), null if n/a
  actualSeed: number;                // >>>0 resolved config seed
  config: MatchConfig;               // complete canonical config
  state: AppState;
  tick: number;
  perspective: ForgePerspective;
  cameraMode: ForgeCameraMode;
  camera: { x: number; z: number; halfH: number };
  selection: number[];
  uiVisible: boolean;
  reviewFog: boolean;                // false = omniscient-style fog display, true = real fog per perspective
  overlays: Record<ForgeOverlayId, boolean>;
  frozen: boolean;
  liveEntities: number;
  totalEntitySlots: number;
  rendererInfo: { calls: number; triangles: number; points: number; lines: number } | null;
}
interface ForgeReviewControl {
  snapshot(): ForgeReviewSnapshot;
  setRoute(id: string): Promise<void>;       // reload-bearing
  setOrientation(o: 'landscape-left'|'landscape-right'): Promise<void>; // reload-bearing
  setFactions(player, rival): Promise<void>; // reload-bearing when a match exists
  setSeed(seed: number): Promise<void>;      // reload-bearing; deterministic mode
  setPerspective(p: ForgePerspective): void; // display-only
  setCameraMode(m: ForgeCameraMode): void;   // presets: normal=scenario/default, close halfH 5, far halfH 18
  setCamera(x: number, z: number): void;
  setUiVisible(v: boolean): void;
  setReviewFog(v: boolean): void;
  selectIds(ids: number[]): void;
  selectScout(): void;
  clearSelection(): void;
  setFrozen(v: boolean): void;
  step(ticks: number): void;                 // advances frozen sim deterministically, max 600/call
  setOverlay(id: ForgeOverlayId, on: boolean): void;
  metrics(): { fps: number; gameWorkP99Ms: number; rafP99Ms: number };
}
```

### Seed correctness (defect fix)

`parseQaScenario` accepts an additional `qa-seed=<0..2^32-1>` query parameter. When present,
the returned scenario's config becomes `{ ...config, seedMode:'deterministic', seed }`.
The capture backend and workbench always pass `qa-seed` alongside `qa`. Requested-vs-actual
seed equality is a hard gate everywhere. (Root cause of the old defect: QA configs pin
`QA_MATCH_CONFIG.seed = 0x5eed = 24301`; the old harness never overrode it.)

### Stepping legality

`step(n)` runs `world.step()` n times while `frozen` is true and flow is in a non-advancing
review hold; the rAF loop must not double-advance while stepping. Tick monotonicity and
determinism (same seed + same step count => same tick/entities) is tested.

### Perspective rendering rule

Player: real player fog exactly as shipped. Rival: display fog computed from rival-team
knowledge bits (`SEEN_RIVAL` side) without writing any knowledge. Omniscient: fog disabled
at display level. Implementation lives behind the renderer's existing fog texture update;
no writes into `World` discovery state. `setReviewFog(false)` forces fog-free display for
any perspective (review convenience), still without touching knowledge bits.

### Overlay rendering rule

Overlays draw on the renderer's existing 2D overlay canvas via a post-draw hook array on
`GameRenderer` (default empty; zero cost when unused). Overlay sources: sim entity/order/path
state read read-only. Each overlay must be individually toggleable and visible in snapshots.

## Capture model (serial)

One browser context; pages opened/closed one at a time; every cell: navigate -> wait probe ->
(optional settle/perf sample) -> composited screenshot -> analyze -> close page. No parallel
pages. Extras (ui-free/selected/close/far) reuse the SAME loaded page state as their base
route when safe (mutate via control instead of reloading) — removes the old redundant loads.

## Manifest schema (`forge-review-deck/1`)

Top level: `tool, schemaVersion, startedAt, finishedAt, git{commit,branch,dirty}, args,
requestedSeed, actualSeed, viewport{width,height,deviceScaleFactor}, environment{
browser, webglRenderer, softwareRenderer:boolean}, pack{routes[],extras[],perspectives[],
board, consoleTxt, criticBrief, clip}, failures[], ok`.

Each capture cell: `id, kind(route|extra|perspective), orientation, url, requestedSeed,
actualSeed, expectedState, actualState, tick, perspective, cameraMode, camera, selection,
config(full MatchConfig), image{file,width,height,minLuma,maxLuma,meanLuma,litRatio,
distinctColors,paletteAdherence}, perf{fps,gameWorkP99Ms,rafP99Ms}, draws, entities{live,total},
errors[], gates[], ok`. `p99GateMs` recorded when a budget is enforced.

Pure validator exported from `lib/manifest.mjs`; tests validate a fixture and reject
malformed manifests (missing fields, seed mismatch, wrong schemaVersion).

## Proof pack contents

- `cells/*.png` — 1366x1024 composited captures (exact size asserted).
- Routes: all 13 QA routes x BOTH orientations.
- Perspective triptych: opening route, synchronized player/rival/omniscient (same tick).
- Extras on opening: ui-free, selected-scout, tactical-close, strategic-far.
- Atlas/facing inspection ONLY if the asset pipeline already exposes a viewer route;
  otherwise omitted and noted (no new art tooling in this piece).
- `board.png` — labeled contact board; failed cells rendered red-labeled, never crash the board.
- `manifest.json`, `console.txt` (all console output + page errors), `critic-brief.txt`,
- `proof.webm` when `--clip`: short recorded sequence (load -> step -> overlay toggle).

`critic-brief.txt` lists pack contents, the objective gates the builder already ran, and the
questions a fresh critic should answer. It must not contain any builder visual verdict.

## Performance rules

Measure only with the normal game running alone (never the workbench multi-pane DOM).
Record separately, never conflated: `perf.gameWorkP99Ms` (probe ring, game code) and
`perf.rafP99Ms` (compositor frame spacing). FPS recorded. Absolute budgets enforced only
via explicit `--gate-p99=<ms>`. Environment records `webglRenderer` string and
`softwareRenderer: true|false` (SwiftShader/llvmpipe/Software detection). This Linux host
is SwiftShader ~20fps: numbers here are context, not iPad verdicts.

## Image gates (every cell)

expectedState == actualState; requestedSeed == actualSeed; screenshot exists; not black;
not empty; zero console/page errors; paletteAdherence + luminance spread recorded.
Board tolerates missing/failed cells (red label + preserved failure).

## Commands

- `npm run forge:review` — starts dev server and opens the workbench in the default browser.
- `npm run forge:review:capture -- --out=<abs> [--seed=N] [--gate-p99=ms] [--clip]
  [--routes=a,b] [--orientations=l,r] [--url=http://…]` — proof pack.
- `npm run qa:forge-review` — acceptance E2E (below).
- `npm run self-view` — unchanged legacy command until parity retires it.

## Acceptance E2E (`qa:forge-review`) — exact steps

start real game -> open workbench -> assert exactly one live game canvas -> select
deterministic route -> set seed 424242 -> probe actual seed == 424242 -> change camera mode ->
change perspective -> freeze -> step(37) -> tick advanced by 37 -> enable >=1 overlay -> capture
one shot -> zero console/page errors -> exit with zero leaked processes (vite/chromium/helper).

## Automated tests (`tests/forge-review.test.ts`, tsx, no browser)

seed propagation (qa-seed override parses); mismatch => hard failure; gameWork vs rAF fields
distinct in schema; manifest validator accept/reject; production isolation (vite.config inputs
exclude forge paths; production index.html unreferenced; if `dist/` exists it contains no
forge artifacts); control state reducer pure helpers (camera presets, overlay map defaults);
serial plan builder yields strictly sequential cells; server/browser stop() frees resources.

## Verification battery (before DONE)

`npm run test:m0`; `npm run build`; `npm run qa:forge-review`;
`npm run forge:review:capture -- --out=/home/bobbyranka/workspace/evidence/starhaven-forge-review/<ts>
--seed=424242 --clip`; dist inspection for absence of forge artifacts. Builder self-reports
objective results only; visual judgment is deferred to a fresh independent critic.
