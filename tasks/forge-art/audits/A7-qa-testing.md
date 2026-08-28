# A7 — QA and Testing Audit: test/QA strategy for Forge Art Lab

Agent: audit A7 · Date: 2026-08-26 · Scope: READ-ONLY except this file
Sources read (full): `tests/vs4-combat-assets.test.ts` (814 ln, pure tsx + node:assert), `scripts/qa-vs4-combat-assets.mjs` (1103 ln), `scripts/self-view-harness.mjs` (542 ln), `package.json`, `src/main.ts` probe surface (lines 490–573), `src/qa-scenarios.ts`, `src/render.ts` context, `vite.config.ts`, `docs/CANONICAL_VOCABULARY.md` (frozen 2026-08-21), sibling audits `A2-unit-contract.md`, `A4-renderer-integration.md`.

Environment facts locked in: Linux, no GPU (SwiftShader WebGL, steady ~20fps — absolute frame budgets do NOT transfer); Playwright `channel:'chrome'` FAILS here, `executablePath:'/usr/bin/chromium'` works (verified present); installed playwright 1.62.1 / vite 7.3.6; `npm install` may need `npm rebuild esbuild` if postinstall scripts were blocked.

The FAL brief's acceptance vocabulary is the frozen canonical table: stable ids `starhaven`, `sunweaver`, `gravemark`, `voidmarked` (hidden, deferred, NOT deleted), `helios-rift`, `central-lumen-field`, `core`, `tech-path` + four path ids; banned public terms: Starhold, Sunfold, Sunwoven, Helion Compact, Kryos Conclave, Nihiline, ages/epochs. Legacy sim ids (`vespari`, `aurion`, Hall/Nexus) stay private behind adapters. Lumen Guard = Sunweaver Fighter (row 0), Solar Strider = Sunweaver Ravager (row 1), Rift Guard = Gravemark Fighter (row 2), Burden Walker = Gravemark Prism (row 3) — the vs4 atlas rows the workbench reuses.

---

## 1. Test matrix (FAL-QA-01 … FAL-QA-29)

Layer legend: **P** = pure tsx test (`node:assert/strict`, no DOM, no server — RED-GREEN-REFACTOR, failure arrays logged and asserted empty at end, vs4 pattern) · **B** = browser-QA assertion inside `scripts/qa-forge-art.mjs` (Playwright chromium 1366×1024) · **S** = standalone shell/node script. Files: `tests/forge-art-registry.test.ts`, `tests/forge-art-cells.test.ts`, `tests/forge-art-pipeline.test.ts`, `scripts/qa-forge-art.mjs`, `scripts/forge-art-prod-isolation.mjs`.

| id | Requirement | Layer | Where | What asserts |
|---|---|---|---|---|
| FAL-QA-01 | Canonical ids | P+B | registry.test.ts + qa step 3 | Registry table contains exactly the stable ids (`sunweaver`, `gravemark`, `central-lumen-field`, `core`, `helios-rift`, `tech-path`, path ids); every public label/id/probe key uses them. Browser: probe `catalog.entries[].id` and rendered labels match. |
| FAL-QA-02 | No legacy labels in public surface | P+B | registry.test.ts + qa step 3/15 | Pure: banned-term list (Starhold, Sunfold, Sunwoven, Helion Compact, Kryos Conclave, Nihiline, epoch/age-up) absent from all labels/ids/config keys in the tool's public export. Browser: scan rendered DOM `innerText` of catalog + detail + roster for the banned list; probe keys prefixed `forgeArt*` never `starhold*`. |
| FAL-QA-03 | Hidden faction absent | P+B | registry.test.ts + qa step 4/15 | Pure: `voidmarked` not exported by the registry module (may exist privately in the adapter table, never in `catalog.entries`). Browser: entry count matches expected, `voidmarked`/`nihiline` absent from DOM and `__FORGE_ART_QA__` JSON. |
| FAL-QA-04 | Registry validation | P | registry.test.ts | Every entry validates: id matches `^[a-z0-9-]+$`, label non-empty, kind ∈ {0..6,10..13,20}, faction ∈ {sunweaver,gravemark}, cellW/cellH positive, unique ids, no duplicate (id,kind) pairs, unknown entries rejected. |
| FAL-QA-05 | Adapter dims | P | registry.test.ts | `adapter(sunweaver) === 'vespari'`, `adapter(gravemark) === 'aurion'` at the boundary only; cell dims per class: Lumen/Rift Guard 64×64 (COMBAT_CELL), Solar/Burden Walker 64×64, building (Core) 64×64, worker8 32×48 — mirrors the A2 area-relative threshold rule (0.12/0.55 fractions of cell area, never literals). |
| FAL-QA-06 | Baseline hash stability | P+B | pipeline.test.ts + qa step 7/16 | Pure: `generateBaseline(seed)` deterministic — repeated calls byte-identical; SHA-256 of full RGBA cells frozen as digests (vs4 `FROZEN_R3_CELL_SHA256` pattern); digest table asserted equal. Browser: baseline file written by tool re-reads to the same digest after page reload. |
| FAL-QA-07 | Unrelated-cell preservation | P | pipeline.test.ts | Editing candidate cell (row,dir,pose) leaves every other cell byte-identical to baseline (differingPixels === 0 outside the edited cell); atlas assembly never rewrites untouched regions. |
| FAL-QA-08 | Alpha bounds | P | cells.test.ts | `alphaCount` within [0.12·w·h, 0.55·w·h] per class (area-relative, A2 §A); alpha > 0 convention; non-empty. |
| FAL-QA-09 | Connected components | P | cells.test.ts | `primaryComponentShare >= 0.96` (8-neighbor, vs4); for buildings single dominant mass; mask components on core mask for guards (head ≥80 connected, legs separate ≥6px masses, center gap 0 — vs4 anatomy contract reused for the four combat units). |
| FAL-QA-10 | Facing/pose variance | P | cells.test.ts | `poseDeltaPercent ∈ (4,45)` for bipeds (4–45 proven bound); buildings static flag: 0–2% (A2 gap table); facing variance: adjacent-dir meanRgbaDelta > 18 (N vs E), self-IoU ≥ 0.85 across facings; `facingBoundsSwim`/`centroidSwim` advisories until calibrated. |
| FAL-QA-11 | Mirror rules | P | cells.test.ts | `deepEqual(mirror.d, source.flipX().d)` for mirror pairs `[1,3],[0,4],[7,5]` (all rows/poses); `flipX` returns a NEW buffer, never mutates; author dirs E/NE/N/S/SE = 0,1,2,6,7; normalized-facing anatomy measurement (vs4 `normalizedFacing`). |
| FAL-QA-12 | Anchor stability | P | cells.test.ts | `bottomGapRows <= 2` (last alpha row within 2px of anchor row per class); `groundContactRow` consistent across all facings of a unit (feet do not float or sink when facing changes); maxY bounds per class (guard maxY ≤ 51, vs4 R3). |
| FAL-QA-13 | Luminance | P | cells.test.ts | `averageLuma >= 3 × QUIET_TERRAIN_LUMA(30) = 90` (terrain-relative, parameterized); `brightMaterialShare >= 0.30` (luma ≥ 65, material planes not emissive); per-cell `averageLuma >= 30` floor so 1 stray pixel can't pass emptiness. |
| FAL-QA-14 | Team/emissive shares | P | cells.test.ts | `magShare ∈ [0.005, 0.05]` for combat units (proven MAG band); `colorShare(teamColor)` 0.5–5% where emissive authored, 0 floor where none (A2 §4 — floor is per-asset config, not a literal); runtime frames assert 0 exact-MAG (vs4 noRuntimeMagenta). |
| FAL-QA-15 | Silhouette overlap | P | cells.test.ts | `silhouetteIou(row0,row2) < 0.78` (guard pair) and `(row1,row3) < 0.78` (walker pair) — class-pair-specific config; buildings: IoU against other buildings < 0.85 until calibrated. |
| FAL-QA-16 | Building ground contact | P | cells.test.ts | Core/building `groundContactRow` touches the footprint anchor row; `bottomGapRows === 0` for buildings (they sit ON the ground, unlike units which hover ≤2px); construction state (progress 0.5) keeps contact. |
| FAL-QA-17 | Footprint metadata | P+B | registry.test.ts + qa step 12 | Registry entry carries `footprint: {w,h}` matching the construction overlay grid the tool renders; browser asserts overlay grid cells == metadata w×h (qa step 12). |
| FAL-QA-18 | Fixture determinism | P+B | pipeline.test.ts + qa steps 7/10 | Pure: same seed → same cells/atlas bytes (hash equality), Math.random overridden with `mulberry32(fixedSeed)` before any generation (A4 risk 4). Browser: same seed twice → two screenshots with `differingPixels === 0` (byte-identical PNGs), frozen `world.step` and tick. |
| FAL-QA-19 | ONE live WebGL context | B | qa step 19 | Concrete counting method (see §2 step 19): `document.querySelectorAll('canvas')` → `canvas.getContext('webgl2') || canvas.getContext('webgl')` (same-type getContext returns the EXISTING context, never creates a new one; a 2D overlay canvas returns null) → exactly 1 live; cross-check `renderer.domElement === that canvas`, `renderer.info.render.calls > 0`, probe counter `__FORGE_ART_QA__.gl.contexts === 1` (tool counts its own `new WebGLRenderer` calls). Zero after teardown. |
| FAL-QA-20 | Malformed baseline | P+B | pipeline.test.ts + qa step 16 | Pure: validator rejects truncated/zero-length/corrupt-hash/RGB-residue-under-alpha baseline files with explicit error (sha256 mismatch → refusal message names the file and expected digest). Browser: tool shows refusal state, no proof written, exit non-zero. |
| FAL-QA-21 | Partial candidate | P+B | pipeline.test.ts + qa step 16 | Pure: candidate missing one (row,dir,pose) cell or with wrong dims is refused before any metric runs (validate-all-then-measure). Browser: refusal surfaced, gates not evaluated, no write. |
| FAL-QA-22 | Dry-run acceptance | P+B | pipeline.test.ts + qa step 16 | Pure: dry-run planner produces the full pass/fail report and write-plan without touching the filesystem (no fs writes in dry-run path). Browser: `--dry-run` flag → exit 0 with proof manifest marked `dryRun:true`, output dir untouched (assert dir mtime/contents unchanged). |
| FAL-QA-23 | Refusal on failed gates | B | qa step 16 | Any gate red (alpha, luma, mirror, anchor, IoU, …) → accept button disabled/refusal message lists failing metric + value + threshold; `manifest.ok === false`; exit code 1. |
| FAL-QA-24 | Refusal on stale evidence | B | qa step 16 | Proof generation refuses when candidate/baseline file mtime is OLDER than the last registry/metrics code change (tool records `evidenceBuiltAt` vs `toolVersion`); browser stages an artificially old candidate (utimes) → refusal names the stale file. |
| FAL-QA-25 | HMR reload | B | qa step 17 | With vite dev server, trigger a reload (or vite full-reload after touching a tool source file) → page recovers to same selection state (URL-hash encoded), probe present again, `gl.contexts` back to 1 (old context released via `forceContextLoss` on `beforeunload`), zero console errors. |
| FAL-QA-26 | Proof completeness | B | qa step 16 | Proof manifest.json contains: baselineSha256, candidateSha256, seed, viewport (1366×1024), toolVersion, per-metric {name,value,threshold,ok}, screenshot paths, startedAt/finishedAt, dryRun flag; every referenced file exists on disk; JSON parses. |
| FAL-QA-27 | Browser errors zero | B | qa all steps | `attachErrors` (vs4 pattern: console.error + pageerror pushed to manifest.errors) across every page; final `manifest.ok = manifest.errors.length === 0`. |
| FAL-QA-28 | Production isolation | S | forge-art-prod-isolation.mjs | See §3. |
| FAL-QA-29 | Process cleanup | B+S | qa step 19 + §4 checklist | After finally-block: `pgrep -f "vite.*<qa-port>"` and `pgrep -f "chromium.*<qa-profile-dir>"` both empty; temp dirs removed; manifest.json still written on failure. |

RED-GREEN-REFACTOR discipline: each of the three pure files must first run RED against the current (missing) implementation, then GREEN after the tool lands, then be refactor-safe (they stay independent copies — never import the tool's internals in a way that couples the gate to implementation, per A2 §3 duplication doctrine; they may import `tools/forge-art/src/*` only after the A2 metrics library is calibrated against the frozen digests).

Script wiring (repo convention `test:*` → tsx chain, `qa:*` → node mjs):

```json
"test:forge-art": "tsx tests/forge-art-registry.test.ts && tsx tests/forge-art-cells.test.ts && tsx tests/forge-art-pipeline.test.ts",
"qa:forge-art": "node scripts/qa-forge-art.mjs",
"qa:forge-art-prod": "node scripts/forge-art-prod-isolation.mjs"
```

Probe design for the tool page (mirror `src/main.ts:517-542` — `Object.freeze` + publish, never mutated):
`window.__FORGE_ART_QA__` with `{ version, state, catalog: {entries}, selection: {id, kind, facing, pose, passes[]}, ab: {baselineSha256, candidateSha256, active}, playing, frame, proof: {written, path, dryRun, baselineSha256, candidateSha256, seed, viewport, toolVersion}, gl: {contexts, canvases}, errors[] }`. Tool must also expose `__FORGE_ART_TOOL__` handles (`{world, view, input, registry, submitProof}`) exactly like `__STARHOLD_WORLD__/__STARHOLD_VIEW__/__STARHOLD_INPUT__`.

---

## 2. `qa:forge-art` flow spec — 19 numbered steps (mirrors the FAL brief)

Setup invariants for every step: viewport **exactly** `{width:1366, height:1024, deviceScaleFactor:1}`; `attachErrors` on every page; `setDefaultTimeout(PROBE_TIMEOUT_MS=30000)`; manifest `{tool:'qa-forge-art', startedAt, finishedAt, checks:{}, captures:{}, errors:[], ok:false}`; `--out` required absolute path OUTSIDE the repo (`resolveOut` from qa-vs4: relative must start with `..`); every page closed in finally, browser closed, server stopped, **manifest.json always written in finally even on throw** (vs4 lines 1079-1099), `process.exitCode = 1` when `!ok`.

1. **Build/start separate port.** Run `npm run build` once (also feeds §3 isolation) then `startServer()` — vite spawn on a `findOpenPort()` random port, `--host 127.0.0.1 --strictPort`, `detached:true`, boot-poll `fetch(url)` until ok or 120s deadline; NEVER touch the game's 5173/4173. Assert the tool route serves: `GET /tools/forge-art/index.html` → 200.
2. **Probe ready.** `page.goto(url + '/tools/forge-art/index.html?seed=0x5eed&mesh=0&combat=1&qa=1')`; `waitForFunction(() => globalThis.__FORGE_ART_QA__?.state === 'ready')`; `settleFrames` (double rAF). Assert probe fields present (`version`, `catalog`, `gl.contexts === 1`).
3. **Catalog contents.** Probe `catalog.entries`: Sunweaver AND Gravemark present (labels + stable ids); expected entry count; every label/id matches the frozen canonical table. **Legacy terms absent** (FAL-QA-02): regex banned list over `page.evaluate(() => document.body.innerText)` AND over `JSON.stringify(probe)` — zero hits.
4. **Hidden faction absent** (FAL-QA-03): `voidmarked`/`nihiline` absent from DOM + probe JSON + catalog entry count is exactly the public set.
5. **Lumen Guard select.** Click the Lumen Guard entry (data-testid `entry-lumen-guard` or probe-driven `input.select(entry)`); assert selection state `{id:'lumen-guard', kind:2, faction:'sunweaver'}` and detail panel shows canonical label — never "vespari"/"Fighter" in rendered text.
6. **Facing.** Step facings 0→7 via the facing control; assert probe `selection.facing` advances 0..7 and wraps; for dirs 3,4,5 assert preview uses the mirrored source (`flipX` semantics match the pure mirror test — same cell sha as `cells[2][normalized]`); feet anchor row unchanged across facings (FAL-QA-12 cross-check).
7. **Play / pause.** Play: two `settleFrames` apart, probe `frame` strictly increased. Pause: `frame` identical across two settleFrames. No errors.
8. **A/B.** Toggle A (baseline) vs B (candidate): probe `ab.active` flips; A's atlas cell sha256 equals the frozen baseline digest (FAL-QA-06 live check); B shows candidate bytes. `ab.baselineSha256/candidateSha256` non-empty and matching files on disk.
9. **Passes.** Run the metric pass suite (alpha, connected, facing/pose variance, mirror, anchor, luma, team/emissive, silhouette IoU, ground contact): each pass reports `{name, value, threshold, ok}`; summary gate `allPassed` reflects the conjunction; log the report to manifest.
10. **Context.** Selection context panel shows: unit class, faction, cell dims, footprint, mirror-pair table, anchor row — all from registry config; legacy adapter hidden (may appear as `(adapter: vespari)` grayed debug line ONLY if a `?debug=1` flag is on — assert it is off by default).
11. **Building select.** Select the Core/building entry; assert construction state renders (progress 0.5 fixture from A4 §3 `construction` scene), `selection.kind` is the building kind, `hp=maxHp`.
12. **Construction.** Drag/step the construction progress control 0→1; assert preview updates (dissolve/construction alpha path), probe `selection.progress` matches, zero errors, and ground contact holds at every step (FAL-QA-16 cross-check).
13. **Footprint.** Assert the footprint overlay grid on the building equals `registry.footprint {w,h}` (FAL-QA-17 live); overlay canvas is the 2D `#overlay` (does not count toward the GL context budget).
14. **Scale refs.** Spawn Lumen Guard beside the building (A4 stage() helper); assert rendered relative height within the documented ratio band and the reference unit's world scale columns match `EXPECTED_WORLD_SCALES`-style config (`instanceMatrix` column-norm probe, vs4 `readCombatInstanceScales`).
15. **Roster view.** Switch to roster list: all unit classes present with canonical labels; hidden faction absent; legacy labels absent (re-run FAL-QA-02 scan on the roster DOM).
16. **Proof validation.** Drive accept with all gates green → proof written; then three refusal cases on fresh pages: (a) candidate cell corrupted on disk (mutate one PNG byte) → refusal names file + metric; (b) baseline mtime back-dated (`utimes` to 2h ago) → **refusal on stale evidence**; (c) `--dry-run` run → exit 0, `dryRun:true`, output dir untouched (record `stat` before/after). Verify proof manifest completeness per FAL-QA-26 (every referenced file exists, JSON parses, hashes match files).
17. **HMR reload.** `page.reload()` (and one real vite HMR: touch a tool source file via `fs.utimes` → wait for vite full-reload banner) → probe returns to `ready`, selection restored from URL hash, `gl.contexts === 1` again, zero errors (FAL-QA-25).
18. **Screenshot non-black + exact dims.** Full-page PNG → `analyzePng` (vs4): `width===1366 && height===1024`, `maxLuma > 6`, `litRatio > 0.002`, `exactMagenta === 0`. Same assertions on the lineup and roster shots.
19. **ONE WebGL context + cleanup kill verification.** Counting method (concrete): `page.evaluate(() => [...document.querySelectorAll('canvas')].filter(c => (c.getContext('webgl2') || c.getContext('webgl')) != null))` → length must be 1 (same-type getContext returns the live context, never creates one; the 2D overlay and any footprint grid canvases return null); cross-checks: `renderer.domElement` is that canvas, `renderer.info.render.calls > 0`, `__FORGE_ART_QA__.gl.contexts === 1`. Do NOT use `performance.getFrameData()` — removed/unreliable in current Chromium; the WEBGL probe is the supported path. Then teardown in finally (pages → browser.close → stopServer SIGTERM → process-group kill) and AFTER exit run `pgrep -f "vite.*<qa-port>"` and `pgrep -f "chromium.*forge-art-qa"` (give the browser a unique `--user-data-dir` marker at launch so the pgrep is unambiguous) → both empty, else manifest error + exit 1 (FAL-QA-29).

---

## 3. Production isolation test design (`scripts/forge-art-prod-isolation.mjs`)

Runs after `npm run build` (and the tool's own `vite build --config vite.forge-art.config.ts --outDir dist-forge-art`). Four asserts, all pure fs/grep — no browser:

1. **Game bundle clean.** Walk `dist/` (all files, recursive): assert NO filename matches `/(forge|art-lab|baseline)/i`; assert NO content match of `/(forge[ _-]?art[ _-]?lab|art[ _-]?lab|baseline)/i` in any built `.js`/`.css`/`.html` (read file, regex, zero hits). This proves the tool never leaks into the shipped game — `deploy` (`wrangler pages deploy dist`) cannot publish workbench code.
2. **Tool build separate.** `dist-forge-art/` exists, non-empty, contains the tool's index.html + assets; and `dist-forge-art` is NOT inside `dist/` (so the deploy glob can't pick it up).
3. **Build script untouched.** Parse `package.json` scripts: `build` string is exactly the historical `"tsc --noEmit && vite build && node scripts/gen-desktop.mjs"` — `assert(!build.includes('forge'))`; also assert no `forge-art` reference exists in ANY `scripts.*` value except the new `test:forge-art`, `qa:forge-art`, `qa:forge-art-prod` entries. The tool must never have modified the game's build pipeline.
4. **No runtime coupling.** `grep -c` in `src/main.ts` for `forge` → 0 (the game binary never registers tool routes/handles; the tool page is a separate vite entry, `rollupOptions.input` pattern from `desktop.html`).

---

## 4. Process cleanup checklist (FAL-QA-29)

- **Server**: `spawn(vite, [...], {detached:true})`; stop = `process.kill(-child.pid, 'SIGTERM')` (negative pid = process GROUP — catches vite + esbuild + any child) with fallback `child.kill('SIGTERM')`; `Promise.race([once(child,'exit'), delay(4000)])`; escalate `SIGKILL` to the group (self-view pattern); `stdout/stderr.destroy()`.
- **Browser**: every page `page.close()` (try/catch each); `browser.close()` in finally; launch with unique `--user-data-dir=/tmp/forge-art-qa-<pid>` so `pgrep -f` verification is unambiguous; do NOT rely on playwright's own shutdown — verify with pgrep after exit.
- **Temp dirs**: `--out` forced outside the repo (resolveOut); tool-internal scratch (e.g. `os.tmpdir()/forge-art-<pid>`) removed in finally with `fs.rmSync(recursive, force)`. Evidence dir is intentionally KEPT (it is the deliverable, vs4 pattern).
- **Manifest-on-failure guarantee**: `finally` block writes `manifest.json` unconditionally (`ok:false`, `errors[]` populated from the catch) — a crashed run still leaves proof of what happened (vs4 lines 1075-1099).
- **HMR websocket trap**: a live vite HMR socket keeps the node event loop alive; never `process.exit(0)` before `stopServer` completes, and never rely on the page close to kill vite (detached process ignores it) — the SIGTERM group kill is the only reliable stop.

---

## 5. Determinism guards

1. **Fixed seeds everywhere**: tool `?seed=0x5eed` (vs4 precedent); `world.reset(seed>>>0)` (sim uses mulberry32+hash2 internally — deterministic); **override `Math.random = mulberry32(0xC0FFEE)` before `view.init(world)`** so stars/nebula are pixel-stable across runs (A4 risk 4 — `resetWorld` does NOT rebuild stars, so one init keeps all scenes consistent).
2. **Frozen tick**: stage fixtures then `world.tick = 600` (≥240 suppresses opening clash-flash, worker diamonds, HP bars — A4 risk 5) and `world.step = () => {}` (stageFixture lines 829-835). Why the freeze matters: with the sim live, positions/animations change between the rAF settle and the screenshot, so hash/pixel comparisons are non-deterministic; frozen, `px === x` makes the draw alpha inert and pose-damp static → byte-identical PNGs for the same seed (FAL-QA-18).
3. **Disabled animations before screenshots**: `?mesh=0` sprite path (zero wall-clock `frameDt` dependence — A4 risk 3; `mesh=1` only for human art review); `pause` state for capture; zero out `dissolveT/corpseT/hitFlash/anim`; `reducedMotion` respected; pause the A/B preview before proof screenshots.
4. **`settleFrames` double-rAF**: `requestAnimationFrame(() => requestAnimationFrame(resolve))` — guarantees one complete frame was SCHEDULED and then one was PRESENTED before the screenshot; a single rAF can capture mid-frame (tearing), zero rAF captures a stale canvas.
5. **No absolute frame budgets**: SwiftShader ~20fps means p99-frame assertions are meaningless; reuse the `measurePolicy` softwareGL branch — if `UNMASKED_RENDERER_WEBGL` matches `/swiftshader|llvmpipe|software/i`, gate the sim-share (`simStepMs × 5 < 8ms`) instead of render p99; log `mode:'sim-share (software GL)'` in the manifest (qa-vs4 lines 896-928).

---

## 6. Gaps / risks

1. **SwiftShader timing noise**: settleFrames + fixed tick make screenshots deterministic, but ANY waitForTimeout-based assertion on rendered progress is flaky at 20fps — drive state via probe values (`frame`, `selection.progress`) not elapsed time; keep NAV/PROBE timeouts at 30s; never assert "animation advanced" with a single 50ms wait (use 2 settleFrames + frame counter).
2. **Flaky font rendering in board composition**: `self-view-harness` board text (page.setContent + fullPage screenshot) depends on the host's font stack — glyph metrics differ across machines, so board PNGs must NEVER be hashed or pixel-gated; keep boards for human/critic review only. For the tool page itself, assert TEXT via DOM/probe (`innerText` scans), never via rendered pixels.
3. **HMR websocket keeping processes alive**: any script that starts vite must kill it explicitly (SIGTERM group, §4); tsx/vitest must run non-watch; if a future test spawns the dev server, the `once(child,'exit')` race + 4s timeout prevents a hang; verify with pgrep in CI.
4. **Playwright version pinning**: `package.json` has `^1.55.0`, installed 1.62.1 — caret allows silent minor upgrades that change launch flags/context semantics. Pin EXACT (`"playwright": "1.62.1"`) and record the verified combo (playwright 1.62.1 + `/usr/bin/chromium` executablePath). `channel:'chrome'` fails on this box — keep the fallback chain but order it chromium-first for the forge-art script: `[{executablePath:'/usr/bin/chromium'}, {channel:'chrome'}, {}]`, each attempt with `--disable-background-timer-throttling --disable-renderer-backgrounding`.
5. **npm install fragility**: if postinstall scripts were blocked, esbuild's binary is missing and vite fails with a cryptic error — `npm rebuild esbuild` first; the QA script should fail with a hint, not a stack trace.
6. **Evidence staleness window**: mtime-based staleness (FAL-QA-24) is clock-skew-sensitive — compare `evidenceBuiltAt` against `toolVersion` string too; document that git-touch timestamps (checkout sets all mtimes) will legitimately trigger refusal until a fresh accept run.
7. **Context budget**: N browser pages = N WebGL contexts under SwiftShader; keep ≤2 live pages at once (vs4 keeps 3; fine), close pages as soon as each step block finishes; one-live-context assertion (step 19) doubles as the canary for context leaks across HMR reloads.

---

## Cross-audit consistency

- Metric algorithms/thresholds: delegate to the A2 `tools/forge-art/src/metrics.ts` library after calibration; pure tests keep their own copies (A2 §3 duplication doctrine — gates must fail independently of the library).
- Renderer integration: use A4's stage()/fixture recipes, disposal checklist (`renderer.dispose(); forceContextLoss(); domElement.remove()`, A4 §5), `?mesh=0&combat=1` URL flags, camera presets (close 5 / normal 14 / strategic 32), fog staging via `fogOfWarEnabled=false`.
- Vocabulary: every assertion string in tests/QA uses canonical labels (`sunweaver`, `gravemark`, Lumen Guard…) — the QA suite itself must not reintroduce banned terms in failure messages; banned-list scan includes the tool's own DOM and probe JSON (FAL-QA-02).
