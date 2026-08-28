# A5 — Forge Art Lab Workbench UX Audit & Interaction Spec

Status: **AUDIT (spec-level, read-only analysis + one owned file)**
Scope: developer-only workbench, separate Vite entry at `tools/forge-art/`. v1 is **NOT a pixel editor**.
Precedents read: `scripts/self-view-harness.mjs`, `src/town-center-viewer.ts`, `src/main.ts`, `index.html`, `public/front-end-shell.css`, `docs/CANONICAL_VOCABULARY.md`, `vite.config.ts`, `docs/M5_ARMY.md`.

Every convention below is either lifted from or deliberately divergent from a cited precedent. Where the UI builder implements `data-*` attributes, implement them **verbatim** as enumerated in §5 — QA (self-view harness style) will assert them.

---

## 1. Screen structure

Four zones + a top bar, dark theme carried over from the harness board (`#0B0A12` bg, `#F0E7D2` text, `#9CA6A5` muted, `#D09A4E` accent, fail `#B84B45`; `ui-monospace, Menlo, Consolas` for every readout — harness `.cap/.meta/.gate` styles).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TOP BAR  FORGE ART LAB · <asset breadcrumb> · [STATUS CHIP] · stale · link  │
├──────────┬──────────────────────────────────────────────┬───────────────────┤
│ CATALOG  │  COMPARISON STAGE                            │  INSPECTOR/METRICS │
│ RAIL     │  ┌───────────────────────┬────────────────┐  │  asset metadata    │
│          │  │ ACCEPTED BASELINE     │ CURRENT CAND.  │  │  objective gates   │
│ ▸Sunweaver│  │ (frozen 2D canvas)   │ (live WebGL →  │  │  context gates     │
│   Core   │  │                      │  2D snapshot)  │  │  metrics readout   │
│   Habitat│  │                      │                │  │  [copy failure JSON│
│   Yard   │  │            ║ wipe handle ║            │  │  [generate proof]  │
│   Wind   │  └───────────────────────┴────────────────┘  │                    │
│   Strider│  [facing] [pose] [frame] [▶/⏸] [speed]      │                    │
│ ▸Gravemark│  [passes: sil|val|alp|team|emi|diff] [1x]  │                    │
│   ...    │  [grid] [A/B: split|side-by-side|diff]      │                    │
├──────────┴──────────────────────────────────────────────┴───────────────────┤
│ CONTEXT STRIP  selectedState · camera halfH · bg · fog · teamColor · seed · │
│ version · gate-run log (Vite HMR events, last metrics run, timestamps)      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Left catalog rail (faction-grouped asset tree)

- One `<ul role="tree">`-style list, top-level groups **by canonical faction label**: `Sunweaver`, `Gravemark` (vocabulary table; legacy `vespari`/`aurion` never rendered). Group ordering fixed: faction → structure kind → units → environment.
- Structure kinds use the mandated labels: **Core**, **Habitat**, **Yard**. Units use faction-aware labels (M5_ARMY precedent: Sunweaver **Wind Strider** / Gravemark **Grav-Skimmer** for Scout; **Lumen Guard** / **Rift Guard** for Fighter; **Ore Worker** shared).
- Each leaf item: canonical label + stable ID (`data-fal-asset="sunweaver-core"`), plus a status dot derived from that asset's status model (§1.5).
- Typeahead search field at the rail top (`/` focuses it).
- Banned terms (Starhold, Sunfold, Sunwoven, Helion Compact, Kryos Conclave, Nihiline, ages/epochs) must not appear anywhere in the workbench UI, URLs, or hash keys — including this rail.

### 1.2 Center comparison stage

- Canvas pair, always rendered with **identical** camera, pose, frame, background, fog, team color (single store, §2 — both sides derive from it, so mismatch is impossible by construction).
- **Left: ACCEPTED BASELINE** — a *frozen 2D canvas* (snapshot blit, see §7.1). Never re-rendered live.
- **Right: CURRENT CANDIDATE** — the live asset under Vite HMR, rendered by the workbench's one WebGL renderer and blitted into its 2D display canvas each frame (or on demand when paused).
- Transport row under the stage: facing buttons (`data-fal-facing`, values `front|back|left|right|top` — the town-center-viewer view set; for 2D atlas assets a per-asset registry maps these onto directional-atlas rows), pose selector (`data-fal-pose`), frame stepper (`data-fal-frame`, ± with arrows when paused), play/pause (`data-fal-play`, `data-fal-pause`), speed slider (`data-fal-speed`).
- Pass toggles row: `silhouette | value | alpha | team | emissive | diff` (`data-fal-pass`, §5). Passes are shader/material overrides or 2D post-processes — never permanent source edits.
- Zoom control `1x | 4x | 8x` (`data-fal-zoom`) — CSS transform on the 2D canvases, **never a re-rasterization** (§7.2).
- Grid/axis overlay toggle (stage-ring precedent: visible only in labeled UI mode; excluded from captures).

### 1.3 Right inspector/metrics panel

- Asset metadata: canonical label, stable ID, source path(s), current source fingerprint (git HEAD + file mtime/size).
- **Objective gates** list — one row per gate, pass/fail, red `#B84B45` on fail; gates are the harness gates extended: `state match`, `capture black`, `capture empty`, `palette adherence ≥ 0.35`, `p99 frame budget`, plus diff gates (`pixel-diff %`, `bbox delta`). Numeric values in monospace.
- **Context gates** list — contextual/integration verdicts (label leakage scan, scale-vs-Yard-door, faction identity spot check). These are recorded review verdicts, not live numbers.
- Metrics readout line in the exact stats-line idiom from town-center-viewer: `12,480 tris · 214 draws · p99 8.4ms · pal 91%` (throttled 0.3s, same as `statsReadout`).
- `[copy failure JSON]` (`data-fal-copy-json`, §4) and `[generate proof pack]` (`data-fal-proof`) — proof pack reuses the self-view harness output contract: `cells/<asset>-<side>.png`, one composed `board.png`, `manifest.json` with per-cell probe/metrics/gates.

### 1.4 Bottom context strip

- Single line, monospace, mirroring the harness board `meta.line` idiom: `selectedState · camera halfH 5.0 · bg void · fog off · teamColor sunweaver · seed 24291 · v0.1.0 · 2026-08-26T…Z`.
- Gate-run / HMR event log (last ~6 events): `14:02:11 candidate HMR · 14:02:12 metrics re-ran · 3/6 gates pass`.

### 1.5 Status model chips (exact strings, verbatim)

One chip per asset slot, rendered in the inspector and as a dot in the rail. **The seven chip strings are frozen API:**

| Chip (exact text) | Meaning | Style |
| --- | --- | --- |
| `ACCEPTED BASELINE` | frozen reference side; immutable this session | amber outline, monospace caps |
| `CURRENT CANDIDATE` | live editable source side | cyan outline |
| `PREVIEW OVERRIDE` | in-session override active (bg/fog/team/pose tweak not in source); evidence flagged non-source | violet |
| `OBJECTIVE FAIL` | ≥1 automated gate failing right now | solid `#B84B45` |
| `CONTEXT FAIL` | all objective gates pass but a recorded context verdict fails | orange |
| `READY FOR REVIEW` | all objective + context gates pass, not yet accepted | green outline |
| `ACCEPTED` | promoted: candidate has become the baseline | solid green |

Rules: exactly one chip visible per asset slot; `ACCEPTED` promotion rewrites the baseline snapshot and re-stamps the fingerprint; chips are DOM siblings of the stage, **never composited into canvas pixels** (§7.3).

### 1.6 Keyboard shortcuts

| Key | Action |
| --- | --- |
| `/` | focus catalog search |
| `[` `]` | previous / next asset in catalog |
| `1`…`6` | toggle passes (silhouette, value, alpha, team, emissive, diff) |
| `Space` | play / pause pose animation |
| `←` `→` | step frame (paused); `Shift` = 10-frame step |
| `A` `D` | move wipe handle (split mode only; also via slider `aria-keys` — no drag-only operation) |
| `Tab` | cycle A/B mode: `split → side-by-side → diff` |
| `Z` | zoom `1x → 4x → 8x` |
| `V` | cycle camera view (facing) |
| `G` | toggle grid overlay |
| `P` | generate proof pack |
| `C` | copy failure JSON |
| `Esc` | clear selection / close overlay |
| `?` | toggle shortcuts overlay |

### 1.7 A/B split-wipe mechanics (canvas pair)

- Both canvases are laid out **exactly coincident** (absolute-positioned, same box). Baseline underneath; candidate on top with `clip-path: inset(0 0 0 <wipe%>)` — the wipe is pure CSS, **zero redraw** while dragging (§7.2).
- Wipe handle: a vertical divider element with a thumb, implemented as `input[type=range]`-backed (`data-fal-wipe`) so it is keyboard- and screen-reader-accessible; `aria-valuemin=0 aria-valuemax=100 aria-valuenow=<wipePosition>`.
- `side-by-side` mode: clip-path removed, canvases laid out in a 2-col grid.
- `diff` mode: a third canvas (diff heatmap, `data-fal-canvas-diff`) overlays the pair at 50% opacity; wipe handle hidden.
- Wipe position lives in the store (`wipePosition`, 0–100) and serializes to the URL hash (§2.2).

---

## 2. Synchronized state model

### 2.1 Single store shape (exact)

```ts
interface ForgeLabState {
  assetId: string;                 // canonical stable ID, e.g. 'sunweaver-core', 'gravemark-rift-guard'
  side: 'front' | 'back' | 'left' | 'right' | 'top';   // facing; maps to atlas rows via asset registry
  pose: string;                    // asset-defined pose/state id
  frame: number;                   // animation frame index
  playing: boolean;                // pose animation running
  speed: number;                   // playback multiplier, 0.25–4
  camera: { halfH: number };       // game camera half-height param (harness 'close'=5 / 'far'=18 precedent)
  background: string;              // environment id ('void' | 'helios-rift' | 'studio')
  fogMode: 'off' | 'on' | 'dense';
  teamColorMode: 'sunweaver' | 'gravemark' | 'none';
  selectedState: string | null;    // entity state under review (idle/move/attack/build/…)
  abMode: 'split' | 'side-by-side' | 'diff';
  wipePosition: number;            // 0–100, split mode only
  zoom: '1x' | '4x' | '8x';
  passes: {                        // ordered booleans; UI order = this order
    silhouette: boolean;
    value: boolean;
    alpha: boolean;
    team: boolean;
    emissive: boolean;
    diff: boolean;
  };
}
```

- **Every view derives from it.** Catalog selection, transport, passes, wipe, zoom, metrics, proof generation all read one store; mutations go through one `update(partial)` that: applies state → re-renders UI → re-runs affected metrics → re-serializes the hash (debounced) → re-blinks nothing else.
- Probe contract mirrors the precedents: workbench publishes a **frozen** `window.__FORGE_ART_LAB__` (main.ts `Object.freeze(qaProbe)` shape; town-center-viewer probe shape) with `{ version, ready, state: <store snapshot>, status, gates: [{id, pass, value}], metrics, setView?, update }`. `document.body.dataset.ready = 'true'` on first rendered frame (town-center-viewer idiom). QA waits on `Boolean(globalThis.__FORGE_ART_LAB__)`.
- Camera/lighting/background knobs are the **same knobs the game QA uses** (`__STARHOLD_INPUT__.halfH`, `?ui=0`), so candidate evidence is comparable to game captures.

### 2.2 URL hash serialization (deep links)

- Canonical deep link = location hash, compact key=value pairs, `&`-joined, short keys, canonical IDs only:

```
#fal=a=sunweaver-core&f=front&po=idle&fr=3&pl=0&sp=1&c=5&b=helios-rift&fo=off&t=sunweaver&st=attack&m=split&w=42&z=4x&pa=sil,team
```

- Key map: `a`=assetId, `f`=side, `po`=pose, `fr`=frame, `pl`=playing(0/1), `sp`=speed, `c`=camera.halfH, `b`=background, `fo`=fogMode, `t`=teamColorMode, `st`=selectedState, `m`=abMode, `w`=wipePosition, `z`=zoom, `pa`=passes (csv of enabled, order fixed).
- Parse on boot; absent keys fall back to defaults; unknown keys ignored (forward-compat); values must be canonical stable IDs — legacy `vespari`/`aurion`/`epoch` hash values are rejected, not adapted.
- A `[copy deep link]` button writes the current hash to the clipboard; the context strip shows the raw hash in monospace.

---

## 3. HMR / reload contract

| Concern | Behavior |
| --- | --- |
| Survives reload | Whole `ForgeLabState` (§2.1) + last-proof stamp `{proofId, sourceFingerprint, generatedAt}`. Source of truth: URL hash; on reload the store is rebuilt from the hash, then `sessionStorage['fal.state.v1']` restores anything hash-incompatible (wipe drag mid-session etc.). Hash wins on conflict. |
| Re-runs automatically on reload | Candidate boot: mount live canvas → verify probe → **re-run all objective gates and metrics** (they are cheap; harness already computes them per cell) → update status chip (may flip `READY FOR REVIEW` → `OBJECTIVE FAIL`). |
| Re-runs on HMR | `import.meta.hot.accept` on the candidate asset module → dispose old model/renderer bits (town-center-viewer `beforeunload` dispose precedent) → rebuild candidate → **re-run gates** → append `candidate HMR` event to the context-strip log. One reload of the *candidate side only*; the baseline snapshot is untouched. |
| Survives HMR | Store, status chip, wipe position, passes, baseline snapshot. Candidate source module is the only thing swapped. |
| `PREVIEW OVERRIDE` | Any in-session knob (bg/fog/team/pose) that does not touch source flips the chip to `PREVIEW OVERRIDE`; it survives reload via sessionStorage but is **never** written to the hash as evidence of source (the hash keeps the override for recreation; manifest stamps `source:false` on proof cells). |
| Stale evidence | Proof pack manifest stamps `sourceFingerprint` (git HEAD + asset source file mtimes/sizes). On load, workbench recomputes the fingerprint; mismatch → top bar shows a `STALE EVIDENCE` badge (`data-fal-stale="true"`), amber, with `proof <id> generated <ts>; source changed since` in the context strip. Chip logic: stale proof never reads as `ACCEPTED`. |

---

## 4. Accessibility + developer ergonomics

- **Focus order**: top bar → catalog rail (search first) → stage transport row → passes row → wipe/zoom → inspector (gates → copy → proof) → context strip. Tab order matches visual layout; nothing reachable only by drag (§1.6 keyboard table is the fallback).
- Real controls, never divs: `<button>`, `<input type=range|checkbox>`, `<select>` — the town-center-viewer `data-view`/`data-stage` button-loop pattern (`querySelectorAll('[data-…]')` + `.active` class toggle) is the model for every control row.
- Required `aria-label`s (verbatim): `"Catalog: <faction> assets"` (group), `"Asset <label> (stable ID <id>)"` (item), `"Facing: <side> (active)"`, `"Play pose animation"`, `"Pause pose animation"`, `"A/B mode: <mode>"`, `"Pass toggle: <passName>"`, `"Zoom: <level>"`, `"Wipe handle"`, `"Copy failure JSON"`, `"Generate proof pack"`, `"Copy deep link"`.
- Status chip: `role="status" aria-live="polite"` (chip text changes announce without stealing focus). Toggles use `aria-pressed`; wipe uses `role="slider"` + aria-valuenow.
- **Monospace metrics readouts** everywhere numbers appear (harness font stack), right-aligned, no trailing units drift; `font-variant-numeric: tabular-nums`.
- **Copyable failure JSON**: `[copy failure JSON]` writes `{assetId, status, generatedAt, fingerprint, gates:[{id, pass, value, threshold}], contextVerdicts:[…]}` via `navigator.clipboard.writeText`; the same JSON renders in a `<pre data-fal-failures>` in the inspector so it can be selected by hand. This is the harness `manifest.failures` shape.
- `prefers-reduced-motion`: turntable/pose auto-rotate off (viewer precedent); wipe stays instant.
- Focus-visible outlines on all controls; the stage is `tabindex=0`-free (keyboard goes through controls, not the canvas).

---

## 5. DOM / test hooks spec (implement verbatim)

QA (self-view-harness style: `waitForFunction` probe + element-scoped screenshots) asserts these. **Exact attribute names, frozen:**

| Attribute | On | Value / notes |
| --- | --- | --- |
| `data-fal-catalog` | rail container | — |
| `data-fal-catalog-group` | faction group header | `sunweaver` \| `gravemark` |
| `data-fal-asset` | catalog leaf | canonical stable ID (`sunweaver-core`, …) |
| `data-fal-status` | status chip | one of the 7 exact strings from §1.5 |
| `data-fal-canvas` | **every** canvas in the stage | `baseline` \| `candidate` \| `diff`; canvas count assertion = `[data-fal-canvas]` length (must be 2, or 3 in diff mode) |
| `data-fal-facing` | facing buttons | `front\|back\|left\|right\|top` |
| `data-fal-pose` | pose buttons | pose id |
| `data-fal-frame` | frame stepper / readout | frame index |
| `data-fal-play` | play button | — |
| `data-fal-pause` | pause button | — |
| `data-fal-speed` | speed slider | 0.25–4 |
| `data-fal-pass` | pass toggles | `silhouette\|value\|alpha\|team\|emissive\|diff` |
| `data-fal-abmode` | A/B mode control | `split\|side-by-side\|diff` |
| `data-fal-wipe` | wipe handle | range input, 0–100 |
| `data-fal-zoom` | zoom control | `1x\|4x\|8x` |
| `data-fal-metrics` | metrics readout block | — |
| `data-fal-failures` | failure JSON `<pre>` | — |
| `data-fal-copy-json` | copy button | — |
| `data-fal-proof` | generate-proof button | — |
| `data-fal-stale` | top bar badge | `"true"` when stale evidence detected; absent otherwise |
| `data-fal-hash` | context strip | current canonical hash string |
| `data-fal-ready` | `<body>` | `"true"` after first rendered frame (supersedes `dataset.ready` for the workbench; keep `data-ready` too for parity) |

QA gate shape (harness precedent): `[data-fal-canvas="baseline"]` count == 1, `[data-fal-canvas="candidate"]` count == 1, exactly one `[data-fal-status]` per asset slot, `[data-fal-asset]` labels all ∈ canonical ID set, no banned term present in `document.body.innerText`.

---

## 6. v1 non-goals (hard box)

**Forge Art Lab v1 explicitly does NOT include:**

- ❌ Pixel painting / drawing tools of any kind
- ❌ Brush tools (any), eraser, eyedropper-as-editor
- ❌ Layer editing / layer panels / blend modes as an editor
- ❌ Image import (PNG/JPEG/SVG upload into assets)
- ❌ AI generation (no image-gen, no prompt-to-asset inside the workbench)

The workbench *inspects, compares, gates, and proves* — it never mutates pixels. Source edits happen in the developer's editor and arrive via Vite HMR. Anything that smells like an editor (canvas with paint events, layer list, import dropzone) is out of scope for v1; a stray brush UI in v1 is a spec violation, not a feature.

---

## 7. Risks

### 7.1 Canvas count discipline (one live WebGL + N frozen 2D)

- Exactly **one** `WebGLRenderer` for the whole workbench (town-center-viewer config: `antialias`, `powerPreference:'high-performance'`, `pixelRatio ≤ 2`, ACES tone mapping, sRGB output). The baseline and diff views are **2D canvases**, never additional GL contexts.
- Baseline freeze: after rendering a state, `ctx2d.drawImage(glCanvas, 0, 0)` **synchronously in the same task** (before browser composite), or render into a `WebGLRenderTarget` and blit — no `preserveDrawingBuffer` needed with the sync draw; if a later-task draw is unavoidable, do a second render pass instead of enabling `preserveDrawingBuffer` globally (perf cost on every frame).
- Frozen-canvas pool, cap **N = 4** (baseline, candidate, diff, 1 spare), recycled on state change, never allocated per frame. A 5th canvas is a bug; QA asserts `[data-fal-canvas]` count.
- HMR/dispose: a hot-swapped candidate module must dispose the old model geometry/material/renderer state (viewer `beforeunload` dispose pattern, but wired to `import.meta.hot.dispose`) — WebGL contexts are a finite resource per page and leaked contexts break the single-context invariant.

### 7.2 Full-sheet redraw performance

- Wipe dragging is **clip-path only** — zero raster work; never re-blit per pointermove. Re-blit happens only on store change (asset/side/pose/frame/zoom/environment/playing tick when playing).
- Diff pass is O(w×h): compute at capped resolution (long edge ≤ 1024), debounced ~100 ms, cached per `(assetId, side, pose, frame, background, fogMode, teamColorMode)` fingerprint; `getImageData` readback flushes the GL pipeline — batch one read per state change, never per frame.
- Software-GL hosts (SwiftShader — the harness explicitly warns p99 budgets don't transfer there) make readbacks pathological: on `WEBGL_debug_renderer_info` SwiftShader, drop readback frequency to store-change-only and skip diff auto-run.
- Zoom 1x/4x/8x = CSS `transform: scale()` on the 2D canvases; no re-render, no re-blit.

### 7.3 Label leakage into unlabeled boards

- Labels, chips, and metrics must **never be composited into canvas pixels**. Rules: (a) all chrome is DOM siblings of the canvases, never overlays inside the canvas rect; (b) proof/roster captures are element-scoped (CDP element screenshot of `[data-fal-canvas]` nodes), so DOM chrome is outside the clip by construction; (c) `?fal-clean=1` capture mode hides all chrome (the `?ui=0` HUD-visibility idiom from main.ts / town-center-viewer `panel.hidden`) for full-page captures; (d) a QA gate asserts each labeled element's bounding box does not intersect any canvas element's box — the label-leak regression the self-view harness's own `.tag` overlay would otherwise encourage.
- The composed roster board (proof pack) *adds* labels only in the composer step (harness `composeBoard` `.cap`/`.tag`), i.e., labels belong to the manifest+HTML layer, never baked into the per-cell PNGs. If a pixel watermark is ever demanded, it goes in `manifest.json`, not the image.

---

*Sources: scripts/self-view-harness.mjs (board composition, gates, palette strip, meta line, probe wait), src/town-center-viewer.ts (data-view/data-stage buttons, probe object, stats line, dispose, reduced motion), src/main.ts (frozen __STARHAVEN_QA__ probe, __STARHOLD_INPUT__/VIEW/WORLD, ?ui=0), index.html + public/front-end-*.css (inline+linked CSS baseline, canvas overlay stack), docs/CANONICAL_VOCABULARY.md (frozen labels + banned terms), docs/M5_ARMY.md (faction unit labels), vite.config.ts (multi-entry rollup input — add `forgeArt: 'tools/forge-art/index.html'`).*
