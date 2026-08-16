You are the Composer 2.5 builder for Spacepixel RTS piece P38: put a contested mid gem and two rocks on the duel floor.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Read: tasks/P37-critic.md, src/sim.ts spawnScenario/stampOpeningGround, src/render.ts gem scale.

P37 critic: combat VFX, quiet dust, workers, HUD, p99 **pass**. Gap: gems/rocks sit in **margin camps**, so the **center fight tile** is empty mauve. Do not rainbow-tile. Do not restack ranks. Do not spawn agents.

## Single biggest gap (verbatim)

Readable rock breaks and gatherable ore/gas/solar gems still do not appear on the duel floor — workers and orange spark trails hug the margins while the center remains an empty quiet-dust void.

## Do

On the **same world X as the clash** (`cx = MAP*0.5`):

1. **Contested ore gem** at `(cx, cz)` — the look-at / gap midpoint between the two ranks. `targetH = 1.55`. Stationary, gatherable, not a black panel.
2. **Two boulder props** at `(cx, cz - 2.85)` and `(cx, cz + 2.85)` — just outside each rank toward the camps, still in the central belt. Grey, scale 1.25.
3. Keep camp gems/workers as they are. Bolts pass **over** the mid gem (already y-lifted). If a bolt collider hits the gem, skip Resource in bolt hit (already skipped).

## Verify then ship

1. `npm run build`
2. Preview free port. `node scripts/measure.mjs --url http://127.0.0.1:PORT --screenshot critic/out/p38.png --wait 3 --fps-seconds 3`
3. Open PNG. **Pass only if a large gold gem sits in the gap between the two firing wings, plus two grey rocks on the duel floor, without restoring the rainbow checker.**
4. Deploy `npx wrangler pages deploy dist --project-name=spacepixelrts`
5. Commit `P38: contested mid gem on the duel floor`
6. `tasks/P38.md`. Probe `0.2.13-wave1`.

Do not commit `notes.md` or PNGs.
