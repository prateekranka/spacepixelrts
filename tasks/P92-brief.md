You are the Composer 2.5 builder for Starhold RTS piece **P92: real buildings** (GAP 2).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Read first: `DIRECTIVE.md` GAP 2, `src/art-reference.ts` `drawHall()`, `src/sprites.ts` (building functions only), `src/sprite-sdf.ts` (atlas UV / hall cell — fix packing if halls clip).

Do **not** spawn agents. Do **not** retune terrain (`src/terrain.ts` is P91, leave it). Do **not** start GAP 3 unit-roster work except if a building blit bug also crops units. Do **not** change HUD/VFX/sim.

## The gap (verified by Grok-vision on the REAL build)

Buildings still read as **"black slabs, no doors/windows/machinery"** — a dark box with a gold sticker. The door/roof fix lives in `src/art-reference.ts` but **does not read in the running game** (either `sprites.ts` still too dark/tiny at RTS zoom, or the 64px hall is packed wrong in the atlas).

## Do this

Every building in `src/sprites.ts` — **hall, house, barracks, unique × all 3 civs** — must read as a PLACE at opening-camera zoom:

1. **Roof plane** — wide at eaves, narrow at peak (never inverted). Lit top-left, different value from the wall.
2. **Wall plane** — lighter than INK and lighter than the quiet dust, so the slab has an edge. Top-left 3-tone.
3. **Door** — short, wider-than-tall, dark INSET rectangle at **bottom-center on the ground** (not a full-height slit, not 5 invisible pixels). Must survive RTS zoom: make it chunky (think 9–14px wide, 5–8px tall on a 64px hall; proportional on 32px house).
4. **Windows** — 1–2px lit slots on the wall, more than one, actually visible at gameplay scale (not a single pixel that vanishes).
5. **No gold-sticker identity.** Magenta `MAG` team-key can remain as a small banner/trim, but must not be the only readable feature.
6. Civ motif (hive dome / crystal spire / void umbra) is subordinate to roof+wall+door.

If the hall atlas packing is wrong (64px blit into a 32px column, overlapping), fix `buildSpriteAtlas` / `sprite-sdf.ts` UV math so the full roof+door is what the GPU samples.

Bump `VERSION` in `src/main.ts` to `0.8.1-art` if it is still `0.8.0-art`.

## Verify

- `npx tsc --noEmit`; `npm run build`.
- Dev is already on `http://localhost:5173`. **Do NOT run `npm run dev` as a blocking child** (it never exits and leaks). Screenshot with `node scripts/screenshot.mjs --url http://localhost:5173 --out critic/out/p92.png`.
- A naive player must name "that's a building with a door" for the player's hall. House/barracks in the base must not be black boxes.
- Look at the PNG. Do not declare done from code.

## Commit + report

```
git add src/sprites.ts src/sprite-sdf.ts src/main.ts tasks/P92.md
git commit -m "P92: buildings as places — roof, wall, inset door, lit windows"
```

Do **not** commit `notes.md` or huge PNGs. Write `tasks/P92.md`. Stay in this gap. Stop when halls/houses read as architecture.
