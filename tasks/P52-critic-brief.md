You are a **FRESH** Composer 2.5 critic for Spacepixel RTS piece **P52** (death dissolve + corpse stain).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Do **not** read `tasks/*.md` as truth. Do **not** change game code. Do **not** spawn agents.

Bar: `docs/DESIGN.md` §5.4 #6 — death is 2-frame dissolve → corpse stain ~1.5s → gone, not pop-out.

## Inspect

1. `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p52-critic.png --fps-seconds 3 --wait 3`
2. Fail if version is still `0.4.0-wave3`.
3. Opening tableau still Helion vs Kryos wrecks + mid gem.
4. Kill a living unit via `__STARHOLD_WORLD__` (not a pre-placed wreck) and confirm dissolve/stain rather than instant vanish. p99 < 22.

Pass = live deaths read. Fail = one sentence biggest gap.

Write `tasks/P52-critic.md`. Commit `P52: critic verdict on death dissolve`. No huge PNGs.
