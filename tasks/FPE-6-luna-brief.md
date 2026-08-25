# FPE-6 Luna Integrator Brief — Final QA, Evidence, and Delivery Commit

You are the fresh final implementation/integration worker. Work only in `/home/bobbyranka/workspace/spacepixelrts-pixel-ui-shell` on branch `hermes/starhaven-pixel-ui-shell` at or after `edde763`.

Read first:

1. `DIRECTIVE.md`
2. `docs/FIRST_PLAYABLE.md`
3. `docs/PIXEL_FRONT_END_SYSTEM.md`
4. `.hermes/plans/2026-08-25_021126-starhaven-pixel-front-end-coherence.md` if present; otherwise use the tracked FPE briefs
5. `tasks/FPE-0-baseline.md`
6. `tasks/FPE-1-luna-brief.md` through `tasks/FPE-5-luna-brief.md`
7. `PROGRESS.md`
8. `package.json`
9. `scripts/measure.mjs`
10. `scripts/qa-pixel-front-end.mjs`
11. all relevant front-end tests and QA scripts

The lead has already verified and pushed FPE-0 through FPE-5. Fresh blind critics pass Main Menu, setup, panels after the compact empty-state repair, loading, and the smallest viewport. You are the final integrator. Inspect the actual build and fix only proven front-end integration defects. Do not modify protected gameplay or authored scene assets.

## A. Full protected test and whole-flow integration gate

Run these sequentially. Do not mask exit codes or pipe output through truncation tools.

```text
npm run test:m0
npm run test:aaa
npm run test:pixel-front-end
npm run test:m2
npm run test:m2-ai
npm run test:m3
npm run test:m4
npm run test:m5
npm run test:vs2-ai
npm run test:vs2b
npm run test:vs3
npm run test:vs4
npm run test:vs5
npm run build
npm run qa:pixel-front-end -- --out /home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/final/pixel-front-end
npm run qa:aaa
npm run qa:m1 -- --out /home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/final/m1-flow
npm run qa:touch-contract
npm run qa:progression-handoff
npm run qa:vs3
npm run qa:vs5
```

Also run `qa:front-end` against the built preview with durable output at `/home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/final/front-end-regression`.

Use the established software-GL rule. Hardware GL gates live game-work p99 below 8 ms. SwiftShader/llvmpipe records render p99 and gates deterministic max-five-step sim share below 8 ms. Do not weaken hardware gating.

Run one focused 5–10 minute integrator browser session across the actual sequence:

- Main Menu
- every utility panel
- Tutorial / Factions / Settings
- Match Setup with Gravemark then Sunweaver
- deterministic seed
- Loading
- Playing
- terminal/results flow through the existing fast deterministic QA route
- return to Results/Main Menu path

Use existing QA hooks only to accelerate honest simulation. Do not change state or award a pass through fabricated data. Record console/page errors and exact action results in the QA manifest.

## B. Objective measurement

1. Make `scripts/measure.mjs` robust on this Linux environment only if required:
   - keep Chrome channel first, add Playwright Chromium fallback;
   - record unmasked WebGL renderer and `softwareGl`;
   - record rAF timing, the game’s published work p99 where available, palette metrics, and console issues;
   - do not weaken any product gate.
2. Run it against a built preview for the final Playing/opening route and save:
   - `/home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/final/measure.json`
   - `/home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/final/measure.png`
3. Record the result truthfully in the QA manifest.

## C. Final screenshot and video evidence

Create a deterministic Playwright capture script if none exists: `scripts/capture-front-end-interaction.mjs` plus package script `qa:front-end-video`.

The script must:

1. Build/run the real app in a browser at 1366 × 768 or 1366 × 1024.
2. Start on the authored Sunweaver Main Menu.
3. Show tooltips and interact with the four real utility buttons in order:
   - Records
   - Match History
   - Tech Codex
   - Dispatches
4. Hold each panel long enough to read, close through the real Close button, and show focus restoration.
5. Open Factions, select Gravemark, close, and show the real authored scene switch.
6. Use Playwright recording. Produce a WebM, then use installed `ffmpeg` to create H.264 MP4 with `yuv420p` and `+faststart`. No audio is required.
7. Save the final MP4 to:
   `docs/qa/starhaven-pixel-ui-shell/utility-panel-interaction.mp4`
8. Verify the file with `ffprobe`: duration, dimensions, codec, and nonzero size.

Create `docs/qa/starhaven-pixel-ui-shell/` and copy these exact final artifacts from actual evidence captures:

- `before-sunweaver-menu.png` from the recorded FPE-0 baseline
- `after-sunweaver-menu.png` from final QA at 1366 × 1024
- `before-gravemark-menu.png` from the recorded FPE-0 baseline
- `after-gravemark-menu.png` from final QA at 1366 × 1024
- `after-sunweaver-loading.png` from final QA at 1366 × 1024
- `after-gravemark-loading.png` from final QA at 1366 × 1024
- `utility-panel-interaction.mp4`

Do not fabricate or recreate the before frames. Use `/home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/baseline/`.

## D. Final QA manifest and documentation

Create:

- `docs/qa/starhaven-pixel-ui-shell/QA_MANIFEST.md`
- `docs/qa/starhaven-pixel-ui-shell/qa-manifest.json`

Include exact:

- source/base/art branch reconciliation
- final commit parent before this evidence commit
- protected hashes
- distinct scene manifest hashes and asset counts
- every test/QA command and PASS/FAIL result
- both orientations and all four viewports
- mouse/keyboard/touch/focus/Escape/Reduced Motion result
- Dispatches persistence result
- loading stage/reset/config result
- Results/return path result
- console/page/request errors
- software/hardware renderer and performance gate used
- palette metrics
- final built JS/CSS/font/icon/scene asset sizes
- PR-base asset/bundle impact against `origin/chatgptpro2008`
- honest limitations
- paths and hashes for all six screenshots and the MP4

Update `PROGRESS.md` with a concise final FPE-6 section. Do not claim deployment or PR creation; the lead performs and verifies those after your commit.

## E. Final static truth and commit

Before commit:

1. Verify `src/sim.ts`, `src/engine.ts`, `src/render.ts`, `src/front-end-scene.ts`, and every authored civilization asset remain byte-identical to baseline commit `645b0ec` where required.
2. Verify no hue rotation or procedural production scene path is active.
3. Verify no banned front-end style/font/Unicode icon remains.
4. Run `git diff --check`.
5. Review all generated evidence files and their hashes.
6. Keep the worktree free of logs, temporary WebM, preview PIDs, and untracked output.

Commit only the final integrator/evidence changes with:

`FPE-6: add final pixel front-end QA evidence`

Do not push. Do not deploy. Do not open the PR. Leave no background process running.

## Hard boundaries

- Do not modify gameplay/simulation/render/compositor logic or civilization assets.
- Do not redesign the accepted shell after all blind gates passed unless a real final integration test proves a defect.
- Do not fake test output, metrics, screenshots, video, or hashes.
- Do not commit giant temporary browser profiles, WebM files, logs, `dist/`, or node modules.

## Definition of done

Every protected test and actual browser gate passes; one honest results/return flow is exercised; final performance and palette evidence exists; six real screenshots and one verified MP4 are committed; QA manifests are complete and truthful; protected hashes are unchanged; the worktree is clean after the FPE-6 commit; and no process leaks remain.
