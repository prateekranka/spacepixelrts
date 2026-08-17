You are the Composer 2.5 builder for Starhold RTS piece **P91: quiet the ground**.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Read first: `DIRECTIVE.md` GAP 1, `src/terrain.ts` (the only file you rewrite), `src/main.ts` (VERSION only), `references/sand-shader.jpg` (value-weather idea: large-scale, low-contrast dunes — steal the QUIETNESS, not the Sahara UI).

Do **not** spawn agents. Do **not** touch `src/sprites.ts`, `src/art-reference.ts`, `src/sprite-sdf.ts`, `src/render.ts`, HUD, VFX, sim, or opening layout. Do **not** start GAP 2 or GAP 3.

## The gap (verified by Grok-vision on the REAL build)

The procedural terrain in `src/terrain.ts` is drowning sprites. Critic quote: **"purple-and-white zigzag tiling is so noisy that small units vanish into it and dark building slabs lose their edges."**

Root cause in the current fragment shader (do not leave these in):
- `qElev()` mixes high-frequency `sin` ripples (`rippleL` ~6.28, `rippleS` ~12.57) with 5-step `floor(bands * 5.0)` quantization → repeating zigzag/checker stamp at RTS zoom.
- `dustColor()` high-contrast purple (`hi` 0.58) vs deep (0.28) plus strong sun-rim (`* 0.55`) plus 32px pebble hash → white-on-purple sparkle noise.
- Pixel snap `floor(world * 32.0)` plus those ripples makes a tiling stamp.

## Do this (bounded)

Rewrite **only** the GLSL in `src/terrain.ts` so the playable dust is a **CALM, low-contrast dust field**:
1. **Near-flat base tone** — one mauve/dust family (keep Starhold space-dust, do not retheme to gold Sahara). Contrast between darkest and lightest dust must be small enough that green Helion infantry and dark halls **pop**.
2. **Subtle, LARGE-scale value variation only** — value-noise at map scale (think `world * 0.03..0.08`), soft mix, **no** high-frequency sin ripples, **no** 5-level quantization stamp.
3. **Kill the repeating stamp.** No zigzag, no checker, no 32px pebble field that reads as tiling.
4. Sun rims, if any, must be faint (a hint of form, not white stripes).
5. Keep procedural GLSL (no disk PNG terrain). Keep Rock / Void / Ore / Gas / Solar tile identity readable. Keep `uTiles` / `uDecals` sampling. Keep p99 < 8 ms (this is a cheaper shader, not a heavier one).
6. Bump `VERSION` in `src/main.ts` to `0.8.0-art`.

Steal from `references/sand-shader.jpg`: quiet low-contrast ground that recedes so figures read. Do **not** port that demo's UI, glitter, or warm-ochre biome — this is a space RTS dust belt.

## Verify

- `npx tsc --noEmit` clean; `npm run build` succeeds.
- Screenshot `http://localhost:5173` (dev is often already on 5173; if not, `npm run dev`) via `node scripts/screenshot.mjs --out critic/out/p91.png`. Look at the PNG: ground must be a calm field; units/halls must have readable edges; no purple-white zigzag.
- Do **not** declare done from code comments.

## Commit + report

```
git add src/terrain.ts src/main.ts tasks/P91.md
git commit -m "P91: quiet dust field — kill zigzag stamp so sprites pop"
```

Do **not** commit `notes.md`, huge PNGs, or `critic/out/*`. Write `tasks/P91.md` (what changed in the shader, how you verified). That report is not critic evidence.

`--yolo` is on. Stay inside this gap. When the ground is quiet, stop.
