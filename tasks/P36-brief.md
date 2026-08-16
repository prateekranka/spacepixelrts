You are the Composer 2.5 builder for Spacepixel RTS piece P36: make the ground a quiet dust belt, not a starburst checkerboard.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Read: tasks/P35-critic.md, src/atlas.ts drawDustTile/drawRockTile/drawTile, src/render.ts buildMap decals.

P35 critic: combat **PASSES** (two wings, round sparks, silhouettes, HUD, p99). Do **not** touch sim combat, bolts, HP overlay rules, ranks, or camp coords.

Do not spawn agents.

## Single biggest gap (verbatim)

The battlefield still reads as a repeating tri-color starburst checkerboard, not a dust-belt **place** with varied dust, rock, vents, and readable geography.

## Do

1. **One dust family:** all three dust variants share the same mid purple-brown (`~#6a5a70`) with **subtle** crack/pebble differences only. **No gold vs cyan vs purple checker. No white star/cross motifs.**
2. **Rock:** keep boulder silhouettes but stamp **at most 8** 2×2 decals on the pad, all outside the fire lane. Remove any per-tile star blit.
3. **Gems/vents** stay as the bright accents — they should be the only loud colors on the floor.
4. `buildMap` hashing may pick dust variants but they must look like the same material in a screenshot.

## Verify then ship

1. `npm run build`
2. Preview free port. `node scripts/measure.mjs --url http://127.0.0.1:PORT --screenshot critic/out/p36.png --wait 3 --fps-seconds 3`
3. Open PNG. **Pass only if the floor reads as one dusty field with a few rocks/gems — not a rainbow checker — AND the two wings + round bolts are still there.**
4. Deploy `npx wrangler pages deploy dist --project-name=spacepixelrts`
5. Commit `P36: quiet dust-belt ground`
6. `tasks/P36.md`. Probe `0.2.11-wave1`.

Do not commit `notes.md` or PNGs.
