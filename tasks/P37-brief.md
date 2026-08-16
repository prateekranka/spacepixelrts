You are the Composer 2.5 builder for Spacepixel RTS piece P37: put readable gems, rocks, and workers back on the quiet dust — without the checkerboard.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Read: tasks/P36-critic.md, src/render.ts resource scale, src/sim.ts camp/gem spawn, src/atlas.ts drawGem/drawRockTile.

P36 critic: combat still **passes**. Checkerboard is gone. Floor is now a **featureless mauve void**. Do **not** retile dust into gold/cyan/purple variants. Do **not** touch combat ranks, bolts, or HP-off.

Do not spawn agents.

## Single biggest gap (verbatim)

The frustum is a featureless quiet-dust void with no readable ore/gas/solar nodes, rock breaks, or workers gathering.

## Do

1. Keep the **one dust family** from P36.
2. Gem billboards **targetH = 1.45** (were ~1.05). Three gems must sit in the playfield: Helion ore at worker cluster, Kryos gas at +Z camp, solar at `(cx + 1.1, cz - 5.35)`.
3. Six **prop-wreck/rock** billboards at `|z-cz|` 5.2–6.0, `|x-cx|<=1.2`, scale ~1.2 — grey boulders, not magenta.
4. Workers stay at P32/P35 pitches in front of houses (countable gold packs).
5. No new dust hue hashing. No star motifs.

## Verify then ship

1. `npm run build`
2. Preview free port. `node scripts/measure.mjs --url http://127.0.0.1:PORT --screenshot critic/out/p37.png --wait 3 --fps-seconds 3`
3. Open PNG. **Pass only if you can point at ≥3 bright gems AND ≥3 workers AND two wings still firing round sparks on quiet (not rainbow) dust.**
4. Deploy `npx wrangler pages deploy dist --project-name=spacepixelrts`
5. Commit `P37: readable gems and rocks on quiet dust`
6. `tasks/P37.md`. Probe `0.2.12-wave1`.

Do not commit `notes.md` or PNGs.
