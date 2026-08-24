# FPE-1 Luna Builder Brief — Pixel UI Foundation

You are the implementation worker. Work only in `/home/bobbyranka/workspace/spacepixelrts-pixel-ui-shell` on branch `hermes/starhaven-pixel-ui-shell`.

Read first:

1. `DIRECTIVE.md`
2. `docs/FIRST_PLAYABLE.md`
3. `docs/PIXEL_FRONT_END_SYSTEM.md`
4. `docs/AAA_FRONT_END_INTEGRATION_SPEC.md`
5. `tasks/FPE-0-baseline.md`
6. `src/start-screen.ts`
7. `public/front-end-shell.css`
8. `index.html`
9. `package.json`

This is FPE-1 only. Add the local font, token, icon, and foundation test layer. Do not rebuild the full menu, setup, panels, or loading layout in this piece. Do not alter authored civilization scene files or manifests.

## Required implementation

1. Add locally bundled, license-verified WOFF2 font files for these fixed roles:
   - Pixelify Sans Bold for display.
   - Silkscreen Regular and Bold for interface labels.
   - Kode Mono Regular and Medium for body copy.
2. Use source files from the official Google Fonts repository or upstream project. Commit:
   - the WOFF2 files under `public/front-end-ui/fonts/`;
   - `OFL.txt` files as needed;
   - `PROVENANCE.md` with source repository URLs, upstream paths, version or commit if available, font roles, file hashes, and license.
   Runtime must not fetch fonts from a CDN.
3. Add integer-grid, authored SVG assets under `public/front-end-ui/icons/`:
   - `records.svg`
   - `history.svg`
   - `codex.svg`
   - `dispatches.svg`
   Each icon must use a 16×16 or 20×20 viewBox, integer coordinates, no text, no filters, no curves that depend on antialiasing, and `shape-rendering="crispEdges"`. Use clear one-color silhouettes and `currentColor` where safe.
4. Add authored SVG sigils under the same folder:
   - `sunweaver-sigil.svg`
   - `gravemark-sigil.svg`
   They must follow the same integer-grid rule and must not be Unicode text.
5. In `public/front-end-shell.css`, add the shared foundation from `docs/PIXEL_FRONT_END_SYSTEM.md`:
   - local `@font-face` declarations;
   - all shared neutral and faction tokens with the exact hex values;
   - font role variables;
   - 4 px grid, border, hard-shadow, focus, pixel-image, and hidden-state primitives;
   - no `backdrop-filter`, blur, control gradient, soft shadow blur, `cubic-bezier`, or radius above 2 px in the new foundation.
   Keep the current loading rules for now if necessary; FPE-4 replaces them. Do not claim the full shell is clean yet.
6. In `src/start-screen.ts`, replace the four Unicode dock glyph parameters and the two Unicode faction sigils with accessible `<img>` or CSS-backed authored assets. Preserve all labels, callbacks, button elements, badge behavior, profile behavior, and Factions panel selection. Do not change action names.
7. Add `tests/front-end-ui-shell.test.ts` and package script `test:pixel-front-end`. This phase test must prove:
   - all required WOFF2, license, provenance, and SVG files exist and are non-empty;
   - SVGs use an integer viewBox, `shape-rendering="crispEdges"`, no `<text>`, no filter, and no fractional numeric coordinates;
   - exact shared color tokens are present;
   - font faces are local URLs under `/front-end-ui/fonts/` and no runtime font CDN exists;
   - old dock Unicode glyphs and old faction Unicode sigils do not occur in production TypeScript/HTML;
   - the four utility controls remain real buttons with labels and authored icon asset references;
   - `src/sim.ts`, `src/engine.ts`, civilization manifests, and civilization asset files were not modified in this commit relative to `645b0ec`.
   Strict whole-shell style bans that require the later FPE-2/FPE-4 restyle can be added in later phases; do not weaken the final contract.
8. Update `PROGRESS.md` with a short factual FPE-1 status, exact font names/licenses, tests run, and any real limitation.
9. Run:
   - `npm run test:pixel-front-end`
   - `npm run test:m0`
   - `npm run test:aaa`
   - `npm run build`
   - `git diff --check`
10. Review the diff. Commit only this piece with message:
    `FPE-1: add local pixel UI foundation`

## Hard boundaries

- Do not modify `src/sim.ts`, `src/engine.ts`, `src/render.ts`, `src/front-end-scene.ts`, or anything under `public/front-end/civilizations/`.
- Do not change game rules, state transitions, profile schema, or loading lifecycle.
- Do not regenerate or redesign scene art.
- Do not push. The lead will verify and push.
- Do not open a PR.

## Definition of done

The font files and licenses are real, the six SVGs are crisp integer-grid assets, no Unicode dock/faction icon remains in production markup, the foundation test passes, protected code is untouched, build and protected tests pass, and the FPE-1 commit exists.
