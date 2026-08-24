# FPE-4 Luna Builder Brief — Segmented Pixel Loading

You are the implementation worker. Work only in `/home/bobbyranka/workspace/spacepixelrts-pixel-ui-shell` on branch `hermes/starhaven-pixel-ui-shell` at or after `32a5150`.

Read first:

1. `DIRECTIVE.md`
2. `docs/FIRST_PLAYABLE.md`
3. `docs/PIXEL_FRONT_END_SYSTEM.md`
4. `docs/AAA_FRONT_END_INTEGRATION_SPEC.md`
5. `tasks/FPE-0-baseline.md`
6. `tasks/FPE-3-luna-brief.md`
7. `src/main.ts` loading lifecycle
8. `src/front-end-scene.ts` public API and data attributes
9. `public/front-end-shell.css`
10. `scripts/qa-aaa-front-end.mjs`
11. `scripts/qa-pixel-front-end.mjs`
12. `tests/front-end-ui-shell.test.ts`

This is FPE-4 only. Replace the final legacy loading surface with a truthful segmented pixel command panel. Preserve the Loading app state, exact submitted config, one world reset, legal `LOAD_READY` transition, and authored loading scenes.

## Required implementation

### A. Loading markup and truth

1. Replace the continuous `.front-loading-track i` markup with exactly 16 real DOM segment elements.
2. Do not claim a percentage. Use a segmented activity/progress strip tied only to real lifecycle stages:
   - stage 1 when the accepted config creates the loading screen;
   - stage 2 when the authored loading scene reports `data-art-ready="true"`;
   - stage 3 immediately before/after real match preparation reaches the legal `LOAD_READY` path.
3. Each stage changes only complete segment states. No smooth width, scale, or fake random progression.
4. Use a MutationObserver or a bounded existing lifecycle hook to detect the scene-ready attribute. Disconnect it in `hideLoadingScreen()` and on failure. Do not add a timer that pretends work completed.
5. If the normal transition is too fast for stage 3 to remain visible, keep the truthful DOM state update for observability; do not add an artificial delay.
6. The `?qa-hold-loading=1` path must still hold the same real submitted match and expose the loading frame without changing reset count.
7. Preserve exact metadata: civilization, difficulty, resolved deterministic/random seed, Helios Rift, and tip copy.

Suggested semantic structure:

```text
STARHAVEN // HELIOS RIFT
PREPARING SKIRMISH
Civilization · Difficulty · Seed
[16 discrete segments]
Gameplay tip
```

Use a `role="status"` or labelled group. Do not use a `progressbar` with fake `aria-valuenow`.

### B. Loading pixel visual system

1. Remove the `FPE-4 LEGACY LOADING RULES` marker and replace it with production loading CSS.
2. At 1366 × 1024:
   - lower-center panel, 704 px wide, 152 px high;
   - 24 px lower safe gap;
   - opaque `--px-panel` body;
   - 2 px outer border, 1 px inner hard highlight, 4 px hard shadow, 8 px chamfers;
   - content aligned to the 4 px grid.
3. Use Pixelify Sans for `PREPARING SKIRMISH`, Silkscreen for kicker/status labels, Kode Mono for metadata and tip.
4. Set `data-civ` and authored faction sigil treatment from the selected player faction. Use existing `sunweaver-sigil.svg` / `gravemark-sigil.svg`, not Unicode.
5. 16 segments use a 2 px track frame and 4 px gaps. Completed/active segments use `--civ-primary`; future segments use dark steel. Use a visible non-color distinction such as an inner line or raised block.
6. Optional activity blink uses `steps()` only. Reduced Motion disables decorative blink but keeps truthful stage updates.
7. No glass, `backdrop-filter`, blur, gradient, soft shadow, continuous line, pill, smooth transform, or runtime CDN font.
8. Keep the panel outside each authored scene focal point at all four target sizes. Do not modify loading scene assets, manifests, compositor, crop, or anchors.
9. At 1920×1080, 1366×768, 1366×1024, and 1180×820, keep the panel within safe area and readable. For short height, reduce panel padding/type only in 4 px steps; do not reduce body copy below 13 px.

### C. Tests and browser QA

1. Extend `tests/front-end-ui-shell.test.ts` to prove:
   - no FPE legacy marker remains anywhere;
   - exactly 16 segment markup is produced through a pure helper or deterministic source pattern;
   - no continuous progress child/scaleX animation remains;
   - real lifecycle stage hooks exist for screen-created, scene-ready, and match-ready states;
   - no artificial loading delay or random progress exists;
   - loading uses local roles, hard frame values, 16-segment layout, `steps()` only where decorative, and a Reduced Motion rule;
   - loading and the full front-end shell contain no banned CSS terms/properties;
   - old Trebuchet/Segoe loading font is gone;
   - protected gameplay/compositor/assets remain unchanged from `645b0ec`.
2. Expand `scripts/qa-pixel-front-end.mjs` and `scripts/qa-aaa-front-end.mjs` without weakening prior menu/setup/panel gates. Add/require:
   - both factions at all four target dimensions;
   - loading metadata matches the selected player faction, difficulty, and exact seed;
   - expected authored loading scene/faction and `data-art-ready="true"`;
   - 16 visible segment elements and integer rectangles;
   - stage 1/2 truth through DOM state; stage 3 through a safe test hook or transition observation without adding delay;
   - panel width/height/safe inset at 1366 × 1024 and no overflow at all targets;
   - normal and Reduced Motion captures for both factions;
   - no console/page errors and no missing font/icon/scene asset request;
   - reset count remains exactly one after legal transition;
   - loading hides only after the legal transition.
3. Keep all FPE-2/FPE-3 QA and `qa:front-end` green.
4. Update `PROGRESS.md` with exact FPE-4 evidence and any honest limitation.
5. Run:
   - `npm run test:pixel-front-end`
   - `npm run test:m0`
   - `npm run test:aaa`
   - `npm run build`
   - `npm run qa:aaa`
   - `npm run qa:pixel-front-end -- --out /home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/fpe-4-loading`
   - `npm run qa:m1 -- --out /home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/fpe-4-m1-flow`
   - `npm run qa:front-end` against a built preview with durable output
   - `git diff --check`
6. Review actual composited screenshots only for missing/clipped controls. Do not grade your own aesthetic work.
7. Commit only this piece with message:
   `FPE-4: rebuild loading as segmented pixel command`

## Hard boundaries

- Do not modify `src/sim.ts`, `src/engine.ts`, `src/render.ts`, `src/front-end-scene.ts`, or anything under `public/front-end/civilizations/`.
- Do not alter app-flow transitions, match preparation semantics, seed resolution, reset count, match rules, or profile schema.
- Do not add fake progress, random progress, or an artificial delay.
- Do not modify accepted Main Menu, setup, or panel geometry unless required to keep their existing tests green.
- Do not push. The lead verifies and pushes.
- Do not open a PR.

## Definition of done

Loading uses a 16-segment truthful hard pixel command panel for both factions, normal and Reduced Motion remain correct, metadata and scene match the selected config, no fake delay/progress exists, reset/transition behavior is unchanged, all browser and protected gates pass with 0 errors, and an FPE-4 commit exists.
