# SPX-20 Composer Builder brief

You are the sole code writer for Kanban card `t_255339ba`. Work only in this repository root on branch `kanban/spx-20-forge-review`.

## Read first

Read, in order:

1. `DIRECTIVE.md`
2. `ORCHESTRATOR_BRIEF.md`
3. `docs/ISO_REWRITE_PLAN.md`
4. `PROGRESS.md`
5. `docs/CANONICAL_VOCABULARY.md`
6. `docs/FIRST_PLAYABLE.md`
7. `docs/VERTICAL_SLICE_SPRINT.md`
8. `docs/SPX20_FORGE_REVIEW_INTEGRATION.md`
9. source `docs/FORGE_REVIEW_DECK.md` from commit `13c3db564e97d3939901bd6ce07f317953d68b07`

The integration contract is binding. Do not redesign it.

## Exact baseline and sources

- Parent HEAD must be an SPX-20 spec commit descended from accepted product SHA `6c121a99cdec6700945fa0c01fc9f98137bdab7d`.
- Historical source base: `ced0b94480978866d368180efa078448b3ca2550`.
- Port only these functional commits, in order:
  1. `13c3db564e97d3939901bd6ce07f317953d68b07`
  2. `66f7dbbed9174da86ebbea542426d5c195964e9c`
  3. `6014e595ec9d1f210af3a278585755286c280136`
- Do not port `e1751e25c49d81e763383c1a6dbb23868ecde2d3`; it is stale `PROGRESS.md` only.

Use `git cherry-pick -n <sha>` one commit at a time. Resolve and commit each functional layer before the next. Every commit message must start with `SPX-20:`. Preserve the repository Git identity. Add no attribution trailers.

## Scope

Own only the paths listed in `docs/SPX20_FORGE_REVIEW_INTEGRATION.md`. Do not edit `PROGRESS.md`; the lead updates it after final acceptance. Do not push, deploy, merge to `chatgptpro2008`, or modify another worktree.

`src/sim.ts` and `src/engine.ts` must stay byte-identical. No gameplay, AI, economy, combat, pacing, save/profile, app-state, HUD, Pixel UI, accepted art, or player-input behavior may change.

## Required integration decisions

### Main entry and production isolation

Preserve the accepted Pixel loading segments, Forge Art candidate seam, AppFlow, and renderer options.

Do not use the source commit's static imports of `src/dev/review-control.ts` or `src/dev/review-overlays.ts`. Forge Review must install only when both conditions are true:

- `import.meta.env.DEV`
- query value is exactly `forge=1`

Use a runtime-variable `/* @vite-ignore */` dynamic import inside that guard. No Forge Review dev module, string, global, page, control, rAF sampler, listener, or hook may survive in the production import graph or `dist/` content. Keep all module top-level side effects behind the development import boundary.

A Forge QA route starts frozen. Freeze stops rAF world advance. Unfreeze resumes it. Bounded stepping is accepted only while frozen and advances the ordinary fixed-step path exactly.

### Renderer

Start from current `src/render.ts`, including `GameRendererOptions.combatRowOverrides`. Add only:

- an empty-by-default post-overlay hook seam;
- a display-only review mode setter;
- player/rival/omniscient fog texture selection that reads `world.visible[]` and `world.explored[]` without writing World;
- guarded hook execution after the normal overlay.

Do not replace the current renderer with the source version. Do not change accepted atlas generation, combat rows, draw order, normal fog, normal overlays, or renderer lifecycle.

### Control correctness

Port the frozen interface in `docs/FORGE_REVIEW_DECK.md`, then close source defects where the current product exposes them:

- `setRoute`, `setOrientation`, `setFactions`, and `setSeed` must make legal reload-bearing changes and read back the requested canonical configuration. A control must not be a false UI.
- `requestedSeed` and `actualSeed` must match after a valid seed change.
- Perspectives, camera, game-UI visibility, review fog, selection, and overlays are display/input-review state only. Add a browser assertion that they leave tick, resources, knowledge/discovery arrays, orders/targets, winner, and authoritative entity state unchanged.
- Freeze must hold across real time. `step(37)` must yield an exact +37 tick delta. Unfreeze must resume normal advance.
- Repeat the same fresh seed/route/freeze/step sequence and compare a stable authoritative identity readback.
- Move the rAF sampler inside the installed dev control. Warm up longer than its 120-sample ring before reporting p99.

### Capture and visual evidence

Keep one browser/context and serial pages. Use Playwright composited `page.screenshot()` only. Reuse one loaded page for compatible extras.

The final capture plan must include:

- 13 routes × both landscape orientations;
- one synchronized player/rival/omniscient triptych at a single frozen tick;
- UI-free, selected-scout, tactical-close, and strategic-far extras;
- visible/read-back evidence for all six overlays, with focused overlay PNGs available to a critic;
- `board.png`, `manifest.json`, `console.txt`, `critic-brief.txt`, and `proof.webm`.

Every PNG is 1366x1024, nonblack, nonempty, and records full identity. All console/page error arrays must be empty. The board must red-label a missing/failed cell instead of crashing. The critic brief lists facts and questions, never a Builder verdict.

Keep `gameWorkP99Ms` and `rafP99Ms` as separate sources. Record the WebGL renderer from a fresh offscreen context and classify software rendering truthfully. Do not apply an 8 ms hardware budget on SwiftShader unless the CLI explicitly requests `--gate-p99`.

### Linux browser/process facts

This host uses `/usr/bin/chromium`. Playwright's default `--disable-dev-shm-usage` causes Chromium 151 SIGTRAP here. Every new launch attempt must set:

`ignoreDefaultArgs: ['--disable-dev-shm-usage']`

Retain serial execution and guaranteed process-group cleanup. Do not leave Vite, Chromium, ffmpeg, or helper processes. Clip recording may need `TMPDIR` on `/home` when `/tmp` is full; do not hard-code a private path.

### Production isolation tests

Strengthen the source test. It must inspect built content, not only Vite input names. After `npm run build`, fail if `dist/` includes a tools directory, Forge chunk/page, or the strings/paths:

- `forge-review`
- `__STARHAVEN_FORGE__`
- `FORGE REVIEW`
- `src/dev/review`

Also verify a production page opened with `?forge=1` has no Forge global or panel.

## Focused verification before handoff

Run at least:

1. `npx tsx tests/forge-review.test.ts`
2. `npm run build`
3. `npm run qa:forge-review -- --out=/home/bobbyranka/workspace/evidence/starhaven-kanban/t_255339ba/20/builder-qa`
4. `git diff 6c121a99cdec6700945fa0c01fc9f98137bdab7d -- src/sim.ts src/engine.ts`
5. `git diff --check`

If an affected gate fails, fix it and rerun only the affected lane. The lead will run the complete acceptance matrix and full proof capture once on your accepted candidate.

## Handoff

Leave a clean working tree. Your final response must state:

- commit SHAs and messages;
- changed paths;
- commands and exit codes;
- protected-file result;
- production-isolation result;
- any exact remaining blocker.

Never call your own visual review a critic pass. Stop and report if a protected file must change, production isolation cannot be proved, deterministic stepping fails, or the proof/QA path cannot clean up its processes.
