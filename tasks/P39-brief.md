You are the Composer 2.5 builder for Spacepixel RTS piece P39: workers gathering the mid gem between the two wings.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Read: tasks/P38-critic.md, src/sim.ts spawnScenario + tryStrike/bolts, src/render.ts worker scale.

P38 critic: mid gem, two wings, sparks, quiet dust, HUD, p99 **all pass**. Only fail: **no workers gathering in the wow frustum**. Do not rainbow-tile. Do not restack fighter ranks. Do not spawn agents.

## Single biggest gap (verbatim)

Workers and gather activity are absent from the wow frustum — the belt shows two static ranks and a center gem sticker, but no camp-to-node economy in the same frame.

## Do

Mid gem stays at `(cx, cz)`. Spawn **3 Helion workers** around it:

```
(cx - 0.85, cz - 0.7)
(cx + 0.85, cz - 0.7)
(cx,       cz + 0.85)
```

`Ord.Gather`, tx/tz = mid gem, freeze separate/return tick<240, worker scale 1.55. Keep camp workers too.

Opening: bolts **must not** damage Kind.Worker (skip in spawnBolt hit). Workers invulnerable while tick<240 so the gather tableau survives the duel.

## Verify then ship

1. `npm run build`
2. Preview free port. `node scripts/measure.mjs --url http://127.0.0.1:PORT --screenshot critic/out/p39.png --wait 3 --fps-seconds 3`
3. Open PNG. **Pass only if ≥3 gold-pack workers are visibly clustered on the center gem BETWEEN the two firing wings.**
4. Deploy `npx wrangler pages deploy dist --project-name=spacepixelrts`
5. Commit `P39: workers gathering the contested mid gem`
6. `tasks/P39.md`. Probe `0.2.14-wave1`.

Do not commit `notes.md` or PNGs.
