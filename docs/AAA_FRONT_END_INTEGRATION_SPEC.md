# AAA Front-End Integration Spec — Starhaven Civilization Scene Packs

Status: **FROZEN** (lead-owned). Branch: `hermes/starhaven-aaa-front-end`.
Implementation target: `src/front-end-scene.ts` (PR #10 procedural painter).

The authored scene contract remains unchanged. The DOM shell that overlays these packs is governed by `docs/PIXEL_FRONT_END_SYSTEM.md` on `hermes/starhaven-pixel-ui-shell`. That UI contract may change layout-safe CSS and markup hooks, but it must preserve this compositor API, the manifests, and the accepted art compositions.
Public API of `front-end-scene.ts` MUST stay compatible:
`mountFrontEndScene(container, {faction, mode, reducedMotion})` →
controller with `root`, `canvas`, `sceneId`, `setFaction`, `setMode`,
`setReducedMotion`, `destroy`. Canvas remains 960x540, 12 fps, `aria-hidden`.

## 1. What changes

Replace the procedural painter (`drawScene` + friends) with an authored
layered-asset compositor. Keep: `SCENE_WIDTH/HEIGHT/ FPS`, `SceneId`,
`SceneMode`, `quantizeSceneTime`, `sceneMotionFrame`, `sceneMotionOffset`,
`sceneForFaction`, the `SceneRenderer` class shell, the dataset contract, and
the pure test surface (`tests/front-end-scene.test.ts` must pass unchanged).

## 2. Assets

All art lives under `public/front-end/civilizations/<civ>/<mode>/` per
`docs/AAA_FRONT_END_ART_SPEC.md`. Every civilization directory ships:

- `manifest.json` — declarative scene description (schema in §3).
- The listed layer images/sheets.

`public/` assets are served as static files; `import.meta.glob`/fetch at runtime.

## 3. manifest.json schema

```json
{
  "scene": "sunweaver-capital",
  "mode": "menu",
  "canvas": {"width": 960, "height": 540},
  "assets": [
    {"file": "sky.webp", "kind": "cover", "blend": "source-over"},
    {"file": "celestial-body.webp", "kind": "rect", "blend": "screen",
     "rect": [0,0,960,540]},
    {"file": "far-terrain.webp", "kind": "cover", "blend": "source-over"},
    {"file": "settlement.webp", "kind": "cover", "blend": "source-over"},
    {"file": "foreground.webp", "kind": "cover", "blend": "source-over"},
    {"file": "atmosphere.webp", "kind": "cover", "blend": "screen"}
  ],
  "sprites": [
    {"file": "ships.png", "cells": {"cols": 4, "rows": 1},
     "frames": 2, "rect": [86, 300, 190, 96], "frameRate": 6,
     "drift": {"amplitude": 12, "phase": 0.7}, "blend": "source-over"},
    {"file": "ship-thrusters-strip.png", "cells": {"cols": 6, "rows": 1},
     "frames": 6, "rect": [86, 300, 190, 96], "frameRate": 12,
     "blend": "screen"}
  ],
  "twinkles": {
    "mask": "lights-mask.png", "rect": [0, 0, 960, 540],
    "fps": 6, "alpha": [0.35, 1.0]
  }
}
```

Notes:
- `cover` assets are scale-typed to fill the canvas (512-height art scaled to 540).
- `rect` assets draw at `[x,y,w,h]` in 960x540 space.
- `blend: screen` assets are black-background additive layers.
- `sprites[]` drives frame/loop animation; `drift` bobs via `sceneMotionOffset`
  (zero when `reducedMotion`).
- `twinkles` light mask pulses per frame using the provided alpha range.
- Strips: `cells.cols` frames, `frameRate`, looping; frame index =
  `Math.floor(frame / step) % frames` where `step = 12 / frameRate` (12 fps base).

## 4. Renderer behavior

1. On mount: fetch `manifest.json`, preload all images (decoded via `ImageBitmap`
   where available); paint first static frame immediately; start 12 fps rAF loop.
2. If assets fail: paint a muted flat fallback (first row: sky gradient from
   manifest palette if present, else `#0b0e14`) and mark `data-art-ready="false"`.
   Never throw.
3. Paint order: `assets` in manifest order → `sprites` → `twinkles`.
4. `setFaction` / `setMode` reload the matching civ/mode pack; the controller
   loads packs lazily and caches per (faction, mode).
5. `reducedMotion`: static frame 0; strips use frame 0 only; drift = 0;
   twinkles = alpha high bound.
6. Dataset contract unchanged: `data-scene`, `data-faction`, `data-mode`,
   `data-reducedMotion` on root + `data-sceneId`, `data-reducedMotion` on the
   container (as today).
7. Keep `aria-hidden` and canvas 960x540. No new DOM nodes required; the
   compositor draws into the existing canvas.

## 5. Tests

Keep `tests/front-end-scene.test.ts` green (it must still pass; it asserts no
`Math.random`, no `hue-rotate`, no `front-end-theme-runtime`).

Add `tests/front-end-scene-aaa.test.ts` (pure node, no browser):
- Manifest loader schema validation (required files exist under
  `public/front-end/civilizations/<civ>/<mode>/manifest.json`).
- Strip frame math: `frameIndex(frame, frameRate, fps)` returns 0..frames-1 loop;
  frame 0 for reducedMotion.
- Every manifest asset file exists on disk; every strip `cols >= frames`;
  rects within 960x540.
- Palette/asset invariants: scenic files are `.webp`; sheets/masks are `.png`.

## 6. Browser QA

`scripts/qa-front-end-aaa.mjs` (Playwright Chromium, 1920x1080):
- Load `/desktop.html` (or dev server) with a forced faction via localStorage
  (`frontEndProfileFaction` = `sunweaver`/`gravemark`; see start-screen profile
  load path) and capture `menu` + `loading` (route to MatchSetup triggers
  loading mode).
- Assert: no console errors; canvas painted (sample center pixels non-uniform across
  a few reads); `data-art-ready="true"`; sceneId matches faction; menu DOM
  (STARHAVEN title, New Skirmish, profile card) visible over the art; loading
  readout visible.
- Save full-frame screenshots to `evidence/starhaven-aaa-<civ>-<mode>/` for the
  blind gate.

## 7. Verification (lead)

1. `npm run build` passes.
2. `npm run test:front-end-aaa` (new) + `test:front-end` (existing scene tests) pass.
3. `node scripts/qa-front-end-aaa.mjs` produces 4 evidence sets.
4. Blind vision gate (zen deepseek-v4-flash-vision-exp) on the 4 screens vs
   `docs/AAA_FRONT_END_ART_SPEC.md` gates G3–G6 → all PASS.
5. `git diff --check` clean; commit; push; open PR (base `codex/starhaven-menu-rebuild`).
