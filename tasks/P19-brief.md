You are the Composer 2.5 builder for Spacepixel RTS piece P19: kill the giant black ore panels covering the opening fight.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Read: tasks/P18-critic.md (the gap), src/render.ts uvFor + scale for Kind.Resource, src/sim.ts stamp/clearBase/spawnScenario, src/atlas.ts tile-ore/gas/sol.

P18 critic FAIL. Single gap: oversized black squares with a gem inside (~15% of the viewport each) sit on top of the armies. Those are resource nodes drawn like buildings. Silhouettes/HUD/fps already passed — do not regress.

## Do
1. Resource entities must render as **small ground gems** (about 0.7–1.0 world units), never as 3-unit black panels. Use a tight gem sprite (no empty atlas padding) or crop UVs to the glowing core. Magenta key unused on resources.
2. Do **not** plant ore/gas/solar nodes inside the opening clash pad. Nodes can ring the pad outside the brawl.
3. Keep the packed 8v8. If fighters merge into one blob, add ~0.15 more spacing so wings stay readable.
4. Verify: `npm run build` and `node scripts/measure.mjs --url http://localhost:5173 --screenshot critic/out/p19.png --wait 3 --fps-seconds 3`. Screenshot: two armies filling the center, **no giant black squares**, gems only as small nodes. p99 < 16ms.
5. Deploy: `npx wrangler pages deploy dist --project-name=spacepixelrts --commit-dirty=true`
6. Commit: `P19: draw resource nodes as gems, not black panels`
7. Write tasks/P19.md

Do not spawn agents.
