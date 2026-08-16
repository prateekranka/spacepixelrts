You are the Composer 2.5 builder for Spacepixel RTS piece P12b: default zoom and sprite scale so a mid-map fight fills the screen like AoE2:DE.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Read first: docs/DESIGN.md §7, src/main.ts, src/input.ts, src/render.ts (scaleX/scaleY), PROGRESS.md.

Do not rewrite the atlas (P20 just punched silhouettes). Do not change sim.

## Gap
Camera `halfH` defaults to 8 and input clamps zoom to min 7, so units stay tiny. AoE2 default zoom makes infantry thumb-sized.

## Do
1. Default `input.halfH` ≈ 5.0 in src/main.ts.
2. In src/input.ts, allow zoom in to ~4.0 (change Math.max(7, ...) to Math.max(4, ...)). Pinch/wheel still works. Do not break pan math.
3. If infantry still look small at halfH=5, bump unit scale in src/render.ts slightly (infantry ~1.8–2.2, halls ~3.0). Keep pixel-nearest, no blur.
4. Verify: `npm run build`, then `npm run dev` (or use existing preview) and `node scripts/measure.mjs --url http://localhost:5173 --screenshot critic/out/p12.png --wait 3 --fps-seconds 3`. FPS >= 55, no console errors. Screenshot must show the opening clash filling most of the playfield, not a postage stamp in a sea of purple.
5. Deploy: `npm run build && npx wrangler pages deploy dist --project-name=spacepixelrts`
6. git commit: `P12: closer default zoom so the clash fills the screen`
7. Write tasks/P12.md

Stay in this repo. Do not spawn more agents.
