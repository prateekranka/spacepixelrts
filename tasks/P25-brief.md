You are the Composer 2.5 builder for Spacepixel RTS piece P25: both armies must share the camera depth plane.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Read: tasks/P24-critic.md, src/sim.ts spawnScenario, src/render.ts lookAt/draw, src/main.ts pan/halfH.

P24 critic FAIL. HUD/fps/silhouette language pass. Single gap: you still only see a slice of the fight (~5 green, 1 blue, orphan HP bars).

## Root cause (orchestrator diagnosis — obey this)
The camera looks from `(pan.x+8, y, pan.z+10)` at `(pan.x, 0, pan.z)`. Splitting wings on **world X** pushes one army toward the camera and one into the distance, so the far wing leaves the frustum (HP bars can remain). Packing 12v12 in a 10×6 box is useless if the box is deeper than the iso frustum.

## Do
1. **Same depth.** Both wings at the **same world X as look-at** (`MAP*0.5`). Separate them on **world Z** (screen left/right): Helion line at `cz - 1.8`, Kryos at `cz + 1.8`. 8 fighters per wing, spaced 0.55 along X (which is depth — keep the X spread ≤ 2.2 total so they stay in frustum). Uniques in the back of each Z-line.
2. **halfH = 6.0** (not 4.6). Look-at remains clash center. Confirm with a one-off: log projected screen x/y of every fighter; every living clash fighter must sit inside 8%–92% of the canvas at t=3s. If any are off, pull halfH up slightly, do not hide them.
3. AttackMove toward the other wing's Z so they close across the screen, mixing in the middle by t=3s, still as two colors.
4. Overlay HP bars only when the sprite was actually drawn (optional but fixes orphan bars).
5. Verify screenshot `critic/out/p25.png` wait 3s: **count ≥14 distinct unit sprites, both colors, bolts between them, playfield filled**. p99 < 18ms.
6. Deploy spacepixelrts. Commit `P25: put both wings on the camera depth plane`. tasks/P25.md.

Do not spawn agents.
