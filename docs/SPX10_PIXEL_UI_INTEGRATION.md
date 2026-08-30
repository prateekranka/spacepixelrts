# SPX-10 Pixel UI Integration

Status: ACTIVE (2026-08-30)
Card: t_981a3cda
Branch: hermes/starhaven-pixel-ui-shell

## Identity

- Current product SHA (origin/chatgptpro2008, approved SPX-01 baseline): `f6f2add6ef063dd18be9bb3ae300eab3be54dc0e`
- Source head (pixel shell, reviewed FPE-1..FPE-6): `fee0150381f7296a7632b5cba47797f96ff70917`
- Merge base: `9020475dd89a53ead0b3f2c0c01c189664879745`
- PR: https://github.com/prateekranka/spacepixelrts/pull/12

## Owned files (Pixel UI shell)

- `public/front-end-shell.css` (frozen DOM visual contract per docs/PIXEL_FRONT_END_SYSTEM.md)
- `public/front-end-scene.css` (pixel-authored scene CSS)
- `index.html`, generated `desktop.html`, `scripts/gen-desktop.mjs`
- `src/start-screen.ts`, `src/loading-segments.ts` (pixel loading lifecycle)
- Pixel loading behavior inside `src/main.ts` (segments, art-ready observer, sigils)
- `public/front-end-ui/**` (local fonts WOFF2 + OFL, authored integer-grid SVG icons, PROVENANCE.md)
- `tests/front-end-ui-shell.test.ts`, `scripts/qa-pixel-front-end.mjs`
- `scripts/qa-front-end-rebuild.mjs` (Pixel QA coverage merged with product process truth)
- `docs/PIXEL_FRONT_END_SYSTEM.md`, pixel QA docs under `docs/qa/starhaven-pixel-ui-shell/`

## Conflict policy

Normal merge commit only. No rebase, no force. Resolution rules:

- Gameplay/accepted-art truth wins: `src/sim.ts`, `src/engine.ts`, `src/render.ts`,
  `src/front-end-scene.ts`, `src/generated/**`, `public/front-end/civilizations/**`
  come from the current product baseline untouched.
- Pixel-owned DOM/CSS/test truth wins for shell presentation files listed above.
- `src/main.ts`: keep current product candidate/game/AppFlow/GameRenderer options;
  add only the Pixel loading behavior (segments, art-ready observation, sigil markup).
- `scripts/qa-front-end-rebuild.mjs`: keep fail-closed launch errors, explicit `--url`
  behavior, detached process-group reaping, and current product assertions; retain
  Pixel UI coverage.
- `package.json`: union of product and Pixel scripts (product wins on any conflict).
- `PROGRESS.md`: current product content wins; append verified SPX-10 facts only.

## Non-goals

No new features, copy, panels, game mechanics, or art. No redesign. Preserve profile
persistence, app-flow transitions, focus, keyboard, touch, Reduced Motion, the truthful
loading lifecycle, and one-reset match creation. Bans (unchanged): runtime font CDN,
blur, soft shadow, control gradient, smooth easing, large radius, hue rotation, Unicode
utility icon, fake loading percentage, duplicate Start action.

## Protected hashes (current product baseline, recorded pre-merge)

- src/sim.ts: `fb0f3d7b3e8d8a1ef97afebb7c23b3a7ad4e9bb04dc5ff6ac98437be6694dd0a`
- src/engine.ts: `182830c08fb36041da67254890ba640c7fc50c251cb720bac27fd0174795c8e8`
- src/render.ts: `40799d7d76941b69ae437d69312c8bd599f2e963fa5c951df5a5350903299122`
- src/front-end-scene.ts: `270e4eaf7c3feaf84de40eead31fd64e324aaa7a9e00263952efeaa75e17a32b`
- src/generated/sunweaver-lumen-guard-accepted.ts: `2836566bb2696fe004acc1e164d657f35d6909ef74ef3e6366dd30dab29388d5`
- public/front-end/civilizations/**: tree listing hash `dc1303c179e7041926f9c13e0d180cca9753e78fa5a2b4343897ae6074e8cd66`
  (full `git ls-tree -r` listing)

## Acceptance commands

- Unit/build: `npm run test:m0; npm run test:aaa; npm run test:pixel-front-end;
  npm run test:m2; npm run test:m2-ai; npm run test:m3; npm run test:m4; npm run test:m5;
  npm run test:vs2-ai; npm run test:vs2b; npm run test:vs3; npm run test:vs4;
  npm run test:vs5; npm run build`
- Browser gates into `<root>`: `npm run qa:pixel-front-end -- --out=<root>/pixel`;
  `npm run qa:aaa -- --out=<root>/aaa`; `npm run qa:m1 -- --out=<root>/m1`;
  `npm run qa:touch-contract -- --out=<root>/touch`;
  `npm run qa:progression-handoff -- --out=<root>/progression`;
  `npm run qa:vs3 -- --out=<root>/vs3`; `npm run qa:vs5 -- --out=<root>/vs5`;
  `npm run qa:front-end -- --out=<root>/front-end`;
  `npm run qa:front-end-video -- --out=<root>/video`
- Note: `qa:aaa` and `qa:front-end-video` scripts have fixed output paths; their
  `--out` is ignored by design (verified in forensics). Evidence is copied from the
  fixed outputs to the run evidence root.

## Preview rule

Preview only: `npx wrangler pages deploy dist --project-name=spacepixelrts
--branch=spx-10-pixel-ui`. Production `main` branch is never touched by this card.
Verify the returned preview URL, exact local/live HTML/JS/CSS/font/icon hashes, and a
real browser smoke with zero console/page errors.

## Rollback

- Branch rollback: discard `hermes/starhaven-pixel-ui-shell` commits; the reviewed
  head `fee0150` is intact on origin.
- Product rollback: `origin/chatgptpro2008` only advances by fast-forward. The prior
  accepted SHA `f6f2add` remains reachable; restore by resetting the branch to it.
- Preview rollback: deploy any previous branch or delete the preview branch; Pages
  keeps prior deployments.
