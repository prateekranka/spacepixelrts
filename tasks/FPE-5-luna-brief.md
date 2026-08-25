# FPE-5 Luna Builder Brief — Responsive, Orientation, and Motion Polish

You are the implementation worker. Work only in `/home/bobbyranka/workspace/spacepixelrts-pixel-ui-shell` on branch `hermes/starhaven-pixel-ui-shell` at or after `cf73767`.

Read first:

1. `DIRECTIVE.md`
2. `docs/FIRST_PLAYABLE.md`
3. `docs/PIXEL_FRONT_END_SYSTEM.md`
4. `tasks/FPE-2-luna-brief.md`
5. `tasks/FPE-3-luna-brief.md`
6. `tasks/FPE-4-luna-brief.md`
7. `index.html`
8. `scripts/gen-desktop.mjs`
9. `public/front-end-shell.css`
10. `public/front-end-scene.css`
11. `scripts/qa-pixel-front-end.mjs`
12. `tests/front-end-ui-shell.test.ts`

This is FPE-5 responsive/motion/orientation polish. The fresh blind critics passed Main Menu, Match Setup, panels, and loading. They did not name authored scene raster treatment as the largest gap, so do not trigger scenic-art reprocessing. Preserve all accepted FPE-2 through FPE-4 geometry unless objective viewport evidence proves a defect.

## Required implementation

### A. Complete the front-end visual surface

1. Rebuild `#rotate-gate` in `index.html` so the portrait entry surface belongs to the pixel UI system:
   - local Pixelify/Silkscreen/Kode roles only;
   - opaque neutral pixel frame;
   - 2 px border, 1 px inner hard highlight, 4 px hard shadow, 8 px chamfers;
   - clear orientation message and restrained authored motif;
   - no Trebuchet, Segoe, Arial, generic dashboard stack, blur, gradient, soft shadow, round card, or Unicode icon.
2. Keep `desktop.html` generated from the corrected source through `scripts/gen-desktop.mjs`. Do not hand-maintain a divergent copy.
3. Confirm every Main Menu, setup, panel, loading, and rotate-gate visible line uses a local role and remains readable.

### B. Responsive and safe-zone audit

Use the actual running browser, not CSS inspection alone.

1. Recheck both factions at:
   - 1920 × 1080
   - 1366 × 768
   - 1366 × 1024
   - 1180 × 820
2. Recheck `orientation=landscape-left` and `orientation=landscape-right` where the app exposes that query/state.
3. Check Main Menu, all seven panels, Match Setup, loading, and return to Main Menu.
4. Require:
   - no document-level horizontal or vertical overflow;
   - no clipped title, footer, dock, tooltip, profile, panel content, close button, setup action, segment, metadata, tip, or rotate message;
   - at least 24 px safe inset for panel/loading/footer surfaces and at least 32 px for the desktop command deck where specified;
   - all visible touch targets at least 44 × 44 px; dock remains 56 × 56;
   - all primary frame/control/decorative edges land on whole CSS pixels at deviceScaleFactor 1 at every target;
   - no authored scene focal point is obstructed by the command deck/loading panel;
   - no scene crop changes unless a test proves a focal-point collision. If no proof exists, do not touch scene CSS or art.
5. The 1366 × 1024 Match Setup has deliberate quiet space. Do not add fake cards or generic HUD noise. Change its vertical distribution only if a critic or measured clipping/imbalance gate fails.

### C. Motion and Reduced Motion

1. Audit every active transition/animation in the front-end shell.
2. Only `steps()` or immediate state changes are allowed. Remove any active smooth easing, scale animation, spring, drift, or fractional transform.
3. Whole-pixel motion only: 2 px hover/press and integer panel/loading decorative states.
4. Reduced Motion must:
   - suppress decorative menu/button/panel/badge/loading movement;
   - retain immediate focus/hover/selected state visibility;
   - retain truthful loading stage changes;
   - preserve scene static frame behavior through the existing compositor API.
5. Add automated checks for computed `animationTimingFunction` / `transitionTimingFunction` on representative controls in normal and Reduced Motion contexts.

### D. Static and browser QA

1. Extend `tests/front-end-ui-shell.test.ts` to prove across `public/front-end-shell.css`, `index.html`, generated `desktop.html`, `src/start-screen.ts`, and loading markup:
   - no banned font stacks, runtime font CDN, `backdrop-filter`, blur, control gradient, `cubic-bezier`, soft shadow blur, hue rotation, or border radius above 2 px;
   - no Unicode utility/faction/close/orientation icon text;
   - no legacy marker remains;
   - no procedural scene renderer is referenced by the production front-end path;
   - authored Sunweaver and Gravemark manifests remain distinct;
   - protected gameplay/compositor/assets remain unchanged from `645b0ec`.
2. Expand `scripts/qa-pixel-front-end.mjs` without weakening any prior assertion. Add:
   - whole-pixel geometry at all four viewports, not only 1366 × 1024;
   - both landscape orientation values;
   - portrait rotate-gate captures at 820 × 1180 and 768 × 1024;
   - normal and Reduced Motion captures for Main Menu, one panel, Match Setup, and both-faction loading;
   - computed timing-function assertions;
   - mouse hover/press, keyboard Tab/Enter/Escape/focus trap, and touch tap for representative controls;
   - return from setup/panel to Main Menu and focus restoration;
   - zero console/page/request errors and no missing assets.
3. Create or update a compact responsive manifest/contact sheet in the durable output. Do not commit generated QA images in this phase.
4. Keep `qa:aaa`, `qa:m1`, and `qa:front-end` green.
5. Update `PROGRESS.md` with exact FPE-5 evidence, blind pass status from the previous pieces, and any remaining limit.
6. Run:
   - `npm run test:pixel-front-end`
   - `npm run test:m0`
   - `npm run test:aaa`
   - `npm run build`
   - `npm run qa:pixel-front-end -- --out /home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/fpe-5-responsive-motion`
   - `npm run qa:aaa`
   - `npm run qa:m1 -- --out /home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/fpe-5-m1-flow`
   - `npm run qa:front-end` against a built preview with durable output
   - `git diff --check`
7. Review actual screenshots only for missing, clipped, or inconsistent controls. Do not grade your own aesthetic work.
8. Commit only this piece with message:
   `FPE-5: polish responsive pixel shell and motion`

## Hard boundaries

- Do not modify `src/sim.ts`, `src/engine.ts`, `src/render.ts`, `src/front-end-scene.ts`, or anything under `public/front-end/civilizations/`.
- Do not change app flow, game rules, match setup semantics, loading truth, profile schema, or accepted scene packs.
- Do not reprocess scene art. The conditional scenic piece is skipped because no fresh critic named it as the largest gap.
- Do not push. The lead verifies and pushes.
- Do not open a PR.

## Definition of done

The complete front-end, including portrait orientation, is pixel coherent and readable at every target; all geometry is whole-pixel and safe; mouse/keyboard/touch/Reduced Motion contracts pass; no banned production style/font/icon remains; protected files are byte-identical; all browser regressions pass with 0 errors; and an FPE-5 commit exists.
