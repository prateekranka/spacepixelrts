You are the Composer 2.5 builder for Spacepixel RTS piece P40: the opening fight must have a readable winner in one second.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Read: tasks/P39-critic.md, src/sim.ts tryStrike opening damage, src/atlas.ts death frame, src/render.ts uvFor death.

P39 critic: wings, sparks, mid gem, dust, HUD, p99 **pass**. Fail: **symmetric wallpaper fight** — cannot tell who is winning (§9 #1). Do not rainbow-tile. Do not hide the mid gem or workers. Do not spawn agents.

## Single biggest gap (verbatim)

The mid fight still has no readable winner in one second — symmetric held ranks and round floor sparks give no casualty skew, hit-flash, wreckage, or formation break.

## Do

1. Opening clash damage vs Kryos (team 1): **×1.15** (not 0.42). Helion (team 0) still takes **×0.35** incoming. By tick 60 (~3s) **2–3 Kryos fighters should be dead** (death frame 4 + corpse stain). Helion line stays mostly intact.
2. Dead ents: keep corpse 1.5s (`uvFor` frame 4). Don't immediately free the slot if that hides wrecks.
3. Kryos hit: iFlash 0.45 on the **target** for 0.2s after bolt hit (need a hitFlash field or reuse cooldown on the victim).
4. Workers: exaggerating gold pack already there; bob scale 1.55. If they still read as fighters, add a 2px yellow diamond over their feet in overlay for tick<240 only (gather pip) — last resort.

## Verify then ship

1. `npm run build`
2. Preview free port. `node scripts/measure.mjs --url http://127.0.0.1:PORT --screenshot critic/out/p40.png --wait 3 --fps-seconds 3`
3. Open PNG. **Pass only if the blue line is visibly thinner/broken vs the green line (corpses or holes) AND sparks still fly AND mid gem + workers remain.**
4. Deploy `npx wrangler pages deploy dist --project-name=spacepixelrts`
5. Commit `P40: opening clash has a readable winner`
6. `tasks/P40.md`. Probe `0.2.15-wave1`.

Do not commit `notes.md` or PNGs.
