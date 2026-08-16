You are the Composer 2.5 builder for Spacepixel RTS piece P34: bolts that read as fire, not white chrome filling the gap.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Read: tasks/P33-critic.md, src/render.ts bolt scale + overlay HP, src/atlas.ts drawBolt, src/sim.ts spawnBolt.

P33 critic FAIL. Fat white dual-bolts + oversized HP bars made the gap look like **one white scrum**. Ranks exist; fire is unreadable. HUD/p99 pass.

Do not spawn agents. Do not restack colPitch.

## Single biggest gap (verbatim)

The §6 opening tableau still fails to show two wings exchanging fire — combatants overlap in center with no readable bolt or muzzle pixels bridging the gap.

## Do

1. **Bolts:** scale **1.28**, **one** instance only (delete the velocity-offset twin). Atlas: **orange/gold** sting and **cyan** beam, thin white 1px core — not a 16px white slab. Opening speed 6.0, life 1.4, cooldown 0.32 stay.
2. **HP overlay:** bar **18×3 px**. Show only if `e.hp < e.maxHp * 0.92` or selected. Never draw bars for `Kind.Resource`. Opening clash: skip bars on full-hp fighters so silhouettes win.
3. Keep freeze-fire ranks and camp coords.

## Verify then ship

1. `npm run build`
2. Preview free port. `node scripts/measure.mjs --url http://127.0.0.1:PORT --screenshot critic/out/p34.png --wait 3 --fps-seconds 3`
3. Open PNG. **Pass only if two wings are countable AND you can see orange/cyan bolts in the gap without a white box pile.**
4. Deploy `npx wrangler pages deploy dist --project-name=spacepixelrts`
5. Commit `P34: readable bolts without chrome scrum`
6. `tasks/P34.md`. Probe `0.2.9-wave1`.

Do not commit `notes.md` or PNGs.
