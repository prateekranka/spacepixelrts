You are the Composer 2.5 builder for Spacepixel RTS piece P17: opening tableau fills the screen like AoE2:DE.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Read first: docs/DESIGN.md §6 and §9, tasks/P16-critic.md (the gap — do not treat other tasks as evidence), src/sim.ts spawnScenario, src/render.ts buildMap, src/main.ts camera, src/atlas.ts terrain tiles.

P16 critic FAIL, single gap: the opening shot is a tiny skirmish in a void (~9 sprites, 64% near-black pixels). Silhouettes, HUD, and frame time already passed — do not regress those.

## Do (only this gap)
1. **Pack the mid-map clash** in `spawnScenario` so 8v8 Fighters + both uniques occupy a tight ~8×6 tile brawl centered on the camera look-at. They must still be two readable clumps (Helion vs Kryos), not a single pile. Keep workers/bases; they can sit at the edge of the shot.
2. **Terrain must be a place.** Brighten dust/rock in the atlas and the map texture. Diamond edges visible. Ore/gas/solar patches near the clash so the ground isn't 64% `#111122`. Target: harness `avgLuminance` > 42 and top color share of `#111122`+`#000011` under 45%.
3. **Fog must not hide the opening fight.** Player vision covers the clash on tick 0 (existing scouts/fighters LOS is enough if packed; if not, bump LOS on the opening squad only or reveal a mid-map circle at reset).
4. Keep `halfH` ≈ 5, unit scales, magenta team key, nearest-neighbor.
5. Verify: `npm run build` then `node scripts/measure.mjs --url http://localhost:5173 --screenshot critic/out/p17.png --wait 3 --fps-seconds 3` (start `npm run dev` if needed). Screenshot must show a dense two-army brawl filling the playfield. p99 < 16ms. No console errors.
6. Deploy: `npm run build && npx wrangler pages deploy dist --project-name=spacepixelrts --commit-dirty=true`
7. Commit: `P17: pack the opening clash so the first frame is a battle`
8. Write tasks/P17.md

Do not spawn agents. Stay in this repo.
