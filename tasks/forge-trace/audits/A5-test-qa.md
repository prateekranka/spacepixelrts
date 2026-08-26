# A5 — Forge Trace: Test & QA Strategy (strict RED-GREEN-REFACTOR)

Feature: Starhaven Forge Trace (deterministic record/replay + divergence diagnostics). No forge-trace
source exists yet; this spec defines the harness that gates it. All conventions below are lifted from
live repo files, not invented.

## Frozen conventions (from existing repo)

- **Node unit tests**: plain `tsx tests/<file>.test.ts`, top-level code, `node:assert/strict`,
  `console.log('<name> tests: PASS')` on success, `throw` or `process.exitCode = 1` on failure
  (see tests/vs5-pacing.test.ts, tests/vs2-ai-doctrine.test.ts). No vitest/jest. npm scripts chain
  `tsx tests/<file>.test.ts`.
- **Browser QA**: `scripts/qa-*.mjs`, playwright chromium + repo-local node_modules. Lifecycle from
  scripts/qa-vs5-pacing.mjs: `findOpenPort` → `startServer` (vite `--host 127.0.0.1 --port N
  --strictPort`, detached) → `launchBrowser` (channel `'chrome'`, fallback executablePath
  `/usr/bin/chromium`) → `analyzePng` (pngjs: maxLuma>6 && litRatio>=0.002) → manifest.json written
  to `--out` dir outside repo → `finally`: `browser.close()` + `stopServer` (process.kill(-pid),
  4s timeout fallback); `process.exitCode = 1` on failure.
- **Sim constants**: DT, SIM_HZ=20, SEED=0x5eed, `World.reset(SEED)`, `world.step()`; 18:00 run =
  21600 ticks. Legal world mutations ONLY via `tryPlace`/`tryTrain`/`tryCommitPath`/`issue`/`step`.
- **Canonical IDs** (docs/CANONICAL_VOCABULARY.md): factions `sunweaver`/`gravemark`, map
  `helios-rift`, paths `solar-ascendancy`/`sky-dominion`/`iron-colossus`/`rift-engineering`.
  Legacy `vespari`/`aurion`/`voidmarked` are private adapters and MUST NOT appear in serialized output.
- **RED-phase proof** (repo convention, see tasks/VS5-red.log, tasks/M6A-red.log): before any
  production edit, run the failing tests and save `tasks/<TASK>-red.log` containing: title line
  "X RED — before any production edit", the exact command, `exit_code=1`, and the failure excerpt.
  For a brand-new subsystem, module-not-found RED is acceptable proof.

## RED-phase proof for forge-trace

1. Write ALL tests below first (they import `../src/forge-trace` which does not exist).
2. Run `npm run test:forge-trace`, `npm run test:forge-trace-dist`, `npm run qa:forge-trace`; tee
   the failing output (exit_code=1 each) to `tasks/forge-trace/forge-trace-red.log`.
3. GREEN: implement until every file prints its PASS line and QA manifests report ok=true.
4. REFACTOR: restructure freely; re-run the identical suite — green must hold unchanged.

## Pure Node tests — tests/forge-trace-*.test.ts (chained by `test:forge-trace`)

1. **tests/forge-trace-schema.test.ts** — schema accept/reject.
   Arrange: 1 valid + 6 malformed trace JSON fixtures (bad version, unknown event type, seq
   duplicate, seq gap, negative tick, bad faction id). Act: `validateTrace()`. Assert: valid
   accepts; each malformed rejects with a named reason; partial objects never throw.
2. **tests/forge-trace-ids.test.ts** — canonical IDs only.
   Arrange: record a full seeded match. Act: serialize trace; scan every id field + raw JSON.
   Assert: only sunweaver/gravemark/helios-rift and the 4 path ids occur; `/vespari|aurion|
   voidmarked/` matches nothing anywhere in serialized output.
3. **tests/forge-trace-determinism.test.ts** — repeat equality.
   Arrange: two World runs, same SEED + same policy script. Act: normalize event streams (strip
   wall-clock timestamps, canonical-sort unordered collections) and compute checkpoint hashes; run
   twice. Assert: normalized streams deep-equal and checkpoint hash chains identical across runs.
4. **tests/forge-trace-world-hash.test.ts** — hash sensitivity + stable ordering.
   Arrange: base state snapshot, a perturbed copy (one ore value changed), and a reordered copy
   (insertion order shuffled). Act: hash all three. Assert: perturbed hash != base; reordered
   hash == base (ordering-stable digest over sorted keys).
5. **tests/forge-trace-ordering.test.ts** — event ordering.
   Arrange: record an 18-min scripted match. Act: walk `trace.events`. Assert: `seq` strictly
   increasing with no gaps; `tick` nondecreasing; each checkpoint's last event seq equals the
   checkpoint's recorded seq.
6. **tests/forge-trace-cadence.test.ts** — sample cadence.
   Arrange: 120s run (2400 ticks). Act: filter economy/population sample events. Assert: exactly
   one economy AND one population sample per simulated second (120 each), tick deltas exactly
   SIM_HZ.
7. **tests/forge-trace-size.test.ts** — bounded size.
   Arrange: full 18-min (21600-tick) recording. Act: count entity snapshot payloads; stat
   trace.json. Assert: entity snapshots appear only in checkpoints/events, never per-tick
   (payload count << 21600); trace.json < 8MB.
8. **tests/forge-trace-policy.test.ts** — legal-policy operations only.
   Arrange: World wrapped in a mutation trap counting direct writes. Act: scripted match through
   public API. Assert: every mutation occurred inside tryPlace/tryTrain/tryCommitPath/issue/step;
   zero direct field writes outside them.
9. **tests/forge-trace-faults.test.ts** — fault injection gating.
   Arrange: scenario A requests a kill; scenario B does not. Act: record both. Assert:
   fault-injection event present iff requested (A yes, B absent); no fault marker when disabled.
10. **tests/forge-trace-classification.test.ts** — failure classification units.
    Arrange: synthetic end-states — crash mid-tick, recorder exception, deadline miss, starvation,
    idle production, hidden target. Act: `classify()`. Assert: game-failure vs tool-failure split
    correct; deadline/starvation/idle-production/hidden-target each map to its own unit, no overlap.
11. **tests/forge-trace-divergence.test.ts** — first divergence.
    Arrange: two synthetic traces identical until event N, then divergent. Act: `firstDivergence()`.
    Assert: returns N (index + seq); identical traces return null; divergent checkpoint hashes
    point at the same N.
12. **tests/forge-trace-frames.test.ts** — frame-reference construction completeness.
    Arrange: trace with 3 checkpoints + N events. Act: build frame references (event tick →
    checkpoint anchor + delta). Assert: every event maps to exactly one frame; anchors cover all
    events; deltas reconstruct exact payloads.
13. **tests/forge-trace-dist.test.ts** — no production-bundle leakage.
    Arrange: `npm run build` first (`test:forge-trace-dist` = `build && tsx`). Act: grep dist/
    assets for trace-tooling markers ('forge-trace', 'trace.json', 'checkpoint', replay UI labels,
    `__STARHOLD_TRACE__`). Assert: zero matches — trace tooling lives only in dev/QA entry.

## Browser QA — scripts/qa-forge-trace-*.mjs (vite + chromium lifecycle as frozen)

14. **scripts/qa-forge-trace-ui.mjs** — malformed/partial trace UI (DOM checks).
    Arrange: startServer; inject truncated/corrupt trace into the trace store via page globals.
    Act: open trace view; DOM-query #trace-view/#trace-error. Assert: error banner shown, no blank
    view, zero console errors, loading a valid trace recovers; capture + analyzePng non-black.
15. **scripts/qa-forge-trace-cleanup.mjs** — process cleanup.
    Arrange: run full QA suite in-process (server + chromium). Act: `finally` stopServer +
    browser.close, then scan the process table. Assert: no vite --strictPort child or chromium
    process from our pid-group remains; manifest ok=true.

## Browser vs pure Node

- Browser: #14 (DOM checks), #15 (chromium lifecycle). Everything else pure Node (tsx, no playwright).
- Browser QA needs `node_modules` present (playwright, pngjs, vite) — never npx-downloaded.

## npm wiring (implementation commit)

- `"test:forge-trace"`: tsx tests/forge-trace-{schema,ids,determinism,world-hash,ordering,cadence,
  size,policy,faults,classification,divergence,frames}.test.ts (chained with `&&`)
- `"test:forge-trace-dist"`: `npm run build && tsx tests/forge-trace-dist.test.ts`
- `"qa:forge-trace"`: `node scripts/qa-forge-trace-ui.mjs && node scripts/qa-forge-trace-cleanup.mjs`

## Gate order (strict)

RED log saved (tasks/forge-trace/forge-trace-red.log) → implement → all 13 test files PASS +
dist-leakage PASS + both QA manifests ok=true → REFACTOR → identical suite re-run, green holds.
