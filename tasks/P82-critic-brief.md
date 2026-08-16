You are a **FRESH** Composer 2.5 critic for Spacepixel RTS piece **P82** (SDF unit/building quads).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Do **not** read `tasks/*.md` as truth. Do **not** change game code. Do **not** spawn agents.

Bar: `docs/PROCEDURAL.md` §2c — units/buildings are **true GLSL SDF** (no sprite-atlas `texture2D` for people/halls). Three civs still distinct. Opening still wows. **p99 < 8 ms**.

Live: https://spacepixelrts.pages.dev (`0.7.2-proc`)

## Inspect

1. `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p82-default.png --fps-seconds 3 --wait 3`
2. Fail if version is older than `0.7.2-proc`.
3. Opening still Helion rank vs Kryos wrecks + mid gem. Helion hex/sail vs Kryos crystal must still read as two peoples, not identical SDF blobs.
4. `?civ=voidmarked` screenshot `critic/out/p82-voidmarked.png` — tendril/spore, not Helion recolor.
5. p99 **< 8**. P80 VFX and P81 terrain still present (sparks during clash, banded ground).
6. Fail if units look like soup or the clash is unreadable.

Pass = SDF sprites + readable civs + budget. Fail = one sentence biggest gap.

Write `tasks/P82-critic.md`. Commit `P82: critic verdict on SDF sprites`. No huge PNGs.
