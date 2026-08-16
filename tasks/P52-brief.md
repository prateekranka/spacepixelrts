You are the Composer 2.5 **builder** for Spacepixel RTS piece **P52**: death dissolve + corpse stain (DESIGN §5.4 #6).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev
Read first: docs/DESIGN.md §5.4, tasks/P50.md, tasks/P51-critic.md, `src/sim.ts` `kill`/`stepCorpses`, `src/render.ts`.

Do **not** spawn agents. Do **not** restage opening ranks (pre-killed Kryos wrecks with `corpseT` may stay as opening set dressing). Do not change marshal timing, pop, epochs, or P51 sparks.

## The gap

P51 passed muzzle/impact. Remaining from P50: **Death is static wreck placement**, not **2-frame dissolve → corpse stain 1.5s → gone**. HP bars / foot ellipses are P53.

## Do this

1. When `kill()` happens on a unit (not a building, not a pre-placed opening wreck unless it dies in live combat): play a **2-frame dissolve**, then a **corpse stain ~1.5s**, then free the slot. Opening Kryos `hp=0` spawns may keep lingering wrecks for the P41 shot.
2. Live combat deaths after tick 240 (and Helion deaths during the opening exchange) must use the dissolve chain — no pop-out.
3. Pool/reuse; no per-frame alloc.
4. **VERSION** `0.4.1-wave3`.

## Verify

Vite **5174**. Build. Screenshot opening still Helion vs Kryos wrecks. Optionally force-kill a living Helion via `__STARHOLD_WORLD__` and screenshot dissolve/stain. Critic p99 < 22. Deploy `spacepixelrts`.

```
git add -A
git commit -m "P52: death dissolve and corpse stain, not pop-out"
```

No huge PNGs, no `notes.md`. Write `tasks/P52.md`. `--yolo` is on; just work.
