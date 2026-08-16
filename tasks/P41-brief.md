You are the Composer 2.5 builder for Spacepixel RTS piece P41: Kryos line starts already broken — corpses in rank.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Read: tasks/P40-critic.md, src/sim.ts spawnScenario, src/render.ts uvFor death frame.

P40 critic FAIL: damage skew did not read. Both wings still look full. Do not spawn agents. Keep mid gem, workers, sparks, quiet dust.

## Single biggest gap (verbatim)

The mid fight still has no readable winner in one second — held ranks, ambient floor sparks, and a center gem give no casualty skew.

## Do

Spawn Helion **8 living fighters**. Spawn Kryos **5 living fighters** in the front/center columns only. In the three empty Kryos rank slots, spawn fighters then **immediately kill** them (`hp=0`, keep `alive` until corpse timer, or a dedicated corpse flag that still draws frame 4 for 2.5s). Those three must be **visible wrecks** in the Kryos line at t=3s.

If kill() despawns too fast, don't call kill — set `hp=1`, `maxHp=78`, and a `corpse` boolean that `uvFor` maps to frame 4 and skips combat.

Helion unique lives. Skip Kryos unique or spawn it already dead. Result: green line looks whole; blue line has holes and wrecks.

## Verify then ship

1. `npm run build`
2. Preview free port. `node scripts/measure.mjs --url http://127.0.0.1:PORT --screenshot critic/out/p41.png --wait 3 --fps-seconds 3`
3. Open PNG. **Pass only if you can count fewer living blue diamonds than green hoods, with wreck sprites in the blue line.**
4. Deploy `npx wrangler pages deploy dist --project-name=spacepixelrts`
5. Commit `P41: Kryos rank already broken with corpses`
6. `tasks/P41.md`. Probe `0.2.16-wave1`.

Do not commit `notes.md` or PNGs.
