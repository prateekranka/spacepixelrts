You are the Composer 2.5 builder for Spacepixel RTS piece P21: two visible battle lines, not one blob vs HP bars.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Read: tasks/P20-critic.md, src/sim.ts spawnScenario, src/content.ts Fighter range, src/atlas.ts aurion/kryos bodies, src/render.ts draw.

P20 critic FAIL. Single gap: opening frame is one merged green blob in a void; enemies are red HP bars without silhouettes. HUD/fps/gems already pass.

## Do
1. **Hold two lines.** Opening 8v8 must stand as two parallel ranks ~3.5–4.5 tiles apart (inside Fighter range 3.1–4) and **Attack** in place — do NOT AttackMove both blobs onto the same coordinate. Uniques sit in the back rank. After ~8s they may close. Critic screenshot is at t≈3s; at that time both wings must be on screen as separate shapes.
2. **Enemy sprites must read.** Aurion/Kryos fighters: brighter ice/white core, dark ink outline, not navy-on-navy. If fog still hides them at t=3s, force vis=true for all clash units until tick 80.
3. **Fill the playfield.** Ranks span ~8 tiles wide so the brawl uses the middle 60%+ of the canvas at halfH=5. Brighten the dust pad under the clash one more step if void still dominates.
4. Verify: `npm run build` and `node scripts/measure.mjs --url http://localhost:5173 --screenshot critic/out/p21.png --wait 3 --fps-seconds 3`. Screenshot must show **two distinct armies** (green hex line vs cyan diamond line) exchanging fire. p99 < 16ms. No giant panels.
5. Deploy pages `spacepixelrts`. Commit `P21: two battle lines exchanging fire on the opening shot`. Write tasks/P21.md.

Do not spawn agents.
