You are a **FRESH** Composer 2.5 critic for Spacepixel RTS piece **P80** (GPU particle VFX).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Do **not** read `tasks/*.md` as truth. Do **not** change game code. Do **not** spawn agents.

Bar: `docs/PROCEDURAL.md` — sparks/bolts are GPU additive particles (broken plume), not atlas quads. Opening clash still readable. **p99 < 8 ms**.

Live: https://spacepixelrts.pages.dev (`0.7.0-proc`)

## Inspect

1. `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p80-critic.png --fps-seconds 3 --wait 3`
2. Fail if version is older than `0.7.0-proc`.
3. Opening still Helion rank vs Kryos wrecks + mid gem. Fail if the belt is dead (no muzzle/impact/bolts).
4. Probe `__STARHOLD__.rendererInfo.vfx` (or equivalent) is a number > 0 during the opening exchange. `drawn` should be entities, not spark quads mixed in.
5. Screenshot: bursts look porous/broken (not one fat round puff per shot). p99 **< 8**. Do not fail for “not as pretty as a cinematic fire sim” if the clash still reads.

Pass = GPU VFX live, clash readable, budget holds. Fail = one sentence biggest gap.

Write `tasks/P80-critic.md`. Commit `P80: critic verdict on GPU particle VFX`. No huge PNGs.
