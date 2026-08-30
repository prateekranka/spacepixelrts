# SPX-20 Forge Review Deck integration

Status: **LOCKED INTEGRATION CONTRACT**
Card: `t_255339ba`
Integration branch: `kanban/spx-20-forge-review`
Accepted parent: `6c121a99cdec6700945fa0c01fc9f98137bdab7d`
Target after acceptance: `origin/chatgptpro2008`

## Goal

Port Forge Review Deck v1 onto the accepted Pixel UI product baseline. The result is a developer-only review workbench and serial proof-pack generator. It must reproduce the real game, inspect it without changing authoritative gameplay truth, and leave the production build unchanged.

The review surface has four jobs:

1. Identity and reproduction: route, requested and actual seed, orientation, factions, state, tick, and full match configuration.
2. View inspection: player, rival-knowledge, and omniscient perspectives; normal, tactical-close, and strategic-far cameras; game-UI and review-fog visibility.
3. Deterministic playback: selection, freeze, bounded step, and exact tick/entity readback.
4. Spatial diagnosis and evidence: paths, hit regions, line of sight, orders, facing, entity IDs, identity snapshots, composited PNGs, a board, and a short clip.

Forge Review is a developer workbench. It is not a player menu or a replacement for the gameplay HUD.

## Sources and order

Port only these functional commits, in this order:

1. `13c3db564e97d3939901bd6ce07f317953d68b07` — capture backend and contract.
2. `66f7dbbed9174da86ebbea542426d5c195964e9c` — interactive workbench and read-only render seams.
3. `6014e595ec9d1f210af3a278585755286c280136` — focused verification and browser QA.

Source head `e1751e25c49d81e763383c1a6dbb23868ecde2d3` adds only stale `PROGRESS.md` history. Do not port that commit or replace current progress history.

Historical merge base: `ced0b94480978866d368180efa078448b3ca2550`.

## Owned paths

The integration may add or modify only these product paths, plus this contract and its Builder brief:

- `docs/FORGE_REVIEW_DECK.md`
- `docs/SPX20_FORGE_REVIEW_INTEGRATION.md`
- `package.json`
- `scripts/forge-capture.mjs`
- `scripts/qa-forge-review.mjs`
- `src/dev/review-control.ts`
- `src/dev/review-overlays.ts`
- `src/main.ts`
- `src/qa-scenarios.ts`
- `src/render.ts`
- `tests/forge-review.test.ts`
- `tools/forge-review/**`
- `tsconfig.forge.json`
- `tasks/SPX20-builder.md`
- `PROGRESS.md`, only after final lead acceptance

No other gameplay, UI, art, asset, test, or build path is owned by this integration.

## Non-goals

- No change to simulation rules, AI doctrine, economy, combat, pacing, winners, orders, save/profile data, map generation, assets, or player controls.
- No responsive-HUD repair. The known 1024x768 compatibility defects are a separate P1 card.
- No Forge Trace, Forge Art Lab change, Map Lab, MCP wrapper, new route, unit, faction, or map.
- No Cloudflare deployment.
- No performance claim from the multi-pane workbench or this host's SwiftShader rAF spacing.

## Protected baseline

These parent facts are immutable except for the explicitly allowed minimal `src/render.ts` read-only seam:

| Path | Accepted SHA-256 |
| --- | --- |
| `src/sim.ts` | `fb0f3d7b3e8d8a1ef97afebb7c23b3a7ad4e9bb04dc5ff6ac98437be6694dd0a` |
| `src/engine.ts` | `182830c08fb36041da67254890ba640c7fc50c251cb720bac27fd0174795c8e8` |
| `src/render.ts` parent | `40799d7d76941b69ae437d69312c8bd599f2e963fa5c951df5a5350903299122` |
| `src/front-end-scene.ts` | `270e4eaf7c3feaf84de40eead31fd64e324aaa7a9e00263952efeaa75e17a32b` |
| `src/generated/sunweaver-lumen-guard-accepted.ts` | `2836566bb2696fe004acc1e164d657f35d6909ef74ef3e6366dd30dab29388d5` |
| `public/front-end/civilizations/**` listing | `dc1303c179e7041926f9c13e0d180cca9753e78fa5a2b4343897ae6074e8cd66` |

`src/sim.ts` and `src/engine.ts` must have zero changed bytes and zero changed lines against the parent. Pixel UI, AppFlow, accepted Lumen Guard override behavior, authored front-end art, and normal gameplay must remain unchanged.

## Conflict policy

### `package.json`

Keep the accepted product and Pixel script set. Add only `forge:review`, `forge:review:capture`, and `qa:forge-review`. Do not remove or rename an existing script or dependency.

### `src/main.ts`

Use the accepted parent as the base. Preserve loading segments, legal AppFlow transitions, same-page replay, player-profile behavior, and the optional `forge-art-candidate` combat-row seam.

Add only:

- a synchronous `import.meta.env.DEV && forge=1` request guard;
- a review freeze gate around rAF-driven simulation advance;
- an asynchronously installed control and overlay hook;
- a runtime-variable `/* @vite-ignore */` dynamic import that Vite cannot trace into production.

Do not statically import any Forge Review module into the production entry graph. `forge` without value `1` is disabled. Review routes start frozen, can unfreeze cleanly, and can step only while explicitly frozen.

### `src/render.ts`

Use the accepted renderer as the base. Preserve `GameRendererOptions.combatRowOverrides`, accepted atlas assembly, combat mapping, draw order, fog defaults, draw counts, and all product rendering.

The only permitted additions are:

- an empty-by-default post-overlay hook list;
- a display-only review mode setter;
- a fog-texture fill branch that reads player or rival visibility/exploration arrays, or writes a clear display texture for omniscient mode;
- guarded hook execution after normal overlay drawing.

These additions may write only renderer-owned texture/canvas state. They may not write `World`, discovery latches, AI knowledge, entity fields, orders, resources, targets, or winners.

### `src/qa-scenarios.ts`

Add strict unsigned 32-bit `qa-seed` parsing. A valid value clones the selected scenario config with deterministic seed mode. Missing or invalid values preserve the accepted scenario unchanged. Any faction override used by Forge must use canonical IDs and clone configuration; it must not leak legacy labels to the workbench.

### `PROGRESS.md`

Current target wins. Do not port source progress. Append only facts that the lead has re-run and accepted.

## Runtime invariants

- One live WebGL game canvas exists in each tool surface. Comparison panes are frozen composited images.
- All screenshots use Playwright `page.screenshot()`. Default-framebuffer readback is not evidence.
- Route and AppFlow changes use existing legal events.
- Perspective, camera, UI visibility, review fog, selection, and overlays are display/input-review state only.
- Display-only operations leave tick, resources, knowledge/discovery bytes, orders, targets, winner, and authoritative entities unchanged.
- Freeze stops rAF-driven world advance. Unfreeze resumes it. `step(n)` is accepted only while frozen, clamps to the documented bound, calls the ordinary fixed-step path, and advances by exactly `n` ticks.
- Two fresh runs of the same route, seed, and bounded step sequence must produce the same authoritative identity readback.
- `requestedSeed === actualSeed` is a hard gate for every relevant cell.
- `gameWorkP99Ms` measures in-frame game work. `rafP99Ms` measures compositor spacing. They remain separate. Warmup must exceed the 120-frame ring. Absolute p99 gating is opt-in because this host uses SwiftShader.
- Browser launches on this Linux host must ignore Playwright's default `--disable-dev-shm-usage` argument, which causes Chromium 151 SIGTRAP here.

## Production isolation

A production build must satisfy all of these:

- Vite production inputs remain only the accepted game, desktop, and town-center pages.
- `index.html` and `desktop.html` do not reference Forge Review.
- `dist/` has no `tools/` or Forge page/chunk.
- Production HTML, JS, CSS, and source maps contain no `forge-review`, `__STARHAVEN_FORGE__`, `FORGE REVIEW`, workbench controls, or `src/dev/review` module path.
- Loading a production page with `?forge=1` does not install a global, panel, hook, or sampler and does not change game behavior.

The isolation test must inspect contents, not only file names or Vite input names.

## Proof-pack contract

The final run uses seed `424242` and produces, under one absolute external `proof/` directory:

- all 13 canonical QA routes in both landscape orientations;
- synchronized player, rival-knowledge, and omniscient frames from one frozen route/tick;
- UI-free, selected-scout, tactical-close, and strategic-far frames;
- readback and visible evidence for each overlay: paths, hit regions, line of sight, orders, facing, and entity IDs;
- `board.png`, `manifest.json`, `console.txt`, `critic-brief.txt`, and `proof.webm`;
- exact 1366x1024 PNG dimensions, nonblack/nonempty pixels, full seed/config/state/tick/camera/selection/perf/draw/entity identity, truthful renderer classification, and empty error arrays.

The clip must show a real control sequence: deterministic load, freeze, bounded step, perspective or camera change, overlay toggle, and resulting readback. The contact board must preserve and red-label failed cells instead of crashing.

## Acceptance gates

Lead-owned final commands:

1. `npm run test:m0`
2. `npx tsx tests/forge-review.test.ts`
3. `npm run build`
4. `npm run qa:forge-review`
5. `npm run forge:review:capture -- --out=<absolute-run-root>/proof --seed=424242 --clip`
6. protected-hash and zero-diff audit
7. production input, import-graph, and `dist/` content audit
8. manifest and image audit for routes, orientations, synchronized perspectives, extras, overlays, seed/state equality, dimensions, pixels, errors, metrics, renderer truth, and process cleanup
9. fresh Grok 4.6 XHigh visual review of `board.png`, focused perspective/overlay frames, and contact frames from `proof.webm`

A failed visual round names one biggest visible gap. Only that affected lane is repaired and rerun before the full final acceptance matrix.

## Landing and rollback

Before acceptance, all work stays on `kanban/spx-20-forge-review`. After every gate and the fresh critic pass, push this branch, fast-forward `origin/chatgptpro2008` without force, then fast-forward the canonical product worktree and verify the exact remote SHA. Production Cloudflare Pages remains unchanged.

Before landing, rollback is branch reset or deletion to parent `6c121a99cdec6700945fa0c01fc9f98137bdab7d`. After landing, rollback is a normal `git revert` of the SPX-20 commits. Never rewrite shared history. A rollback removes the dev-only modules, scripts, and minimal seams while preserving the accepted Pixel/product parent.
