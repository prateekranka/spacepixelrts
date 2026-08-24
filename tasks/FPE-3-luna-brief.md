# FPE-3 Luna Builder Brief — Pixel Panels and Match Setup

You are the implementation worker. Work only in `/home/bobbyranka/workspace/spacepixelrts-pixel-ui-shell` on branch `hermes/starhaven-pixel-ui-shell` at or after `596662a`.

Read first:

1. `DIRECTIVE.md`
2. `docs/FIRST_PLAYABLE.md`
3. `docs/PIXEL_FRONT_END_SYSTEM.md`
4. `docs/AAA_FRONT_END_INTEGRATION_SPEC.md`
5. `tasks/FPE-0-baseline.md`
6. `tasks/FPE-2-luna-brief.md`
7. `src/start-screen.ts`
8. `public/front-end-shell.css`
9. `scripts/qa-front-end-rebuild.mjs`
10. `scripts/qa-pixel-front-end.mjs`
11. `tests/front-end-ui-shell.test.ts`

This is FPE-3 only. Rebuild Match Setup and all seven panels in the same pixel system as the accepted FPE-2 Main Menu. Preserve every behavior and callback. Do not change loading yet except to preserve it for FPE-4.

## Required implementation

### A. Remove the FPE-3 legacy styling section

1. Replace the `FPE-3 LEGACY SETUP AND PANELS` CSS section with a production pixel setup/panel section.
2. Keep loading marked as the sole remaining FPE-4 legacy surface.
3. Setup/panel CSS must contain no `backdrop-filter`, blur, control gradient, blurred shadow, smooth `ease`, `cubic-bezier`, pill shape, radius above 2 px, fractional transform, or transparent invisible hotspot.
4. Use only local Pixelify Sans, Silkscreen, and Kode Mono roles.

### B. Match Setup

Preserve the existing markup and functional rules unless one small hook is required.

1. Make the setup screen an opaque/near-opaque command interface on the same neutral palette. Do not add a modern dashboard background or gradient.
2. At 1366 × 1024:
   - 32 px safe area;
   - framed header;
   - two pixel sections for faction match-up and rules;
   - 16 px main gap;
   - 2 px outer borders, 1 px inner hard highlight, 6 px hard shadows, 8 px chamfers;
   - all section padding/gaps on the 4 px grid.
3. Apply display font to the setup heading, Silkscreen to labels/status/tabs, and Kode Mono to explanations.
4. Restyle all segment controls with opaque bodies, 2 px borders, stepped two-tone selected fills, and a non-color selected marker. Use no gradient and no pill radius.
5. Keep each control at least 44 × 44 px. Primary Start Match and secondary Back use the accepted hard pixel control states.
6. Restyle the deterministic seed input as a square pixel frame with visible invalid and focus states.
7. Keep all current validation copy, selected values, mirror-swap behavior, preferred faction change, scene/controller faction update, Start Match gating, Back action, and status announcements.
8. At 1920×1080, 1366×768, 1366×1024, and 1180×820, the setup must fit the safe area. Use internal scrolling only when required. No document-level horizontal scroll and no clipped Start Match/Back actions.

### C. Seven panels

Rebuild Tutorial, Factions, Settings, Records, Match History, Tech Codex, and Dispatches.

1. Panel max width 880 px; at 1180 × 820 fit inside a 24 px safe inset.
2. Opaque body at `--px-panel` or at least 94% opacity; 2 px outer border; 1 px inner hard highlight; 6 px hard shadow; 8 px chamfers; no glass or blur.
3. Header: Pixelify title, Silkscreen kicker, one faction accent line.
4. Replace the Unicode `×` close text with an authored integer-grid `close.svg` asset or a CSS-only two-bar pixel X. The button remains a real 44 × 44 button with `aria-label="Close"`.
5. Panel entrance uses 140 ms `steps(4, end)` or an equivalent 3–5 frame reveal. No scale, spring, or smooth fade. Reduced Motion removes decorative entrance motion.
6. Custom scrollbar: square hard-edged track/thumb with faction focus color.
7. Restyle all internal rows, empty states, record cells, history entries, codex entries, dispatch cards, settings rows, tutorial list, and faction choices with hard neutral frames and integer dividers. Do not create web-dashboard cards.
8. Faction choices keep authored sigils and show selected state through border plus hard marker, not color alone.
9. Keep panel content and all profile writes unchanged. Dispatches must clear the unread badge and persist. Factions must update the preferred faction and Main Menu scene. Records/history remain defensive empty states when no data exists.
10. Preserve focus trap, Escape close, click/touch close, and focus restoration to the exact opener.

### D. Tests and browser QA

1. Extend `tests/front-end-ui-shell.test.ts` to prove:
   - no FPE-3 legacy marker remains;
   - panel close uses no Unicode icon text;
   - setup/panel CSS contains required 2 px borders, 6 px hard shadows, 8 px chamfers, local roles, stepped reveal, Reduced Motion rule, and square scrollbar;
   - setup/panel section contains none of the forbidden CSS terms/properties;
   - all seven panel action names remain present;
   - loading remains the only explicitly scoped FPE-4 legacy surface;
   - protected gameplay/compositor/assets remain unchanged from `645b0ec`.
2. Expand `scripts/qa-pixel-front-end.mjs` without weakening FPE-2 Main Menu checks. Add:
   - Match Setup for both player factions at all four target dimensions;
   - selected controls, mirror-swap, seed mode/input, invalid seed, valid deterministic seed, Back, and Start Match gating;
   - every panel opens from its real button, has a visible Close button, traps Tab/Shift+Tab, closes with Escape, restores focus, and has no overflow/clipping;
   - Factions changes preferred faction and scene after close;
   - Dispatches clears badge and persists after reload;
   - keyboard focus styles are visible;
   - a touch-enabled browser context taps one panel opener, one setup segment, and the close control;
   - Reduced Motion removes decorative panel animation while preserving state changes;
   - local fonts are loaded/used, all controls meet 44 px, no console/page errors;
   - screenshots: both-faction setup at all dimensions, all seven panels at 1366 × 1024, one 1180 × 820 panel, one Reduced Motion panel, and a contact sheet or manifest list.
3. Keep `npm run qa:front-end` green. Do not weaken its existing 22 contracts.
4. Update `PROGRESS.md` with exact FPE-3 evidence and any honest limitation.
5. Run:
   - `npm run test:pixel-front-end`
   - `npm run test:m0`
   - `npm run test:aaa`
   - `npm run build`
   - `npm run qa:pixel-front-end -- --out /home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/fpe-3-panels-setup`
   - `npm run qa:front-end` against a built preview with durable output
   - `git diff --check`
6. Review the browser screenshots only for missing, overlapped, or clipped controls. Do not grade your own aesthetic work.
7. Commit only this piece with message:
   `FPE-3: rebuild setup and panels in pixel UI`

## Hard boundaries

- Do not modify `src/sim.ts`, `src/engine.ts`, `src/render.ts`, `src/front-end-scene.ts`, or anything under `public/front-end/civilizations/`.
- Do not change app-flow transitions, profile schema, callback semantics, match rules, seed semantics, loading lifecycle, or scene assets.
- Do not alter the accepted FPE-2 Main Menu geometry unless a regression test proves a direct break.
- Do not implement the segmented loading panel in this phase.
- Do not push. The lead verifies and pushes.
- Do not open a PR.

## Definition of done

All seven panels and Match Setup use one hard pixel UI system, all original actions and persistence paths still work, keyboard/touch/focus/Escape/Reduced Motion contracts pass, all target viewports are unclipped, 0 browser errors occur, protected files are byte-identical, and an FPE-3 commit exists.
