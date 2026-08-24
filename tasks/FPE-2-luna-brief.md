# FPE-2 Luna Builder Brief — Main Menu Pixel Shell

You are the implementation worker. Work only in `/home/bobbyranka/workspace/spacepixelrts-pixel-ui-shell` on branch `hermes/starhaven-pixel-ui-shell` at or after `c6981bd`.

Read first:

1. `DIRECTIVE.md`
2. `docs/FIRST_PLAYABLE.md`
3. `docs/PIXEL_FRONT_END_SYSTEM.md`
4. `docs/AAA_FRONT_END_INTEGRATION_SPEC.md`
5. `tasks/FPE-0-baseline.md`
6. `tasks/FPE-1-luna-brief.md`
7. `src/start-screen.ts`
8. `public/front-end-shell.css`
9. `public/front-end-scene.css`
10. `scripts/qa-front-end-rebuild.mjs`
11. `tests/front-end-ui-shell.test.ts`

This is FPE-2 only. Rebuild the visible Main Menu shell. Preserve all callbacks, profile storage behavior, panel behavior, setup behavior, loading lifecycle, and authored civilization scenes.

## Required implementation

### A. External CSS ownership

1. Remove `injectCss()` and `START_SCREEN_CSS` from `src/start-screen.ts`.
2. Move the required start-screen CSS into `public/front-end-shell.css`.
3. Keep setup and panel behavior/layout visually stable for now if practical. FPE-3 will restyle them. Mark their temporary legacy section clearly so later tests can remove it.
4. The Main Menu selector section must contain no `backdrop-filter`, blur, control gradient, blurred shadow, `cubic-bezier`, smooth `ease`, radius above 2 px, fractional transform, or full-screen overlay gradient.

### B. Main Menu geometry and type

Implement the exact frozen recipes in `docs/PIXEL_FRONT_END_SYSTEM.md`.

1. Use the local font roles:
   - Pixelify Sans Bold for STARHAVEN.
   - Silkscreen for kicker, menu labels, tooltips, badge, profile micro labels, and footer.
   - Kode Mono for promise, descriptions, subtitles, and record copy.
2. Set `data-civ` on `#start-screen` to the current preferred faction whenever profile/faction state changes, so shared accent tokens drive the shell.
3. Preserve the full-bleed authored scene and its right-side calm area. Remove the current smooth gradient UI veil. Do not change scene assets, manifests, compositor code, scene anchors, or crop unless an actual QA capture proves a safe-zone collision.
4. At 1366 × 1024 use a 448 px command deck with 4 px grid spacing, 32 px safe edge, title size near 80 px, profile 448 × 64, menu buttons 448 × 64 with 8 px gaps.
5. At 1920 × 1080 use a display title near 96–104 px and keep menu width between 420 and 470 px.
6. At 1366 × 768 and 1180 × 820 reduce title/gaps only in 4 px steps. Keep controls at least 52 px high and prevent document overflow.
7. STARHAVEN uses a hard 2 px dark offset shadow only. No glow.

### C. Pixel controls

1. Main menu buttons:
   - opaque `--px-panel` body;
   - 2 px outer border;
   - 1 px inner highlight through a pseudo-element or inset hard line;
   - 4 px hard bottom/right shadow;
   - square or 8 px chamfered shape, no rounded rectangle;
   - primary faction border and 4 px accent strip, no gradient;
   - hover exactly +2 px on X with 100 ms `steps(2, end)`;
   - pressed exactly +2 px on Y with reduced hard shadow;
   - focus 2 px bright outline with 2 px dark separation;
   - disabled remains opaque and does not move.
2. Add a small authored CSS pixel selection marker or integer-grid asset on hover/focus. Do not use Unicode.
3. Keep New Skirmish as the only primary action. Do not add a duplicate Start action.

### D. Profile, dock, tooltips, badge, footer

1. Profile module: 448 × 64, opaque, 2 px frame, 4 px hard shadow, separate 44 × 44 sigil cell, micro label/name/records line. No circular avatar, glass, or blur.
2. Dock: shared opaque frame, 2 px border, 4 px hard shadow, four real 56 × 56 buttons with 8 px gaps and the authored SVG icons.
3. Replace title-only browser tooltips with visible DOM tooltip elements using the pixel panel language. Each utility button must have an `aria-describedby` relation. Tooltip appears on hover and keyboard focus, not only mouse.
4. Badge: rectangular pixel badge with 2 px hard border; no pill. Keep existing clear-and-persist behavior unchanged.
5. Footer: Silkscreen, hard separators, 4 px grid. Keep both existing strings.
6. Add restrained faction motifs without changing layout rules:
   - Sunweaver: thin symmetric solar brackets.
   - Gravemark: reinforced corner blocks/status marks.

### E. Tests and browser QA

1. Extend `tests/front-end-ui-shell.test.ts` to prove:
   - no injected `START_SCREEN_CSS` or `injectCss` remains;
   - current faction reaches `data-civ`;
   - Main Menu markup has one primary action;
   - utility buttons have real DOM tooltips with `aria-describedby`;
   - Main Menu CSS has local font roles, 2/4 px hard frame values, `steps()` motion, exact 2 px hover/pressed moves, authored icon masks, and no forbidden properties in the Main Menu section;
   - protected gameplay files and civilization assets remain unchanged from `645b0ec`.
2. Add or extend `scripts/qa-pixel-front-end.mjs` and package script `qa:pixel-front-end`. It must run the built app in Playwright and save durable evidence under the required `--out` folder. At minimum it must test both factions at 1920×1080, 1366×768, 1366×1024, and 1180×820.
3. Browser assertions:
   - `data-art-ready="true"` and expected scene/faction;
   - Pixelify Sans, Silkscreen, and Kode Mono loaded and used by intended visible elements;
   - one visible New Skirmish primary action;
   - four real utility buttons, SVG icons painted, all controls work;
   - tooltip visible after hover and after keyboard focus;
   - dock touch targets at least 52 × 52;
   - profile and menu button target sizes;
   - no document overflow;
   - whole-pixel frame/control edge coordinates at 1366 × 1024;
   - visible focus;
   - Dispatches badge opens, clears, and stays clear after reload through the existing profile path;
   - no console or page errors;
   - capture both faction menus at all four dimensions plus a focused/tooltip state.
4. Keep `scripts/qa-front-end-rebuild.mjs` green. Extend only if necessary; do not weaken existing assertions.
5. Update `PROGRESS.md` with exact FPE-2 evidence and any honest limitation.
6. Run:
   - `npm run test:pixel-front-end`
   - `npm run test:m0`
   - `npm run test:aaa`
   - `npm run build`
   - `npm run qa:pixel-front-end -- --out /home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/fpe-2-main-menu`
   - `git diff --check`
7. Review the actual screenshots yourself only for missing/clipped controls. Do not grade your own aesthetic work.
8. Commit only this piece with message:
   `FPE-2: rebuild main menu pixel shell`

## Hard boundaries

- Do not modify `src/sim.ts`, `src/engine.ts`, `src/render.ts`, `src/front-end-scene.ts`, or anything under `public/front-end/civilizations/`.
- Do not change app-flow transitions, profile schema, callbacks, match setup rules, or loading truth.
- Do not regenerate or recolor authored scenes.
- Do not push. The lead verifies and pushes.
- Do not open a PR.

## Definition of done

The actual browser Main Menu at all four target sizes uses the local pixel typography, hard pixel frames, real authored icons/tooltips, one primary action, faction accent tokens, and whole-pixel motion. All functional and protected gates pass, no visible control clips, 0 console errors, and an FPE-2 commit exists.
