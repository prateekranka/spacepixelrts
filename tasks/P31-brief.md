You are the Composer 2.5 builder for Spacepixel RTS piece P31: workers must stand in front of the house, not under it.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Read: tasks/P30-critic.md, src/sim.ts spawnScenario camp block, src/render.ts worker/house scale.

P30 critic FAIL. House + gems now beside the wing. **Zero worker silhouettes** — they spawn at `cz-5.45` under a 1.75-tall house at `cz-5.15`, so the billboard eats them.

Do **not** change rank pitches or freeze-fire. Do not spawn agents.

## Single biggest gap (verbatim)

The §6 beside-rank camp still has no readable workers gathering at gems in the opening frustum.

## Do

1. **Stacking order (world Z, Helion side):** rank outer ~`cz-4.1` → **workers + gem** → house further out.
   - Workers: `(cx - 0.9 + i*0.7, cz - 4.75)` for i=0..2. Pitch 0.7 so three bodies are countable.
   - Ore gem: `(cx + 0.9, cz - 4.75)` immediately beside them.
   - House: `(cx, cz - 6.05)` behind the workers (away from the fight).
   - Kryos mirror on +Z: workers `(cx - 0.9 + i*0.7, cz + 4.75)`, gas `(cx + 0.9, cz + 4.75)`, house `(cx, cz + 6.05)`.
2. **Do not Return-to-hall** for opening workers while `tick < 240` — stay at the gem in Gather (bob/strike the node).
3. Worker billboard **1.55**. House stays 1.75. Fighters stay 1.08.
4. Helion worker atlas: keep the gold pack; add a bright bone/white highlight so they do not read as green fighters.
5. Skip `moveSeparate` for these workers while tick<240 so they keep the 0.7 pitch.
6. Update `openingFlankCampEnt` band to `|z-cz|` **4.4–6.4** so the new worker/gem coords stay forced-visible.

## Verify then ship

1. `npm run build`
2. Preview free port. `node scripts/measure.mjs --url http://127.0.0.1:PORT --screenshot critic/out/p31.png --wait 3 --fps-seconds 3`
3. Open PNG. **Pass only if you can count ≥3 worker bodies (gold pack, not hooded fighters) standing between the Helion wing and the house, plus the house itself.** Ranks still firing.
4. Deploy `npx wrangler pages deploy dist --project-name=spacepixelrts`
5. Commit `P31: put workers in front of the flank house`
6. `tasks/P31.md`. Probe `0.2.6-wave1`.

Do not commit `notes.md` or PNGs.
