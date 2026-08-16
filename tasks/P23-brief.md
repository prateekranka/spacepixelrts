You are the Composer 2.5 builder for Spacepixel RTS piece P23: the opening shot must be a packed, crossing brawl like AoE2:DE.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Read: tasks/P22-critic.md, src/sim.ts spawnScenario, src/render.ts camera scales, src/main.ts halfH.

P22 critic FAIL. Silhouettes/HUD/fps pass. Single gap: two undersized clumps (~6 vs ~5) stand off across 63% void. DESIGN §6 wants 8v8 already mixing through each other.

## Do
1. Spawn **12 vs 12 Fighters** plus both uniques in a tight 10×6 tile box centered on the camera. Two wings start ~2.2 tiles apart and **AttackMove through each other** so at t=3s they are interpenetrating, not a parade-ground standoff. Keep silhouettes readable (don't stack on identical coordinates).
2. More visible fire: extra bolts (shorter opening cooldown or more ranged shots) so the space BETWEEN wings is full of projectiles.
3. Fill the remaining void: dust/nebula under the whole camera frustum; no 60% `#443355` sea. Target void-pair share < 40% and combat occupying >50% of the playfield.
4. If needed, `halfH` 4.6–5.0 so the brawl is the shot. Do not shrink units.
5. Verify `npm run build` + measure screenshot `critic/out/p23.png` wait 3s. Must look like a melee, two colors mixing, lots of bolts. p99 < 18ms.
6. Deploy spacepixelrts. Commit `P23: packed crossing brawl on the opening shot`. tasks/P23.md.

Do not spawn agents.
