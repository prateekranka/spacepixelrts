You are a **FRESH** Composer 2.5 critic for Spacepixel RTS piece **P56** (formation spread).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Do **not** read `tasks/*.md` as truth. Do **not** change game code. Do **not** spawn agents.

Bar: multi-unit Move does not collapse to one pile.

## Inspect

1. `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p56-critic.png --fps-seconds 3 --wait 3`
2. Fail if version is still `0.4.3-wave3`.
3. Opening tableau intact. After tick 300, select 4+ player fighters, issue Move; they must remain spread (not stacked). p99 < 22.

Pass = formation, not a pile. Fail = one sentence biggest gap.

Write `tasks/P56-critic.md`. Commit `P56: critic verdict on formation spread`. No huge PNGs.
