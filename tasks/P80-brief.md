You are the Composer 2.5 **builder** for Spacepixel RTS piece **P80**: GPU-instanced particle VFX for sparks and bolts.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev (`0.6.0-wave5`)
Read first: `docs/PROCEDURAL.md` (whole file), `docs/ARCHITECTURE.md` §8, `src/render.ts` (spark/bolt instance loops), `src/engine.ts` (`Spark`, `MAX_SPARKS`), `src/sim.ts` (`spawnSpark`, bolts). Reference look: `references/fire-spread.png` (porous broken plume) — do not copy pixels; steal the *shape language*.

Do **not** spawn agents. Do **not** restage opening, civ picker, marshal, HUD, or terrain. Do **not** start P81/P82. Units/buildings stay on the atlas this piece.

## The gap (architecture directive)

Sparks and bolts are **atlas quads** uploaded through the same InstancedMesh as units. Convert them to a **dedicated GPU particle path**: GLSL, additive, per-particle age, seeded spread, “broken plume” (not a round billboard puff).

## Do this

1. Dedicated `InstancedMesh` (or `Points`) for VFX only. Vertex/fragment shader: additive blending, `life/maxLife` as age, hashed random offset per instance so a burst looks porous/broken, not one fat sprite. Helion warm gold, Kryos ice cyan, Nihiline spore purple/green.
2. Bolts: short stretched particles or a few beads along the travel — still readable as projectiles crossing the gap. Do not lose the muzzle → travel → impact chain.
3. Keep sim pools (`MAX_SPARKS`, no per-frame `new` on the spark path). You may stop drawing sparks/bolts through the unit atlas mesh (`drawn` count should drop by those quads).
4. Opening clash must still show bursts in the mid belt (Playwright screenshot). Default boot stays Helion vs Kryos.
5. **p99 < 8 ms** (stricter than the old 22 ms critic gate). Zero per-frame alloc on the particle upload path.
6. **VERSION** `0.7.0-proc`.

## Verify

Vite **5174** only. `npm run build`.

`npm run critic -- --url <dev-or-live> --fps-seconds 3 --wait 3`: p99 **< 8**, opening tableau intact, sparks visible in the clash (not a dead belt). Probe `__STARHOLD__.version === '0.7.0-proc'`.

Deploy: `npx wrangler pages deploy dist --project-name=spacepixelrts`.

```
git add -A
git commit -m "P80: GPU particle VFX for muzzle, bolts, and impact plumes"
```

No huge PNGs, no `notes.md`. Do not commit `references/` if already tracked. Write `tasks/P80.md`. `--yolo` is on; just work.
