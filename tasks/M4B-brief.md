# M4-B Builder Brief — HUD choice UI + guidance sweep

You are implementing M4-B of spacepixelrts. M4-A (sim core) is already merged on
this branch. Read FIRST, in order:
1. docs/M4_TECH_PATHS.md  (contract; decisions locked — esp. decision 7 language ban)
2. src/content.ts  sections for TECH_PATHS, PATH_EFFECTS, isPathGated
3. src/sim.ts      methods tryCommitPath, techPathOf, pathChannelT
4. src/hud.ts      (full file — you are rewriting the Hall panel section)
5. src/opening-guidance.ts
6. scripts/qa-m3-economies.mjs  (QA script pattern to copy)

## Scope — touch ONLY these files
- src/hud.ts
- src/opening-guidance.ts
- scripts/qa-m4.mjs          (new)
- package.json               (add "qa:m4": "node scripts/qa-m4.mjs")
Also allowed: DELETE now-dead legacy adapters if nothing references them after
your rewrite — the old `ageup` HUD button path, and content/sim exports that
become unreferenced (`tryAgeUp`, `EPOCH_NAME`, `minTrainEpoch`) — but verify with
grep before each deletion and keep `npm run build` green.

Do NOT touch src/sim.ts game logic beyond deleting dead exports, render,
terrain, art, tests/m4-tech-paths.test.ts.

## Definition of done
1. Hall panel, team 0:
   - techPath null: TWO buttons (one per faction path from pathsForCiv) — label =
     path name, sub = one-line effect summary + '400 ore · 80 chg'. Click issues
     `world.tryCommitPath(0, id)`; disabled when unaffordable or Hall busy.
   - Channel active (pathChannelT>0): both buttons disabled, sub shows
     `${Math.ceil(pathChannelT)}s`; no epoch/age words anywhere.
   - Committed: single locked readout button (disabled) with the path name.
2. No player-visible string contains: epoch, age up, Spark, Orbit, Apex
   ("Sky Dominion" proper noun is fine). Check every template literal you touch.
3. opening-guidance: add one nudge when eco.ore >= 400 && techPathOf(0)===null &&
   ageT===0, text points at choosing a technology path at the Nexus; suppressed
   once committed or channel starts.
4. scripts/qa-m4.mjs headless proof (copy qa-m3-economies.mjs structure):
   - boots the app (vite preview or dev server), plays a scripted opening fast,
   - grants resources via the established QA hooks (see how m3 QA does it),
   - clicks the Solar Ascendancy button, asserts channel countdown appears,
   - fast-forwards/asserts committed locked readout,
   - asserts gated Yard buttons enable only post-commit (or stay disabled before),
   - greps ALL rendered HUD text for banned words — zero hits required,
   - captures screenshots to evidence dir /home/bobbyranka/workspace/evidence/starhaven-m4-tech-paths/,
   - exits 0 only if all checks pass, prints PASS line.
5. npm run build clean. npm run test:m4 still passes (sim untouched).

## Verify before finishing (run all, paste tails)
npm run build
npm run test:m4
npm run qa:m4        <- must print PASS

Commit nothing; leave tree dirty for review.

Report: files changed, verification tails, screenshots written, deviations.
