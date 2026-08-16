You are the Composer 2.5 builder for Spacepixel RTS piece P30: park the flank camp beside the ranks, not in the HUD corner.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Read: tasks/P29-critic.md, src/sim.ts spawnScenario + stampOpeningGround (current cz±7 positions), src/render.ts house scale.

P29 critic FAIL. Ranks/HUD/p99 pass. Do **not** change rank pitches, freeze, or AttackMove.

Do not spawn agents.

## Single biggest gap (verbatim)

The §6 flank-camp tableau still never appears in the opening frustum — workers, structures, and gather loops are absent from the playfield between the HUD bars, so the wow shot remains a ranged duel on abstract tiles rather than a place with camps and economy.

Proof: gems sit on a **top-right crag under the FPS readout**. `|z-cz|=7` is the frustum corner. Camps must sit **immediately beside the wings**.

## Exact positions (obey)

`cx = MAP*0.5`, `cz = MAP*0.52`. Helion outer column is about `cz - 4.1`. Keep `|x-cx| <= 1.2`.

- Helion house `(cx + 0.2, cz - 5.15)`, 3 workers `(cx - 0.7 + i*0.55, cz - 5.45)`, Ore gem `(cx - 0.2, cz - 5.85)`.
- Kryos house `(cx - 0.2, cz + 5.15)`, 2 workers `(cx - 0.4 + i*0.55, cz + 5.45)`, Gas gem `(cx + 0.2, cz + 5.85)`.
- Solar gem `(cx + 1.0, cz - 5.5)`.
- Delete cz±7 node/prop/house placements.
- Props/rocks: `|z-cz|` in 5.0–6.2 only, still outside fire lane `|z-cz| < 4.4`.

House billboard targetH **1.75** (still not 3.0). Worker scale **1.22** (fighters stay 1.08). Workers Ord.Gather to their gem. Force vis for these ents through tick 240.

Under each house, stamp a 3×3 **Dust** pad (no rock) so the camp reads as a cleared pad.

## Verify then ship

1. `npm run build`
2. Preview free port. `node scripts/measure.mjs --url http://127.0.0.1:PORT --screenshot critic/out/p30.png --wait 3 --fps-seconds 3`
3. Open PNG. **Pass only if a house and ≥2 workers sit beside a wing in the central playfield, not under the top-right FPS or bottom command bar.** Ranks must still be countable and firing.
4. `npx wrangler pages deploy dist --project-name=spacepixelrts`
5. Commit `P30: park flank camps beside the ranks`
6. `tasks/P30.md`. Probe `0.2.5-wave1`.

Do not commit `notes.md` or PNGs.
