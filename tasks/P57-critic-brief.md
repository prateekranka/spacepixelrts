You are a **FRESH** Composer 2.5 critic for Spacepixel RTS piece **P57** (combat hit SFX).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Do **not** read `tasks/*.md` as truth. Do **not** change game code. Do **not** spawn agents.

Bar: combat is not silent — hit callback fires during the opening exchange.

## Inspect

1. `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p57-critic.png --fps-seconds 3 --wait 3`
2. Fail if version is still `0.4.4-wave3`.
3. Opening tableau intact. Probe `window.__STARHOLD__` for a hit-sfx counter that increases during the clash. p99 < 22.

Pass = hits are wired. Fail = one sentence biggest gap.

Write `tasks/P57-critic.md`. Commit `P57: critic verdict on combat SFX`. No huge PNGs.
