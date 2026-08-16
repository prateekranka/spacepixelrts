You are a **FRESH** Composer 2.5 critic for Spacepixel RTS piece **P55** (idle-worker pulse).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Do **not** read `tasks/*.md` as truth. Do **not** change game code. Do **not** spawn agents.

Bar: `docs/DESIGN.md` §7.4 — idle villager pulse on the Worker icon when any Worker is Idle.

## Inspect

1. `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p55-critic.png --fps-seconds 3 --wait 3`
2. Fail if version is still `0.4.2-wave3`.
3. Force one team-0 Worker to `Ord.Idle`. `#idlew` must visually pulse. Opening tableau still Helion vs Kryos wrecks. p99 < 22.

Pass = pulse is obvious. Fail = one sentence biggest gap.

Write `tasks/P55-critic.md`. Commit `P55: critic verdict on idle-worker pulse`. No huge PNGs.
